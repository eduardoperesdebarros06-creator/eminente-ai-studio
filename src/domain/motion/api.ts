import type { VideoProbe, VideoSpec } from './video';

/** Contrato entre a interface e o servidor local de renderização. */

export interface ToolCheck {
  ok: boolean;
  /** Versão encontrada ou o motivo da falha. */
  detail: string;
}

export interface RenderHealth {
  ffmpeg: ToolCheck;
  ffprobe: ToolCheck;
  browser: ToolCheck;
  /** Pasta onde os MP4 são gravados. */
  exportsDir: string;
}

export type JobState = 'starting' | 'rendering' | 'encoding' | 'verifying' | 'done' | 'error' | 'cancelled';

export interface RenderedVideo {
  name: string;
  /** Caminho completo no disco. */
  path: string;
  bytes: number;
  spec: VideoSpec;
  probe: VideoProbe;
}

export interface JobStatus {
  id: string;
  state: JobState;
  framesDone: number;
  totalFrames: number;
  message: string;
  file: RenderedVideo | null;
}

export const isFinished = (s: JobState) => s === 'done' || s === 'error' || s === 'cancelled';

/** Exposto por render.html para o Playwright. */
export interface MotionRenderBridge {
  load(draft: unknown): Promise<{ spec: VideoSpec; issues: string[] }>;
  /** PNG do quadro em base64 (sem o prefixo data:). */
  frame(index: number): string;
}
