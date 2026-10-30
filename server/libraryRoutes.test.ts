import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDraft, createPage } from '../src/domain/content/draft';
import type { ContentDraft } from '../src/domain/content/types';
import { Library } from './db';
import { libraryRouter } from './libraryRoutes';

let dir: string;
let lib: Library;
let server: Server;
let base: string;

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'eminente-api-'));
  lib = new Library(path.join(dir, 'data', 'biblioteca.db'));
  const app = express();
  app.use('/api', express.json({ limit: '1mb' }));
  app.use('/api', libraryRouter(lib, { defaultExportsDir: path.join(dir, 'exports') }));
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterEach(async () => {
  await new Promise((r) => server.close(r));
  lib.close();
  rmSync(dir, { recursive: true, force: true });
});

const call = async (method: string, url: string, body?: unknown) => {
  const res = await fetch(base + url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

function draft(subject = 'Peça'): ContentDraft {
  const d = createDraft({ subject, objective: 'authority', audience: '', tone: 'executive', format: 'post', notes: '' });
  d.pages = [createPage('cover', 'Título')];
  return d;
}

describe('API da biblioteca', () => {
  it('grava, lista, abre e restaura', async () => {
    const d = draft();
    expect((await call('PUT', `/projects/${d.id}`, { draft: d, kind: 'manual', label: 'Primeira' })).status).toBe(200);
    const changed = { ...d, pages: [{ ...d.pages[0]!, heading: 'Mudou' }] };
    await call('PUT', `/projects/${d.id}`, { draft: changed, kind: 'manual' });

    const list = await call('GET', '/projects');
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id: d.id, title: 'Peça', versions: 2 });

    const v1 = await call('GET', `/projects/${d.id}/draft?version=1`);
    expect(v1.body.draft.pages[0].heading).toBe('Título');

    const restored = await call('POST', `/projects/${d.id}/restore`, { version: 1 });
    expect(restored.body.version).toMatchObject({ number: 3, kind: 'restore' });
    expect((await call('GET', `/projects/${d.id}/draft`)).body.draft.pages[0].heading).toBe('Título');
  });

  it('não cria projeto para rascunho vazio em gravação automática', async () => {
    const d = createDraft();
    const r = await call('PUT', `/projects/${d.id}`, { draft: d });
    expect(r.status).toBe(204);
    expect((await call('GET', '/projects')).body).toEqual([]);
  });

  it('recusa rascunho inválido, id divergente e projeto inexistente', async () => {
    const d = draft();
    expect((await call('PUT', `/projects/${d.id}`, { draft: { foo: 1 } })).status).toBe(400);
    expect((await call('PUT', '/projects/outro-id', { draft: d })).status).toBe(400);
    expect((await call('GET', '/projects/nao-existe')).status).toBe(404);
    expect((await call('GET', `/projects/${d.id}/draft?version=abc`)).status).toBe(400);
  });

  it('lixeira e exclusão definitiva', async () => {
    const d = draft();
    await call('PUT', `/projects/${d.id}`, { draft: d });
    expect((await call('DELETE', `/projects/${d.id}`)).status).toBe(409);
    await call('POST', `/projects/${d.id}/trash`);
    expect((await call('GET', '/projects')).body).toEqual([]);
    expect((await call('GET', '/projects?trash=1')).body).toHaveLength(1);
    await call('POST', `/projects/${d.id}/untrash`);
    await call('POST', `/projects/${d.id}/trash`);
    expect((await call('DELETE', `/projects/${d.id}`)).status).toBe(204);
    expect((await call('GET', '/projects?trash=1')).body).toEqual([]);
  });

  it('registra exportações do navegador sem aceitar caminho de disco', async () => {
    const d = draft();
    await call('PUT', `/projects/${d.id}`, { draft: d });
    const r = await call('POST', `/projects/${d.id}/exports`, { kind: 'png', name: 'peca.png', bytes: 2048, width: 1080, height: 1350, path: 'C:\\Windows\\x' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ kind: 'png', path: null, version: 1 });
    expect((await call('POST', `/projects/${d.id}/exports`, { kind: 'exe', name: 'x', bytes: 1 })).status).toBe(400);
    expect((await call('GET', `/projects/${d.id}`)).body.exportList).toHaveLength(1);
  });

  it('configurações: pasta relativa é recusada e a válida é criada', async () => {
    const initial = await call('GET', '/settings');
    expect(initial.body).toMatchObject({ exportsDir: path.join(dir, 'exports'), settings: { exportsDir: null } });

    const bad = await call('PUT', '/settings', { ...initial.body.settings, exportsDir: 'videos' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/caminho completo/);

    const target = path.join(dir, 'meus videos');
    const ok = await call('PUT', '/settings', { ...initial.body.settings, exportsDir: target, defaults: { format: 'motion', design: { fps: 60 } } });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ exportsDir: target, settings: { defaults: { format: 'motion', design: { fps: 60 } } } });
  });

  it('cópia de segurança sob demanda', async () => {
    const d = draft();
    await call('PUT', `/projects/${d.id}`, { draft: d });
    const r = await call('POST', '/library/backup');
    expect(r.status).toBe(200);
    expect(r.body.health.backups).toHaveLength(1);
  });
});
