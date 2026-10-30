import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { deserializeDraft, serializeDraft } from '../src/domain/content/serialize';
import type { ContentDraft } from '../src/domain/content/types';
import {
  AUTO_VERSIONS_KEPT,
  contentKey,
  draftTitle,
  readSettings,
  shouldCoalesce,
  versionLabel,
  type AppSettings,
  type ExportKind,
  type ExportRecord,
  type LibraryHealth,
  type ProjectDetail,
  type ProjectSummary,
  type SaveResult,
  type VersionKind,
  type VersionSummary,
} from '../src/domain/library/library';

/**
 * Biblioteca em SQLite (`node:sqlite`, embutido no Node — sem dependência
 * nativa para compilar no Windows).
 *
 * Proteções contra perda de dados:
 * - WAL + `synchronous=NORMAL`: gravações atômicas e resistentes a quedas;
 * - cada gravação de versão roda numa transação;
 * - `integrity_check` na abertura: um arquivo corrompido é renomeado (não
 *   apagado) e um banco novo é criado, com aviso na interface;
 * - cópia de segurança (`VACUUM INTO`) a cada abertura, mantendo as últimas.
 */

const SCHEMA_VERSION = 1;
const BACKUPS_KEPT = 5;

const MIGRATIONS: Record<number, string> = {
  1: `
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      format TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE versions (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      number INTEGER NOT NULL,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      draft_json TEXT NOT NULL,
      PRIMARY KEY (project_id, number)
    );
    CREATE TABLE exports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      version INTEGER,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT,
      bytes INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE INDEX projects_updated ON projects(updated_at DESC);
    CREATE INDEX exports_project ON exports(project_id, created_at DESC);
  `,
};

export class NotFound extends Error {}
/** Operação válida, mas não no estado atual (ex.: apagar de vez fora da lixeira). */
export class Conflict extends Error {}

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

type Row = Record<string, unknown>;
const str = (v: unknown) => String(v);
const num = (v: unknown) => Number(v);
const optNum = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const optStr = (v: unknown) => (v === null || v === undefined ? null : String(v));

function toSummary(r: Row): ProjectSummary {
  return {
    id: str(r.id),
    title: str(r.title),
    format: str(r.format) as ProjectSummary['format'],
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
    versions: num(r.versions ?? 0),
    exports: num(r.exports ?? 0),
    deletedAt: optStr(r.deleted_at),
  };
}

function toVersion(r: Row): VersionSummary {
  return {
    number: num(r.number),
    kind: str(r.kind) as VersionKind,
    label: str(r.label),
    createdAt: str(r.created_at),
    savedAt: str(r.saved_at),
  };
}

function toExport(r: Row): ExportRecord {
  return {
    id: num(r.id),
    kind: str(r.kind) as ExportKind,
    name: str(r.name),
    path: optStr(r.path),
    bytes: num(r.bytes),
    width: optNum(r.width),
    height: optNum(r.height),
    version: optNum(r.version),
    createdAt: str(r.created_at),
  };
}

const SUMMARY_SQL = `
  SELECT p.*,
    (SELECT COUNT(*) FROM versions v WHERE v.project_id = p.id) AS versions,
    (SELECT COUNT(*) FROM exports e WHERE e.project_id = p.id) AS exports
  FROM projects p`;

export interface LibraryOptions {
  /** Pasta das cópias de segurança. Padrão: `<pasta do banco>/backups`. */
  backupsDir?: string;
  /** Relógio injetável (testes). */
  now?: () => Date;
}

export class Library {
  readonly file: string;
  readonly backupsDir: string;
  /** Aviso de recuperação feito na abertura, se houve. */
  readonly recovered: string | null;
  private readonly db: DatabaseSync;
  private readonly now: () => Date;

  constructor(file: string, opts: LibraryOptions = {}) {
    this.file = path.resolve(file);
    this.backupsDir = opts.backupsDir ?? path.join(path.dirname(this.file), 'backups');
    this.now = opts.now ?? (() => new Date());
    mkdirSync(path.dirname(this.file), { recursive: true });
    const { db, recovered } = Library.openChecked(this.file, this.now());
    this.db = db;
    this.recovered = recovered;
    try {
      this.migrate();
    } catch (e) {
      // Sem isso o arquivo fica travado no Windows até o processo sair.
      db.close();
      throw e;
    }
  }

