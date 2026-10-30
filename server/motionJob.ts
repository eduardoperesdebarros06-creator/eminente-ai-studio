import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';
import type { ContentDraft } from '../src/domain/content/types';
import type { JobStatus, MotionRenderBridge } from '../src/domain/motion/api';
import { motionPlan } from '../src/domain/motion/plan';
import { checkVideo, parseProbe, videoFileName, type VideoSpec } from '../src/domain/motion/video';
import { browserLaunch, FFMPEG, FFPROBE, run } from './tools';

declare global {
  interface Window {
    eminenteMotion?: MotionRenderBridge;
  }
}

/** Quadros entre atualizações do progresso visível. */
const PROGRESS_EVERY = 5;

export class Cancelled extends Error {}

export interface MotionJob {
  status: JobStatus;
  cancel(): void;
}

function sameSpec(a: VideoSpec, b: VideoSpec): boolean {
  return a.width === b.width && a.height === b.height && a.fps === b.fps && a.totalFrames === b.totalFrames && Math.abs(a.durationSec - b.durationSec) < 1e-9;
}

/** Escreve no stdin do FFmpeg respeitando o buffer (backpressure). */
function write(stream: NodeJS.WritableStream, chunk: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (e: Error) => reject(e);
    stream.once('error', onError);
    const ok = stream.write(chunk, () => stream.removeListener('error', onError));
    if (ok) resolve();
    else stream.once('drain', resolve);
  });
}

/**
 * Renderiza o rascunho em MP4:
 * 1. abre render.html no navegador (Playwright) e carrega o rascunho;
 * 2. captura cada quadro como PNG e envia ao FFmpeg (H.264, yuv420p);
 * 3. confere o arquivo com o ffprobe (resolução, FPS, quadros e duração);
 * 4. só então move o arquivo do nome temporário para o final.
 */
export function startMotionJob(draft: ContentDraft, opts: { appOrigin: string; exportsDir: string }): MotionJob {
  const { spec, timeline } = motionPlan(draft);
  const name = videoFileName(draft.brief.subject, spec);
  const finalPath = path.join(opts.exportsDir, name);
  const tempPath = path.join(opts.exportsDir, `.${name}.part`);
  let cancelled = false;
  let browser: Browser | null = null;
  let ffmpeg: ReturnType<typeof spawn> | null = null;

  const status: JobStatus = {
    id: randomUUID(),
    state: 'starting',
    framesDone: 0,
    totalFrames: timeline.totalFrames,
    message: 'Abrindo o navegador de renderização…',
    file: null,
  };
  const check = () => {
    if (cancelled) throw new Cancelled('Renderização cancelada.');
  };

  async function work() {
    const launch = browserLaunch();
    if (!launch) throw new Error('Nenhum navegador disponível para o Playwright. Rode "npx playwright install chromium".');
    await mkdir(opts.exportsDir, { recursive: true });

    browser = await chromium.launch({ ...launch.options, headless: true });
    const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(`${opts.appOrigin}/render.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.eminenteMotion), null, { timeout: 30_000 }).catch(() => {
      throw new Error(`A página de renderização não carregou.${pageErrors.length ? ` ${pageErrors.join(' ')}` : ''}`);
    });
    check();

    const loaded = await page.evaluate((d) => window.eminenteMotion!.load(d), draft as unknown);
    if (!sameSpec(loaded.spec, spec)) {
      throw new Error(`A página calculou ${loaded.spec.totalFrames} quadros em ${loaded.spec.width}×${loaded.spec.height}; o servidor esperava ${spec.totalFrames} em ${spec.width}×${spec.height}.`);
    }
    if (loaded.issues.length) throw new Error(`O layout tem problemas: ${loaded.issues.join(' ')}`);

    // FFmpeg recebe PNGs pelo stdin e grava num arquivo temporário.
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'image2pipe', '-framerate', String(spec.fps), '-c:v', 'png', '-i', 'pipe:0',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-r', String(spec.fps), '-movflags', '+faststart', '-an', '-f', 'mp4', tempPath,
    ];
    const proc = spawn(FFMPEG, args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    ffmpeg = proc;
    let ffErr = '';
    proc.stderr!.on('data', (d: Buffer) => (ffErr = (ffErr + d.toString()).slice(-4000)));
    const exited = new Promise<number | null>((resolve, reject) => {
      proc.on('error', (e) => reject((e as NodeJS.ErrnoException).code === 'ENOENT' ? new Error('FFmpeg não encontrado.') : e));
      proc.on('close', resolve);
    });
    // Se o FFmpeg morrer no meio, a escrita falha com EPIPE; a mensagem útil vem do stderr.
    exited.catch(() => undefined);

    status.state = 'rendering';
    status.message = `Renderizando quadros (${launch.label})…`;
    try {
      for (let i = 0; i < spec.totalFrames; i++) {
        check();
        const b64 = await page.evaluate((n) => window.eminenteMotion!.frame(n), i);
        await write(proc.stdin!, Buffer.from(b64, 'base64'));
        if ((i + 1) % PROGRESS_EVERY === 0 || i + 1 === spec.totalFrames) status.framesDone = i + 1;
      }
    } catch (e) {
      if (e instanceof Cancelled) throw e;
      const code = await exited.catch(() => null);
      throw new Error(ffErr.trim() ? `FFmpeg falhou (código ${code}): ${ffErr.trim()}` : e instanceof Error ? e.message : String(e));
    }
    await browser.close();
    browser = null;

    status.state = 'encoding';
    status.message = 'Finalizando o MP4…';
    proc.stdin!.end();
    const code = await exited;
    check();
    if (code !== 0) throw new Error(`FFmpeg terminou com código ${code}. ${ffErr.trim()}`);

    status.state = 'verifying';
    status.message = 'Conferindo o arquivo com o ffprobe…';
    const probeRun = await run(FFPROBE, [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name,pix_fmt,width,height,r_frame_rate,nb_frames,duration:format=duration',
      '-of', 'json', tempPath,
    ]);
    if (probeRun.code !== 0) throw new Error(`ffprobe falhou: ${probeRun.stderr.trim()}`);
    const probe = parseProbe(JSON.parse(probeRun.stdout));
    if (!probe) throw new Error('ffprobe não encontrou vídeo no arquivo gerado.');
    const problems = checkVideo(spec, probe);
    if (problems.length) throw new Error(`O MP4 gerado não confere: ${problems.join(' ')}`);

    await rename(tempPath, finalPath);
    const { size } = await stat(finalPath);
    status.file = { name, path: finalPath, bytes: size, spec, probe };
    status.state = 'done';
    status.message = 'Vídeo pronto e conferido.';
  }

  work()
    .catch((e: unknown) => {
      status.state = e instanceof Cancelled ? 'cancelled' : 'error';
      status.message = e instanceof Error ? e.message : String(e);
    })
    .finally(async () => {
      const b = browser as Browser | null;
      if (b) await b.close().catch(() => undefined);
      const p = ffmpeg as ReturnType<typeof spawn> | null;
      if (p && p.exitCode === null) {
        // No Windows o arquivo fica travado até o processo sair.
        p.kill();
        await new Promise((r) => {
          p.once('close', r);
          setTimeout(r, 3000);
        });
      }
      if (status.state !== 'done') await rm(tempPath, { force: true }).catch(() => undefined);
    });

  return {
    status,
    cancel() {
      cancelled = true;
    },
  };
}
