import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express, { type Request } from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseExternalResponse } from '../src/domain/content/parse';
import { aiRouter } from './aiRoutes';
import { Library } from './db';
import { libraryRouter } from './libraryRoutes';

/** Ollama de mentira: responde como a API real, com comportamento configurável. */
interface Fake {
  models: Array<{ name: string; size: number; details: { parameter_size: string } }>;
  chunks: string[];
  /** Linha de erro no meio do streaming. */
  errorAfter: number | null;
  /** Atraso entre pedaços (ms). */
  delay: number;
  lastBody: Record<string, unknown> | null;
  aborted: boolean;
}

let dir: string;
let lib: Library;
let fake: Fake;
let ollama: Server;
let ollamaUrl: string;
let app: Server;
let base: string;

const listen = (a: express.Express) =>
  new Promise<Server>((resolve) => {
    const s = a.listen(0, '127.0.0.1', () => resolve(s));
  });
const close = (s: Server) => new Promise((r) => s.close(r));

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'eminente-ai-'));
  fake = {
    models: [{ name: 'llama3.2:latest', size: 2_000_000_000, details: { parameter_size: '3.2B' } }],
    chunks: ['{"paginas":[', '{"titulo":"Capa forte","texto":"Apoio"}', '],"legenda":"Legenda","cta":"Fale conosco","hashtags":["#gestao"]}'],
    errorAfter: null,
    delay: 0,
    lastBody: null,
    aborted: false,
  };
  const o = express();
  o.use(express.json());
  o.get('/api/version', (_req, res) => res.json({ version: '0.40.13' }));
  o.get('/api/tags', (_req, res) => res.json({ models: fake.models }));
  o.post('/api/chat', async (req: Request, res) => {
    fake.lastBody = req.body as Record<string, unknown>;
    res.on('close', () => {
      if (!res.writableEnded) fake.aborted = true;
    });
    res.setHeader('Content-Type', 'application/x-ndjson');
    for (const [i, c] of fake.chunks.entries()) {
      if (fake.errorAfter === i) {
        res.write(`${JSON.stringify({ error: 'model runner has unexpectedly stopped' })}\n`);
        res.end();
        return;
      }
      if (fake.delay) await new Promise((r) => setTimeout(r, fake.delay));
      if (res.destroyed) return;
      res.write(`${JSON.stringify({ message: { role: 'assistant', content: c }, done: false })}\n`);
    }
    res.write(`${JSON.stringify({ message: { role: 'assistant', content: '' }, done: true })}\n`);
    res.end();
  });
  ollama = await listen(o);
  ollamaUrl = `http://127.0.0.1:${(ollama.address() as AddressInfo).port}`;

  lib = new Library(path.join(dir, 'biblioteca.db'));
  lib.saveSettings({ ...lib.settings(), ai: { enabled: true, url: ollamaUrl, model: null, temperature: 0.4 } });
  const a = express();
  a.use('/api', express.json());
  a.use('/api', libraryRouter(lib, { defaultExportsDir: path.join(dir, 'exports') }));
  a.use('/api', aiRouter(lib));
  app = await listen(a);
  base = `http://127.0.0.1:${(app.address() as AddressInfo).port}/api`;
});

afterEach(async () => {
  await close(app);
  await close(ollama);
  lib.close();
  rmSync(dir, { recursive: true, force: true });
});

async function generate(prompt = 'Crie um carrossel', signal?: AbortSignal) {
  const res = await fetch(`${base}/ai/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
    signal,
  });
  const text = await res.text();
  const events = res.headers.get('content-type')?.includes('ndjson')
    ? text.trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>)
    : [JSON.parse(text) as Record<string, unknown>];
  return { status: res.status, events };
}

describe('IA local (Ollama)', () => {
  it('status: pronto, com versão, modelos e o modelo escolhido', async () => {
    const s = await (await fetch(`${base}/ai/status`)).json();
    expect(s).toMatchObject({ state: 'ready', version: '0.40.13', model: 'llama3.2:latest', models: [{ name: 'llama3.2:latest', parameters: '3.2B' }] });
  });

  it('status: desligada, sem modelos e fora do ar', async () => {
    lib.saveSettings({ ...lib.settings(), ai: { ...lib.settings().ai, enabled: false } });
    expect((await (await fetch(`${base}/ai/status`)).json()).state).toBe('disabled');

    lib.saveSettings({ ...lib.settings(), ai: { ...lib.settings().ai, enabled: true } });
    fake.models = [];
    expect((await (await fetch(`${base}/ai/status`)).json()).state).toBe('no-models');

    lib.saveSettings({ ...lib.settings(), ai: { ...lib.settings().ai, url: 'http://127.0.0.1:1' } });
    const off = await (await fetch(`${base}/ai/status`)).json();
    expect(off.state).toBe('offline');
    expect(off.message).toMatch(/Não encontrei o Ollama/);
  });

  it('gera em pedaços, com o JSON pedido ao modelo, e o resultado é importável', async () => {
    const { status, events } = await generate('Meu prompt');
    expect(status).toBe(200);
    const text = events.filter((e) => typeof e.t === 'string').map((e) => e.t).join('');
    expect(events.at(-1)).toEqual({ done: true, model: 'llama3.2:latest' });
    expect(fake.lastBody).toMatchObject({ model: 'llama3.2:latest', format: 'json', stream: true, options: { temperature: 0.4 } });
    const messages = fake.lastBody!.messages as Array<{ role: string; content: string }>;
    expect(messages.map((m) => m.role)).toEqual(['system', 'user']);
    expect(messages[1]!.content).toBe('Meu prompt');
    const parsed = parseExternalResponse(text);
    expect(parsed.ok && parsed.content.pages[0]).toMatchObject({ heading: 'Capa forte', body: 'Apoio' });
  });

  it('erro do modelo no meio do streaming vira evento de erro', async () => {
    fake.errorAfter = 1;
    const { status, events } = await generate();
    expect(status).toBe(200);
    expect(events.at(-1)).toEqual({ error: 'O modelo falhou: model runner has unexpectedly stopped' });
  });

  it('erros antes de começar respondem com status e mensagem', async () => {
    expect((await generate('')).status).toBe(400);
    lib.saveSettings({ ...lib.settings(), ai: { ...lib.settings().ai, enabled: false } });
    const off = await generate();
    expect(off.status).toBe(409);
    expect(off.events[0]!.error).toMatch(/desligada/);
    lib.saveSettings({ ...lib.settings(), ai: { ...lib.settings().ai, enabled: true } });
    fake.models = [];
    const none = await generate();
    expect(none.status).toBe(503);
    expect(none.events[0]!.error).toMatch(/ollama pull/);
  });

  it('cancelar no navegador interrompe a geração no Ollama', async () => {
    fake.chunks = Array.from({ length: 40 }, () => 'x');
    fake.delay = 50;
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 300);
    await expect(generate('Longo', ctl.signal)).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 300));
    expect(fake.aborted).toBe(true);
  });

  it('configurações recusam Ollama fora desta máquina; "Testar" confere sem salvar', async () => {
    const current = await (await fetch(`${base}/settings`)).json();
    const bad = await fetch(`${base}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...current.settings, ai: { ...current.settings.ai, url: 'http://servidor.example.com:11434' } }),
    });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/desta máquina/);

    lib.saveSettings({ ...lib.settings(), ai: { ...lib.settings().ai, enabled: false } });
    const check = await (
      await fetch(`${base}/ai/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai: { url: ollamaUrl, model: null, enabled: false } }),
      })
    ).json();
    expect(check.state).toBe('ready');
    expect(lib.settings().ai.enabled).toBe(false);
  });
});