  /** Abre o banco; se estiver corrompido, guarda o arquivo de lado e começa um novo. */
  private static openChecked(file: string, now: Date): { db: DatabaseSync; recovered: string | null } {
    const prepare = (db: DatabaseSync) => {
      db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
    };
    if (existsSync(file)) {
      let problem: string | null = null;
      let db: DatabaseSync | null = null;
      try {
        db = new DatabaseSync(file);
        const r = db.prepare('PRAGMA integrity_check').get() as Row | undefined;
        const result = r ? String(Object.values(r)[0]) : 'sem resposta';
        if (result !== 'ok') problem = result;
      } catch (e) {
        problem = e instanceof Error ? e.message : String(e);
      }
      if (!problem && db) {
        prepare(db);
        return { db, recovered: null };
      }
      try {
        db?.close();
      } catch {
        // já fechado ou nunca aberto
      }
      const stamp = now.toISOString().replace(/[:.]/g, '-');
      const kept = `${file}.corrompido-${stamp}`;
      renameSync(file, kept);
      for (const side of ['-wal', '-shm']) if (existsSync(file + side)) renameSync(file + side, kept + side);
      const fresh = new DatabaseSync(file);
      prepare(fresh);
      return {
        db: fresh,
        recovered: `O banco da biblioteca estava danificado (${problem}). Ele foi guardado como "${path.basename(kept)}" e um banco novo foi criado. Restaure uma cópia de segurança se precisar dos projetos antigos.`,
      };
    }
    const db = new DatabaseSync(file);
    prepare(db);
    return { db, recovered: null };
  }

  private migrate() {
    const current = num((this.db.prepare('PRAGMA user_version').get() as Row).user_version);
    if (current > SCHEMA_VERSION) {
      throw new Error(`O banco é de uma versão mais nova do estúdio (esquema ${current}). Atualize o Eminente AI Studio.`);
    }
    for (let v = current + 1; v <= SCHEMA_VERSION; v++) {
      this.tx(() => {
        this.db.exec(MIGRATIONS[v]!);
        this.db.exec(`PRAGMA user_version = ${v}`);
      });
    }
  }

  private tx<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  close() {
    this.db.close();
  }

  // ---------- Projetos e versões ----------

