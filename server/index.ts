import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { deserializeDraft } from '../src/domain/content/serialize';
import { validateDraft } from '../src/domain/content/validate';
import { isFinished, type RenderHealth } from '../src/domain/motion/api';
import { SAFE_VIDEO_NAME } from '../src/domain/motion/video';
import { hasContent } from '../src/domain/library/library';
import { Library } from './db';
import { aiRouter } from './aiRoutes';
import { libraryRouter, resolveExportsDir } from './libraryRoutes';
import { startMotionJob, type MotionJob } from './motionJob';
import { checkBrowser, checkFfmpeg, checkFfprobe } from './tools';

/**
 * Servidor local do estúdio: serve a interface (Vite em desenvolvimento, `dist/`
 * em produção), a API de renderização de motion e a biblioteca (SQLite).
 * Escuta apenas em 127.0.0.1.
 *
 *   tsx server/index.ts          desenvolvimento (Vite com recarga automática)
 *   tsx server/index.ts --prod   produção (requer `npm run build` antes)
 */
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 5173;
const PROD = process.argv.includes('--prod');
const ROOT = process.cwd();
const DEFAULT_EXPORTS_DIR = path.resolve(process.env.EMINENTE_EXPORTS_DIR || path.join(ROOT, 'exports'));
const DATA_DIR = path.resolve(process.env.EMINENTE_DATA_DIR || path.join(ROOT, 'data'));
const ORIGIN = `http://${HOST}:${PORT}`;
const KEEP_JOBS = 10;

let library: Library;
try {
  library = new Library(path.join(DATA_DIR, 'biblioteca.db'));
} catch (e) {
  console.error(`Não foi possível abrir a biblioteca em ${DATA_DIR}: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
if (library.recovered) console.warn(`ATENÇÃO: ${library.recovered}`);
// Cópia de segurança a cada início (as últimas ficam guardadas).
if (library.list().length || library.list({ trash: true }).length) {
  try {
    library.backup();
  } catch (e) {
    console.warn(`Cópia de segurança da biblioteca falhou: ${e instanceof Error ? e.message : String(e)}`);
  }
}
const exportsDir = () => resolveExportsDir(library, DEFAULT_EXPORTS_DIR);

const app = express();
const httpServer = createServer(app);
const jobs = new Map<string, MotionJob>();

// Bloqueia chamadas à API vindas de outros sites abertos no navegador.
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const origin = req.get('origin');
  const allowed = [ORIGIN, `http://localhost:${PORT}`];
  if (origin && !allowed.includes(origin)) {
    res.status(403).json({ error: 'Origem não permitida.' });
    return;
  }
  next();
});
app.use('/api', express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  const [ffmpeg, ffprobe] = await Promise.all([checkFfmpeg(), checkFfprobe()]);
  const body: RenderHealth = { ffmpeg, ffprobe, browser: checkBrowser(), exportsDir: exportsDir() };
  res.json(body);
});

app.post('/api/motion/jobs', async (req, res) => {
  const draft = deserializeDraft((req.body as { draft?: unknown } | undefined)?.draft);
  if (!draft) {
    res.status(400).json({ error: 'Rascunho inválido ou ausente.' });
    return;
  }
  if (draft.brief.format !== 'motion') {
    res.status(400).json({ error: 'O rascunho não está no formato motion.' });
    return;
  }
  const { errors } = validateDraft(draft);
  if (errors.length) {
    res.status(400).json({ error: `Corrija o conteúdo antes de renderizar: ${errors.map((e) => e.message).join(' ')}` });
    return;
  }
  if ([...jobs.values()].some((j) => !isFinished(j.status.state))) {
    res.status(409).json({ error: 'Já existe uma renderização em andamento.' });
    return;
  }
  const [ffmpeg, ffprobe] = await Promise.all([checkFfmpeg(), checkFfprobe()]);
  const browser = checkBrowser();
  const missing = [ffmpeg, ffprobe, browser].filter((t) => !t.ok).map((t) => t.detail);
  if (missing.length) {
    res.status(503).json({ error: missing.join(' ') });
    return;
  }

  // O vídeo fica registrado no projeto da biblioteca.
  let projectId: string | null = null;
  try {
    if (hasContent(draft)) {
      library.save(draft);
      projectId = draft.id;
    }
  } catch (e) {
    console.warn(`Não foi possível gravar o projeto antes de renderizar: ${e instanceof Error ? e.message : String(e)}`);
  }
  const job = startMotionJob(draft, {
    appOrigin: ORIGIN,
    exportsDir: exportsDir(),
    onDone: (file) => {
      if (!projectId) return;
      try {
        library.addExport(projectId, { kind: 'mp4', name: file.name, path: file.path, bytes: file.bytes, width: file.probe.width, height: file.probe.height });
      } catch (e) {
        console.warn(`Não foi possível registrar o vídeo na biblioteca: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  });
  jobs.set(job.status.id, job);
  // Mantém só os últimos trabalhos na memória.
  for (const id of [...jobs.keys()].slice(0, Math.max(0, jobs.size - KEEP_JOBS))) jobs.delete(id);
  res.status(202).json(job.status);
});

app.get('/api/motion/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Renderização não encontrada (o servidor pode ter sido reiniciado).' });
    return;
  }
  res.json(job.status);
});

app.delete('/api/motion/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Renderização não encontrada.' });
    return;
  }
  job.cancel();
  res.json(job.status);
});

app.get('/api/motion/files/:name', (req, res) => {
  const name = req.params.name;
  const file = path.join(exportsDir(), name);
  if (!SAFE_VIDEO_NAME.test(name) || !existsSync(file)) {
    res.status(404).json({ error: 'Arquivo não encontrado.' });
    return;
  }
  res.download(file, name);
});

app.use('/api', libraryRouter(library, { defaultExportsDir: DEFAULT_EXPORTS_DIR }));
app.use('/api', aiRouter(library));

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota da API desconhecida.' });
});

// Erros (ex.: JSON malformado) sempre respondem em JSON na API.
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith('/api') || res.headersSent) {
    next(err);
    return;
  }
  const status = (err as { status?: number }).status ?? 500;
  res.status(status).json({ error: status === 500 ? `Erro interno: ${err instanceof Error ? err.message : String(err)}` : 'Requisição inválida.' });
});

if (PROD) {
  const dist = path.join(ROOT, 'dist');
  if (!existsSync(path.join(dist, 'index.html')) || !existsSync(path.join(dist, 'render.html'))) {
    console.error('dist/ não encontrado ou incompleto. Rode "npm run build" antes de "npm start".');
    process.exit(1);
  }
  app.use(express.static(dist));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer: createVite } = await import('vite');
  const vite = await createVite({
    appType: 'spa',
    server: { middlewareMode: true, ws: { server: httpServer } },
  });
  app.use(vite.middlewares);
}

httpServer.on('error', (e: NodeJS.ErrnoException) => {
  console.error(e.code === 'EADDRINUSE' ? `A porta ${PORT} já está em uso. Feche o outro processo ou defina PORT.` : e);
  process.exit(1);
});
httpServer.listen(PORT, HOST, () => {
  console.log(`\n  Eminente AI Studio${PROD ? '' : ' (desenvolvimento)'}: ${ORIGIN}`);
  console.log(`  Vídeos exportados em: ${exportsDir()}`);
  console.log(`  Biblioteca: ${library.file}\n`);
});

// Fecha o banco com segurança ao encerrar (Ctrl+C).
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sig, () => {
    try {
      library.close();
    } finally {
      process.exit(0);
    }
  });
}
