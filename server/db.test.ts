import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDraft, createPage } from '../src/domain/content/draft';
import type { ContentDraft } from '../src/domain/content/types';
import { AUTO_COALESCE_MS, AUTO_VERSIONS_KEPT } from '../src/domain/library/library';
import { Library } from './db';

let dir: string;
let clock: Date;
const libs: Library[] = [];

function open(file = path.join(dir, 'biblioteca.db')) {
  const lib = new Library(file, { now: () => clock });
  libs.push(lib);
  return lib;
}

function advance(ms: number) {
  clock = new Date(clock.getTime() + ms);
}

function draft(subject = 'Lançamento', heading = 'Capa'): ContentDraft {
  const d = createDraft({ subject, objective: 'authority', audience: '', tone: 'executive', format: 'carousel', notes: '' }, clock);
  d.pages = [createPage('cover', heading), createPage('content', 'Meio'), createPage('cta', 'Fim')];
  return d;
}

const edit = (d: ContentDraft, heading: string): ContentDraft => ({
  ...d,
  updatedAt: clock.toISOString(),
  pages: d.pages.map((p, i) => (i === 0 ? { ...p, heading } : p)),
});

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'eminente-db-'));
  clock = new Date('2026-10-29T12:00:00.000Z');
});

afterEach(() => {
  for (const l of libs.splice(0)) {
    try {
      l.close();
    } catch {
      // já fechado no próprio teste
    }
  }
  rmSync(dir, { recursive: true, force: true });
});

describe('biblioteca SQLite', () => {
  it('cria o projeto na primeira gravação e lista pelo mais recente', () => {
    const lib = open();
    const a = draft('Projeto A');
    const b = draft('Projeto B');
    lib.save(a);
    advance(1000);
    lib.save(b);
    expect(lib.list().map((p) => p.title)).toEqual(['Projeto B', 'Projeto A']);
    expect(lib.list()[0]).toMatchObject({ format: 'carousel', versions: 1, exports: 0, deletedAt: null });
  });

  it('não cria versão quando o conteúdo não mudou (só o updatedAt)', () => {
    const lib = open();
    const d = draft();
    lib.save(d);
    advance(60_000);
    const r = lib.save({ ...d, updatedAt: clock.toISOString() });
    expect(r.changed).toBe(false);
    expect(lib.detail(d.id).versionList).toHaveLength(1);
  });

  it('agrupa gravações automáticas próximas e abre versão nova depois da janela', () => {
    const lib = open();
    const d = draft();
    lib.save(d);
    advance(60_000);
    lib.save(edit(d, 'Capa 2'));
    expect(lib.detail(d.id).versionList).toHaveLength(1);
    expect(lib.draft(d.id).draft.pages[0]!.heading).toBe('Capa 2');

    advance(AUTO_COALESCE_MS + 1);
    lib.save(edit(d, 'Capa 3'));
    const versions = lib.detail(d.id).versionList;
    expect(versions.map((v) => v.number)).toEqual([2, 1]);
    expect(lib.draft(d.id, 1).draft.pages[0]!.heading).toBe('Capa 2');
  });

  it('versão manual nunca é substituída por gravação automática', () => {
    const lib = open();
    const d = draft();
    lib.save(d, 'manual', '  Aprovada pelo cliente  ');
    advance(1000);
    lib.save(edit(d, 'Depois'));
    const v = lib.detail(d.id).versionList;
    expect(v).toHaveLength(2);
    expect(v[1]).toMatchObject({ number: 1, kind: 'manual', label: 'Aprovada pelo cliente' });
    expect(lib.draft(d.id, 1).draft.pages[0]!.heading).toBe('Capa');
  });

  it('restaurar cria uma versão nova com o conteúdo antigo', () => {
    const lib = open();
    const d = draft();
    lib.save(d, 'manual');
    advance(1000);
    lib.save(edit(d, 'Errado'), 'manual');
    advance(1000);
    const r = lib.restore(d.id, 1);
    expect(r.version).toMatchObject({ number: 3, kind: 'restore', label: 'Restaurada da versão 1' });
    expect(lib.draft(d.id).draft.pages[0]!.heading).toBe('Capa');
    expect(lib.detail(d.id).versionList).toHaveLength(3);
  });

  it('mantém só as últimas versões automáticas, preservando as manuais', () => {
    const lib = open();
    const d = draft();
    lib.save(d, 'manual', 'Original');
    for (let i = 0; i < AUTO_VERSIONS_KEPT + 5; i++) {
      advance(AUTO_COALESCE_MS + 1);
      lib.save(edit(d, `Edição ${i}`));
    }
    const v = lib.detail(d.id).versionList;
    expect(v.filter((x) => x.kind === 'auto')).toHaveLength(AUTO_VERSIONS_KEPT);
    expect(v.some((x) => x.kind === 'manual' && x.label === 'Original')).toBe(true);
  });

  it('lixeira: sai da lista, volta ao restaurar e só apaga de vez se estiver nela', () => {
    const lib = open();
    const d = draft();
    lib.save(d);
    expect(() => lib.purge(d.id)).toThrow(/lixeira/);
    lib.trash(d.id);
    expect(lib.list()).toHaveLength(0);
    expect(lib.list({ trash: true })).toHaveLength(1);
    lib.untrash(d.id);
    expect(lib.list()).toHaveLength(1);
    lib.trash(d.id);
    lib.purge(d.id);
    expect(lib.list({ trash: true })).toHaveLength(0);
    expect(() => lib.detail(d.id)).toThrow(/não encontrado/);
  });

  it('gravar um projeto que estava na lixeira o traz de volta', () => {
    const lib = open();
    const d = draft();
    lib.save(d);
    lib.trash(d.id);
    advance(1000);
    lib.save(edit(d, 'Voltei'));
    expect(lib.list().map((p) => p.id)).toEqual([d.id]);
  });

  it('registra exportações com a versão atual', () => {
    const lib = open();
    const d = draft();
    lib.save(d);
    const e = lib.addExport(d.id, { kind: 'zip', name: 'peca.zip', path: null, bytes: 1234, width: 1080, height: 1350 });
    expect(e).toMatchObject({ kind: 'zip', version: 1, bytes: 1234 });
    expect(lib.detail(d.id).exportList).toHaveLength(1);
    expect(lib.list()[0]!.exports).toBe(1);
    expect(() => lib.addExport('nao-existe', { kind: 'png', name: 'x.png', path: null, bytes: 1, width: null, height: null })).toThrow(/não encontrado/);
  });

  it('configurações: padrão, gravação e valores inválidos corrigidos', () => {
    const lib = open();
    expect(lib.settings().defaults.format).toBe('carousel');
    const s = lib.saveSettings({
      ...lib.settings(),
      exportsDir: '  C:\\Videos  ',
      defaults: { format: 'motion', design: { ...lib.settings().defaults.design, fps: 60 } },
      ai: { enabled: true, url: 'localhost:11434', model: 'llama3.2', temperature: 3 },
    });
    expect(s.exportsDir).toBe('C:\\Videos');
    expect(lib.settings()).toMatchObject({
      exportsDir: 'C:\\Videos',
      defaults: { format: 'motion', design: { fps: 60 } },
      ai: { enabled: true, url: 'http://localhost:11434', model: 'llama3.2', temperature: 1 },
    });
    lib.saveSettings({ exportsDir: '', defaults: { format: 'xyz' as never, design: { fps: 7 } as never }, ai: { url: 'http://example.com' } as never });
    expect(lib.settings()).toMatchObject({
      exportsDir: null,
      defaults: { format: 'carousel', design: { fps: 30 } },
      ai: { enabled: false, url: 'http://127.0.0.1:11434', model: null },
    });
  });
});

