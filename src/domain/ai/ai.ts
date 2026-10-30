/**
 * IA local (Fase 6): integração opcional com o Ollama rodando nesta máquina.
 * Regras puras e contrato entre a interface e o servidor local.
 *
 * O estúdio só conversa com um Ollama em endereço local (127.0.0.1, localhost
 * ou ::1): o texto do briefing nunca sai do computador.
 */

export interface AiSettings {
  /** Desligado por padrão: a IA local é opcional. */
  enabled: boolean;
  /** Endereço do Ollama. */
  url: string;
  /** Modelo escolhido (ex.: "llama3.2:latest"). `null` = o primeiro instalado. */
  model: string | null;
  /** 0 = mais previsível; 1 = mais criativo. */
  temperature: number;
}

export const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';

export const DEFAULT_AI: AiSettings = {
  enabled: false,
  url: DEFAULT_OLLAMA_URL,
  model: null,
  temperature: 0.7,
};

/** Tempo máximo de uma geração (modelos grandes em CPU podem ser lentos). */
export const AI_TIMEOUT_MS = 5 * 60 * 1000;
/** Tamanho máximo do prompt aceito pelo servidor. */
export const AI_PROMPT_MAX = 20_000;
/** Resposta maior que isso é interrompida (o parser aceita até 50 mil caracteres). */
export const AI_RESPONSE_MAX = 50_000;

export interface AiModel {
  name: string;
  /** Tamanho em bytes no disco. */
  size: number;
  /** Ex.: "3.2B". */
  parameters: string | null;
}

export type AiStatus =
  | { state: 'disabled' }
  | { state: 'offline'; url: string; message: string }
  | { state: 'no-models'; url: string; version: string }
  | { state: 'ready'; url: string; version: string; models: AiModel[]; model: string };

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/** Normaliza e confere o endereço. Devolve `null` se não for um Ollama local válido. */
export function normalizeOllamaUrl(raw: string): string | null {
  const text = raw.trim().replace(/\/+$/, '');
  if (!text) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(text) ? text : `http://${text}`);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!LOOPBACK.has(u.hostname.toLowerCase())) return null;
  if (u.username || u.password || u.search || u.hash || (u.pathname && u.pathname !== '/')) return null;
  return `${u.protocol}//${u.host}`;
}

export function readAiSettings(v: unknown): AiSettings {
  if (typeof v !== 'object' || v === null) return { ...DEFAULT_AI };
  const o = v as Record<string, unknown>;
  const url = typeof o.url === 'string' ? normalizeOllamaUrl(o.url) : null;
  const t = typeof o.temperature === 'number' && Number.isFinite(o.temperature) ? o.temperature : DEFAULT_AI.temperature;
  return {
    enabled: o.enabled === true,
    url: url ?? DEFAULT_AI.url,
    model: typeof o.model === 'string' && o.model.trim() ? o.model.trim().slice(0, 200) : null,
    temperature: Math.round(Math.min(1, Math.max(0, t)) * 100) / 100,
  };
}

/** Modelo efetivo: o escolhido, se ainda estiver instalado; senão o primeiro. */
export function pickModel(models: readonly AiModel[], wanted: string | null): string | null {
  if (models.length === 0) return null;
  if (wanted) {
    const exact = models.find((m) => m.name === wanted);
    if (exact) return exact.name;
    // "llama3.2" e "llama3.2:latest" são o mesmo modelo para o Ollama.
    const base = (n: string) => n.replace(/:latest$/, '');
    const same = models.find((m) => base(m.name) === base(wanted));
    if (same) return same.name;
  }
  return models[0]!.name;
}

/** Instrução extra para modelos locais, que tendem a sair do formato. */
export const LOCAL_SYSTEM_PROMPT =
  'Você responde sempre em português do Brasil e somente com um objeto JSON válido, sem texto antes ou depois, sem markdown.';
