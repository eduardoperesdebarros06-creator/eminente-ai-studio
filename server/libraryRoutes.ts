import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import { deserializeDraft } from '../src/domain/content/serialize';
import { hasContent, isExportKind, readSettings, type SettingsView, type VersionKind } from '../src/domain/library/library';
import { Conflict, NotFound, type Library } from './db';

/** Pasta de exportação efetiva: configuração do usuário, senão a padrão. */
export function resolveExportsDir(lib: Library, defaultDir: string): string {
  return lib.settings().exportsDir ?? defaultDir;
}

/** Confere se a pasta existe (ou pode ser criada) e aceita gravação. Devolve o motivo da falha. */
export function checkWritableDir(dir: string): string | null {
  if (!path.isAbsolute(dir)) return 'Informe o caminho completo da pasta (ex.: C:\\Users\\Você\\Videos\\Eminente).';
  try {
    mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.eminente-teste-${process.pid}`);
    writeFileSync(probe, 'ok');
    rmSync(probe, { force: true });
    return null;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    return code === 'EACCES' || code === 'EPERM' ? 'Sem permissão para gravar nessa pasta.' : `Não foi possível usar a pasta (${code ?? (e as Error).message}).`;
  }
}

const KINDS: readonly VersionKind[] = ['auto', 'manual'];

/** API da biblioteca (projetos, versões, exportações) e das configurações. */
export function libraryRouter(lib: Library, opts: { defaultExportsDir: string }): Router {
  const r = Router();

  const handle = (fn: (req: Request, res: Response) => void) => (req: Request, res: Response) => {
    try {
      fn(req, res);
    } catch (e) {
      if (e instanceof NotFound) res.status(404).json({ error: e.message });
      else if (e instanceof Conflict) res.status(409).json({ error: e.message });
      else res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  };
  const id = (req: Request) => String(req.params.id);

  r.get('/library/health', handle((_req, res) => res.json(lib.health())));

  r.post('/library/backup', handle((_req, res) => {
    const file = lib.backup();
    res.json({ file, health: lib.health() });
  }));

  r.get('/projects', handle((req, res) => res.json(lib.list({ trash: req.query.trash === '1' }))));

  r.get('/projects/:id', handle((req, res) => res.json(lib.detail(id(req)))));

  r.get('/projects/:id/draft', handle((req, res) => {
    const v = req.query.version === undefined ? undefined : Number(req.query.version);
    if (v !== undefined && !Number.isInteger(v)) {
      res.status(400).json({ error: 'Versão inválida.' });
      return;
    }
    res.json(lib.draft(id(req), v));
  }));

  r.put('/projects/:id', handle((req, res) => {
    const body = (req.body ?? {}) as { draft?: unknown; kind?: unknown; label?: unknown };
    const draft = deserializeDraft(body.draft);
    if (!draft) {
      res.status(400).json({ error: 'Rascunho inválido.' });
      return;
    }
    if (draft.id !== id(req)) {
      res.status(400).json({ error: 'O id do rascunho não confere com o endereço.' });
      return;
    }
    const kind = KINDS.includes(body.kind as VersionKind) ? (body.kind as VersionKind) : 'auto';
    // Rascunhos vazios não viram projeto (a não ser que você peça para salvar).
    if (kind === 'auto' && !hasContent(draft)) {
      res.status(204).end();
      return;
    }
    res.json(lib.save(draft, kind, typeof body.label === 'string' ? body.label : undefined));
  }));

  r.post('/projects/:id/restore', handle((req, res) => {
    const v = Number((req.body as { version?: unknown } | undefined)?.version);
    if (!Number.isInteger(v)) {
      res.status(400).json({ error: 'Versão inválida.' });
      return;
    }
    res.json(lib.restore(id(req), v));
  }));

  r.post('/projects/:id/trash', handle((req, res) => res.json(lib.trash(id(req)))));
  r.post('/projects/:id/untrash', handle((req, res) => res.json(lib.untrash(id(req)))));
  r.delete('/projects/:id', handle((req, res) => {
    lib.purge(id(req));
    res.status(204).end();
  }));

  r.post('/projects/:id/exports', handle((req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 200) : '';
    const bytes = Number(b.bytes);
    const dim = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : null);
    if (!isExportKind(b.kind) || !name || !Number.isFinite(bytes) || bytes < 0) {
      res.status(400).json({ error: 'Registro de exportação inválido.' });
      return;
    }
    // O navegador só informa downloads; caminhos no disco são gravados pelo servidor (MP4).
    res.status(201).json(lib.addExport(id(req), { kind: b.kind, name, path: null, bytes, width: dim(b.width), height: dim(b.height) }));
  }));

  const view = (): SettingsView => ({
    settings: lib.settings(),
    exportsDir: resolveExportsDir(lib, opts.defaultExportsDir),
    defaultExportsDir: opts.defaultExportsDir,
  });

  r.get('/settings', handle((_req, res) => res.json(view())));

  r.put('/settings', handle((req, res) => {
    const next = readSettings(req.body);
    if (next.exportsDir) {
      const problem = checkWritableDir(next.exportsDir);
      if (problem) {
        res.status(400).json({ error: problem });
        return;
      }
      next.exportsDir = path.resolve(next.exportsDir);
    }
    lib.saveSettings(next);
    res.json(view());
  }));

  return r;
}