describe('recuperação', () => {
  it('os projetos sobrevivem a fechar e reabrir o banco (reinício do estúdio)', () => {
    const file = path.join(dir, 'biblioteca.db');
    const d = draft('Persistente');
    const a = open(file);
    a.save(d, 'manual', 'v1');
    a.close();
    const b = open(file);
    expect(b.list().map((p) => p.title)).toEqual(['Persistente']);
    expect(b.draft(d.id).draft).toEqual(d);
    expect(b.recovered).toBeNull();
  });

  it('banco corrompido é guardado de lado e um novo é criado, com aviso', () => {
    const file = path.join(dir, 'biblioteca.db');
    writeFileSync(file, 'isto não é um banco SQLite '.repeat(200));
    const lib = open(file);
    expect(lib.recovered).toMatch(/danificado/);
    expect(lib.list()).toEqual([]);
    lib.save(draft());
    expect(lib.list()).toHaveLength(1);
    expect(readdirSync(dir).some((n) => n.startsWith('biblioteca.db.corrompido-'))).toBe(true);
  });

  it('a cópia de segurança abre como banco válido com os mesmos projetos', () => {
    const lib = open();
    const d = draft('Com backup');
    lib.save(d);
    const file = lib.backup();
    expect(existsSync(file)).toBe(true);
    const copy = open(file);
    expect(copy.list().map((p) => p.title)).toEqual(['Com backup']);
    expect(lib.health().backups).toHaveLength(1);
  });

  it('mantém só as últimas cópias de segurança', () => {
    const lib = open();
    lib.save(draft());
    for (let i = 0; i < 8; i++) {
      advance(1000);
      lib.backup();
    }
    expect(lib.health().backups).toHaveLength(5);
  });

  it('recusa abrir banco de uma versão mais nova do estúdio', () => {
    const file = path.join(dir, 'novo.db');
    const a = open(file);
    a.close();
    // Simula um esquema futuro.
    const raw = new DatabaseSync(file);
    raw.exec('PRAGMA user_version = 99');
    raw.close();
    expect(() => open(file)).toThrow(/mais nova/);
  });
});
