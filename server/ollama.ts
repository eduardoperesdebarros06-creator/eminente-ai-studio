import {
  AI_RESPONSE_MAX,
  AI_TIMEOUT_MS,
  LOCAL_SYSTEM_PROMPT,
  normalizeOllamaUrl,
  pickModel,
  type AiModel,
  type AiSettings,
  type AiStatus,
} from '../src/domain/ai/ai';

/**
 * Cliente mínimo do Ollama (API HTTP local). Só fala com endereços desta
 * máquina (`normalizeOllamaUrl`), e nunca com o navegador diretamente: o
 * navegador conversa com o servidor do estúdio, que repassa ao Ollama.
 */

const STATUS_TIMEOUT_MS = 4000;

export class AiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

function base(settings: AiSettings): string {
  const url = normalizeOllamaUrl(settings.url);
  if (!url) throw new AiError('Endereço do Ollama inválido: use um endereço desta máquina (ex.: http://127.0.0.1:11434).', 400);
  return url;
}

const offlineMessage = (url: string) =>
  `Não encontrei o Ollama em ${url}. Abra o aplicativo Ollama (ou rode "ollama serve") e tente de novo. Para instalar: winget install Ollama.Ollama.`;

async function getJson(url: string, timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function listModels(settings: AiSettings): Promise<AiModel[]> {
  const tags = (await getJson(`${base(settings)}/api/tags`, STATUS_TIMEOUT_MS)) as { models?: unknown };
  const list = Array.isArray(tags.models) ? tags.models : [];
  return list
    .map((m) => m as Record<string, unknown>)
    .filter((m) => typeof m.name === 'string')
    .map((m) => {
      const details = (m.details ?? {}) as Record<string, unknown>;
      return {
        name: String(m.name),
        size: typeof m.size === 'number' ? m.size : 0,
        parameters: typeof details.parameter_size === 'string' ? details.parameter_size : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function aiStatus(settings: AiSettings): Promise<AiStatus> {
  if (!settings.enabled) return { state: 'disabled' };
  let url: string;
  try {
    url = base(settings);
  } catch (e) {
    return { state: 'offline', url: settings.url, message: (e as Error).message };
  }
  let version: string;
  try {
    const v = (await getJson(`${url}/api/version`, STATUS_TIMEOUT_MS)) as { version?: unknown };
    version = typeof v.version === 'string' ? v.version : '?';
  } catch {
    return { state: 'offline', url, message: offlineMessage(url) };
  }
  let models: AiModel[];
  try {
    models = await listModels(settings);
  } catch (e) {
    return { state: 'offline', url, message: `O Ollama respondeu, mas a lista de modelos falhou (${(e as Error).message}).` };
  }
  const model = pickModel(models, settings.model);
  if (!model) return { state: 'no-models', url, version };
  return { state: 'ready', url, version, models, model };
}

/**
 * Gera o texto com o modelo local, chamando `onText` a cada pedaço recebido.
 * Pede JSON ao modelo (`format: "json"`); quem interpreta é o mesmo parser da
 * "IA externa". Devolve o texto completo.
 */
export async function generate(
  settings: AiSettings,
  prompt: string,
  opts: { onText?: (chunk: string) => void; signal?: AbortSignal } = {},
): Promise<{ text: string; model: string }> {
  const status = await aiStatus(settings);
  if (status.state === 'disabled') throw new AiError('A IA local está desligada. Ligue em Configurações.', 409);
  if (status.state === 'offline') throw new AiError(status.message, 503);
  if (status.state === 'no-models') {
    throw new AiError('O Ollama não tem nenhum modelo instalado. No terminal: ollama pull llama3.2', 503);
  }
  const { url, model } = status;

  const signal = opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(AI_TIMEOUT_MS)]) : AbortSignal.timeout(AI_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model,
        stream: true,
        format: 'json',
        options: { temperature: settings.temperature },
        messages: [
          { role: 'system', content: LOCAL_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      }),
    });
  } catch (e) {
    if (opts.signal?.aborted) throw new AiError('Geração cancelada.', 499);
    if ((e as Error).name === 'TimeoutError') throw new AiError('O modelo demorou demais para responder.', 504);
    throw new AiError(offlineMessage(url), 503);
  }
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    let message = detail;
    try {
      message = (JSON.parse(detail) as { error?: string }).error ?? detail;
    } catch {
      // resposta não-JSON
    }
    throw new AiError(`O Ollama recusou o pedido (${res.status}): ${message || 'sem detalhe'}.`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let msg: { message?: { content?: unknown }; error?: unknown; done?: unknown };
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (typeof msg.error === 'string') throw new AiError(`O modelo falhou: ${msg.error}`);
        const chunk = typeof msg.message?.content === 'string' ? msg.message.content : '';
        if (chunk) {
          text += chunk;
          opts.onText?.(chunk);
          if (text.length > AI_RESPONSE_MAX) throw new AiError('A resposta do modelo ficou longa demais e foi interrompida.');
        }
      }
    }
  } catch (e) {
    await reader.cancel().catch(() => undefined);
    if (e instanceof AiError) throw e;
    if (opts.signal?.aborted) throw new AiError('Geração cancelada.', 499);
    if ((e as Error).name === 'TimeoutError') throw new AiError('O modelo demorou demais para responder.', 504);
    throw new AiError(`A conexão com o Ollama caiu: ${(e as Error).message}`);
  }
  if (!text.trim()) throw new AiError('O modelo não devolveu nenhum texto.');
  return { text, model };
}
