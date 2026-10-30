import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium, type LaunchOptions } from 'playwright';
import type { ToolCheck } from '../src/domain/motion/api';

/**
 * Localização das ferramentas externas. FFmpeg e ffprobe vêm do PATH (ou de
 * FFMPEG_PATH / FFPROBE_PATH). O navegador é o Chromium do Playwright; se ele
 * não estiver instalado, usa o Microsoft Edge, que já vem no Windows.
 */
export const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
export const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Executa um programa sem shell (argumentos nunca são interpretados). */
export function run(cmd: string, args: readonly string[], timeoutMs = 15_000): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

const missing = (e: unknown) => (e as NodeJS.ErrnoException)?.code === 'ENOENT';

async function checkVersion(cmd: string, name: string, envVar: string): Promise<ToolCheck> {
  try {
    const r = await run(cmd, ['-version']);
    const first = r.stdout.split(/\r?\n/)[0]?.trim() ?? '';
    if (r.code !== 0 || !first.startsWith(name)) return { ok: false, detail: `"${cmd} -version" falhou (código ${r.code}).` };
    return { ok: true, detail: first.replace(/ Copyright.*$/, '') };
  } catch (e) {
    if (missing(e)) {
      return { ok: false, detail: `${name} não encontrado. Instale (winget install Gyan.FFmpeg), reabra o terminal ou defina ${envVar}.` };
    }
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export const checkFfmpeg = () => checkVersion(FFMPEG, 'ffmpeg', 'FFMPEG_PATH');
export const checkFfprobe = () => checkVersion(FFPROBE, 'ffprobe', 'FFPROBE_PATH');

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

/** Opções de lançamento do navegador, ou `null` se nenhum estiver disponível. */
export function browserLaunch(): { options: LaunchOptions; label: string } | null {
  try {
    const bundled = chromium.executablePath();
    if (bundled && existsSync(bundled)) return { options: {}, label: 'Chromium do Playwright' };
  } catch {
    // Playwright sem navegador baixado: tenta o Edge.
  }
  if (process.platform === 'win32' && EDGE_PATHS.some((p) => existsSync(p))) {
    return { options: { channel: 'msedge' }, label: 'Microsoft Edge' };
  }
  return null;
}

export function checkBrowser(): ToolCheck {
  const b = browserLaunch();
  return b
    ? { ok: true, detail: b.label }
    : { ok: false, detail: 'Nenhum navegador para o Playwright. Rode "npx playwright install chromium".' };
}