  /**
   * Grava o rascunho como versão do projeto (criando o projeto se preciso).
   * Conteúdo igual ao da última versão não gera versão nova; gravações
   * automáticas próximas no tempo são agrupadas.
   */
  save(draft: ContentDraft, kind: VersionKind = 'auto', label?: string, restoredFrom?: number): SaveResult {
    const now = this.now();
    const ts = now.toISOString();
    const json = serializeDraft(draft);
    const key = hash(contentKey(draft));
    return this.tx(() => {
      const existing = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(draft.id) as Row | undefined;
      if (!existing) {
        this.db
          .prepare('INSERT INTO projects (id, title, format, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
          .run(draft.id, draftTitle(draft), draft.brief.format, draft.createdAt, ts);
      }
      const lastRow = this.db
        .prepare('SELECT * FROM versions WHERE project_id = ? ORDER BY number DESC LIMIT 1')
        .get(draft.id) as Row | undefined;
      const last = lastRow ? toVersion(lastRow) : null;

      let version: VersionSummary;
      let changed = true;
      if (lastRow && str(lastRow.content_hash) === key && kind === 'auto') {
        changed = false;
        version = last!;
      } else if (shouldCoalesce(last, kind, now)) {
        this.db
          .prepare('UPDATE versions SET draft_json = ?, content_hash = ?, saved_at = ? WHERE project_id = ? AND number = ?')
          .run(json, key, ts, draft.id, last!.number);
        version = { ...last!, savedAt: ts };
      } else {
        const number = (last?.number ?? 0) + 1;
        version = { number, kind, label: versionLabel(kind, label, restoredFrom), createdAt: ts, savedAt: ts };
        this.db
          .prepare('INSERT INTO versions (project_id, number, kind, label, created_at, saved_at, content_hash, draft_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(draft.id, number, kind, version.label, ts, ts, key, json);
        this.pruneAuto(draft.id);
      }
      if (changed || existing?.deleted_at) {
        // Gravar um projeto que estava na lixeira o traz de volta.
        this.db
          .prepare('UPDATE projects SET title = ?, format = ?, updated_at = ?, deleted_at = NULL WHERE id = ?')
          .run(draftTitle(draft), draft.brief.format, ts, draft.id);
      }
      return { project: this.summary(draft.id), version, changed };
    });
  }

  /** Mantém só as últimas versões automáticas (manuais e restaurações ficam). */
  private pruneAuto(projectId: string) {
    this.db
      .prepare(
        `DELETE FROM versions WHERE project_id = ? AND kind = 'auto' AND number NOT IN (
           SELECT number FROM versions WHERE project_id = ? AND kind = 'auto' ORDER BY number DESC LIMIT ?)`,
      )
      .run(projectId, projectId, AUTO_VERSIONS_KEPT);
  }

  private summary(id: string): ProjectSummary {
    const r = this.db.prepare(`${SUMMARY_SQL} WHERE p.id = ?`).get(id) as Row | undefined;
    if (!r) throw new NotFound('Projeto não encontrado.');
    return toSummary(r);
  }

  list(opts: { trash?: boolean } = {}): ProjectSummary[] {
    const where = opts.trash ? 'WHERE p.deleted_at IS NOT NULL' : 'WHERE p.deleted_at IS NULL';
    return (this.db.prepare(`${SUMMARY_SQL} ${where} ORDER BY p.updated_at DESC`).all() as Row[]).map(toSummary);
  }

  detail(id: string): ProjectDetail {
    const project = this.summary(id);
    const versionList = (this.db.prepare('SELECT * FROM versions WHERE project_id = ? ORDER BY number DESC').all(id) as Row[]).map(toVersion);
    const exportList = (this.db.prepare('SELECT * FROM exports WHERE project_id = ? ORDER BY created_at DESC, id DESC').all(id) as Row[]).map(toExport);
    return { ...project, versionList, exportList };
  }

  /** Rascunho de uma versão (a última, se `number` não for dado). */
  draft(id: string, number?: number): { draft: ContentDraft; version: VersionSummary } {
    const r = (
      number === undefined
        ? this.db.prepare('SELECT * FROM versions WHERE project_id = ? ORDER BY number DESC LIMIT 1').get(id)
        : this.db.prepare('SELECT * FROM versions WHERE project_id = ? AND number = ?').get(id, number)
    ) as Row | undefined;
    if (!r) throw new NotFound(number === undefined ? 'Projeto não encontrado.' : `Versão ${number} não encontrada.`);
    const draft = deserializeDraft(JSON.parse(str(r.draft_json)));
    if (!draft) throw new Error(`A versão ${num(r.number)} está ilegível.`);
    return { draft, version: toVersion(r) };
  }

  /** Restaura uma versão antiga criando uma versão nova (nada é sobrescrito). */
  restore(id: string, number: number): SaveResult {
    const { draft } = this.draft(id, number);
    return this.save({ ...draft, updatedAt: this.now().toISOString() }, 'restore', undefined, number);
  }

  /** Move para a lixeira (pode ser desfeito). */
  trash(id: string): ProjectSummary {
    this.summary(id);
    this.db.prepare('UPDATE projects SET deleted_at = ? WHERE id = ?').run(this.now().toISOString(), id);
    return this.summary(id);
  }

  untrash(id: string): ProjectSummary {
    this.summary(id);
    this.db.prepare('UPDATE projects SET deleted_at = NULL WHERE id = ?').run(id);
    return this.summary(id);
  }

  /** Apaga de vez (só projetos que já estão na lixeira). */
  purge(id: string): void {
    const p = this.summary(id);
    if (!p.deletedAt) throw new Conflict('Só é possível apagar de vez um projeto que está na lixeira.');
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }

  // ---------- Exportações ----------

  addExport(projectId: string, e: Omit<ExportRecord, 'id' | 'createdAt' | 'version'>): ExportRecord {
    this.summary(projectId);
    const ts = this.now().toISOString();
    const last = this.db.prepare('SELECT MAX(number) AS n FROM versions WHERE project_id = ?').get(projectId) as Row;
    const version = optNum(last.n);
    const r = this.db
      .prepare('INSERT INTO exports (project_id, version, kind, name, path, bytes, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(projectId, version, e.kind, e.name, e.path, e.bytes, e.width, e.height, ts);
    return { ...e, id: Number(r.lastInsertRowid), version, createdAt: ts };
  }

  // ---------- Configurações ----------

  settings(): AppSettings {
    const r = this.db.prepare("SELECT value FROM settings WHERE key = 'app'").get() as Row | undefined;
    if (!r) return readSettings(undefined);
    try {
      return readSettings(JSON.parse(str(r.value)));
    } catch {
      return readSettings(undefined);
    }
  }

  saveSettings(s: AppSettings): AppSettings {
    const clean = readSettings(s);
    this.db
      .prepare("INSERT INTO settings (key, value) VALUES ('app', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(JSON.stringify(clean));
    return clean;
  }

  // ---------- Cópias de segurança ----------

  /** Cópia consistente do banco (VACUUM INTO). Mantém as últimas `BACKUPS_KEPT`. */
  backup(): string {
    mkdirSync(this.backupsDir, { recursive: true });
    const stamp = this.now().toISOString().replace(/[:.]/g, '-');
    const target = path.join(this.backupsDir, `biblioteca-${stamp}.db`);
    if (existsSync(target)) rmSync(target);
    this.db.prepare('VACUUM INTO ?').run(target);
    const all = this.backupFiles();
    for (const old of all.slice(BACKUPS_KEPT)) rmSync(path.join(this.backupsDir, old.name), { force: true });
    return target;
  }

  private backupFiles() {
    if (!existsSync(this.backupsDir)) return [];
    return readdirSync(this.backupsDir)
      .filter((n) => /^biblioteca-.+\.db$/.test(n))
      .map((name) => {
        const st = statSync(path.join(this.backupsDir, name));
        return { name, bytes: st.size, createdAt: st.mtime.toISOString() };
      })
      .sort((a, b) => b.name.localeCompare(a.name));
  }

  health(): LibraryHealth {
    const v = this.db.prepare('SELECT sqlite_version() AS v').get() as Row;
    return { ok: true, file: this.file, sqlite: str(v.v), recovered: this.recovered, backups: this.backupFiles() };
  }
}
