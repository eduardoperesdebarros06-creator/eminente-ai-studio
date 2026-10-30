import { Router, type Request, type Response } from 'express';
import { AI_PROMPT_MAX, readAiSettings } from '../src/domain/ai/ai';
import type { Library } from './db';
import { AiError, aiStatus, generate } from './ollama';

/**
 * API da IA local.
 *
 *   GET  /ai/status     situação com as configurações salvas
 *   POST /ai/check      situação com configurações ainda não salvas (botão "Testar")
 *   POST /ai/generate   gera o texto; responde em NDJSON, uma linha por evento:
 *                       {"t":"pedaço"} … {"done":true,"model":"…"} ou {"error":"…"}
 */
export function aiRouter(lib: Library): Router {
  const r = Router();

  r.get('/ai/status', async (_req, res) => {
    res.json(await aiStatus(lib.settings().ai));
  });

  r.post('/ai/check', async (req, res) => {
    // Testa como se estivesse ligada: o botão serve justamente para conferir antes de ligar.
    res.json(await aiStatus({ ...readAiSettings((req.body as { ai?: unknown } | undefined)?.ai), enabled: true }));
  });

  r.post('/ai/generate', async (req: Request, res: Response) => {
    const prompt = (req.body as { prompt?: unknown } | undefined)?.prompt;
    if (typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Prompt vazio.' });
      return;
    }
    if (prompt.length > AI_PROMPT_MAX) {
      res.status(400).json({ error: `Prompt longo demais (máximo ${AI_PROMPT_MAX.toLocaleString('pt-BR')} caracteres).` });
      return;
    }

    // Se a página fechar ou o usuário cancelar, o Ollama para de gerar.
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      res.status(200).setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.flushHeaders();
    };
    const send = (obj: unknown) => {
      start();
      res.write(`${JSON.stringify(obj)}\n`);
    };

    try {
      const out = await generate(lib.settings().ai, prompt, { signal: abort.signal, onText: (t) => send({ t }) });
      send({ done: true, model: out.model });
      res.end();
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError(e instanceof Error ? e.message : String(e), 500);
      if (abort.signal.aborted) return;
      if (!started) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      send({ error: err.message });
      res.end();
    }
  });

  return r;
}
