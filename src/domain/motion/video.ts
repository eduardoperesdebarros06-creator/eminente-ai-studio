import { slugify } from '../content/export';

/** O que o MP4 precisa ter, calculado a partir do rascunho. */
export interface VideoSpec {
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  durationSec: number;
}

/** Dados lidos do arquivo pelo ffprobe (somente os campos usados). */
export interface VideoProbe {
  codec: string;
  pixelFormat: string;
  width: number;
  height: number;
  /** Ex.: "30/1". */
  frameRate: string;
  /** Pode faltar em alguns contêineres. */
  frames: number | null;
  durationSec: number;
}

/** Interpreta a saída JSON de `ffprobe -show_streams -show_format`. */
export function parseProbe(json: unknown): VideoProbe | null {
  if (typeof json !== 'object' || json === null) return null;
  const { streams, format } = json as { streams?: unknown; format?: unknown };
  const s = Array.isArray(streams) ? (streams[0] as Record<string, unknown> | undefined) : undefined;
  if (!s) return null;
  const f = (typeof format === 'object' && format !== null ? format : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  const width = num(s.width);
  const height = num(s.height);
  const durationSec = Number.isFinite(num(s.duration)) ? num(s.duration) : num(f.duration);
  const frames = num(s.nb_frames);
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(durationSec)) return null;
  return {
    codec: typeof s.codec_name === 'string' ? s.codec_name : '',
    pixelFormat: typeof s.pix_fmt === 'string' ? s.pix_fmt : '',
    width,
    height,
    frameRate: typeof s.r_frame_rate === 'string' ? s.r_frame_rate : '',
    frames: Number.isFinite(frames) ? frames : null,
    durationSec,
  };
}

function rate(r: string): number {
  const [n, d] = r.split('/').map(Number);
  return n !== undefined && d ? n / d : Number(r);
}

/**
 * Confere o arquivo gerado contra o esperado. Devolve a lista de problemas
 * (vazia = válido). Tolerância de duração: um quadro + 50 ms do contêiner.
 */
export function checkVideo(spec: VideoSpec, probe: VideoProbe): string[] {
  const out: string[] = [];
  if (probe.codec !== 'h264') out.push(`codec ${probe.codec || 'desconhecido'}, esperado h264.`);
  if (probe.pixelFormat !== 'yuv420p') out.push(`formato de pixel ${probe.pixelFormat || 'desconhecido'}, esperado yuv420p.`);
  if (probe.width !== spec.width || probe.height !== spec.height) {
    out.push(`resolução ${probe.width}×${probe.height}, esperado ${spec.width}×${spec.height}.`);
  }
  const fps = rate(probe.frameRate);
  if (!(Math.abs(fps - spec.fps) < 0.01)) out.push(`taxa de ${probe.frameRate || '?'} quadros/s, esperado ${spec.fps}.`);
  if (probe.frames !== null && probe.frames !== spec.totalFrames) {
    out.push(`${probe.frames} quadros, esperado ${spec.totalFrames}.`);
  }
  const tolerance = 1 / spec.fps + 0.05;
  if (Math.abs(probe.durationSec - spec.durationSec) > tolerance) {
    out.push(`duração de ${probe.durationSec.toFixed(2)} s, esperado ${spec.durationSec.toFixed(2)} s.`);
  }
  return out;
}

/** Nome do MP4: eminente-motion-<assunto>-1080x1920-30fps.mp4 */
export function videoFileName(subject: string, spec: Pick<VideoSpec, 'width' | 'height' | 'fps'>): string {
  return `eminente-motion-${slugify(subject)}-${spec.width}x${spec.height}-${spec.fps}fps.mp4`;
}

/** Nomes aceitos para download (evita acesso a outros arquivos do disco). */
export const SAFE_VIDEO_NAME = /^[a-z0-9][a-z0-9-]{0,150}\.mp4$/;
