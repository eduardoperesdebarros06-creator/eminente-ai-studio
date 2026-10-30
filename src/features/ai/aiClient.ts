import type { AiSettings, AiStatus } from '../../domain/ai/ai';
import { api, jsonBody } from '../../lib/api';

/** IA local pelo servidor do estúdio (que fala com o Ollama). */
export const aiClient = {
  status: () => api<AiStatus>('/api/ai/status'),
  /** Testa configurações ainda não salvas. */
  check: (ai: AiSettings) => api<AiStatus>('/api/ai/check', jsonBody('POST', { ai })),

  /**
   * Gera o texto, chamando `onText` com o texto acumulado a cada pedaço.
   * Rejeita com a mensagem do servidor em caso de erro; `signal` cancela.
   */
  async generate(prompt: string, opts: { onText: (all: string) => void; signal?: AbortSignal }): Promise<{ text: string; model: string }> {
    let res: Response;
    try {
      res = await fetch('/api/ai/generate', { ...jsonBody('POST', { prompt }), signal: opts.signal });
    } catch (e) {
      if (opts.signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
      throw new Error('Servidor local indisponível. Inicie o estúdio com "npm run dev".', { cause: e });
    }
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `O servidor respondeu ${res.status}.`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const ev = JSON.parse(line) as { t?: string; done?: boolean; model?: string; error?: string };
        if (ev.error) throw new Error(ev.error);
        if (ev.t) {
          text += ev.t;
          opts.onText(text);
        }
        if (ev.done) return { text, model: ev.model ?? '' };
      }
    }
    throw new Error('A conexão com o servidor terminou antes do fim da geração.');
  },
};
