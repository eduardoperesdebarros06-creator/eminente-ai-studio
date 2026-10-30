import type { MotionFps, MotionTransition } from '../design/settings';

/**
 * Linha do tempo do motion. É pura (sem DOM): a pré-visualização, a página de
 * renderização (Playwright) e o servidor calculam exatamente os mesmos quadros.
 *
 * As cenas são sequenciais; a duração total é a soma das durações. A transição
 * entre duas cenas fica centrada no limite entre elas, então não altera o total.
 */
export const TRANSITION_MAX_SEC = 0.6;
/** Entrada dos elementos: atraso inicial, intervalo entre grupos e duração. */
export const ENTER_DELAY_SEC = 0.15;
export const ENTER_STAGGER_SEC = 0.12;
export const ENTER_DURATION_SEC = 0.6;
/** Deslocamento vertical inicial dos elementos, em fração do menor lado. */
export const ENTER_RISE = 0.03;

export interface TimelineScene {
  index: number;
  /** Início e fim nominais, em segundos. */
  start: number;
  end: number;
  /** Momento em que a cena começa a aparecer (início da transição de entrada). */
  visibleFrom: number;
}

export interface Timeline {
  fps: MotionFps;
  transition: MotionTransition;
  durationSec: number;
  totalFrames: number;
  scenes: TimelineScene[];
  /** Duração de cada transição (índice i = entre a cena i e a i+1). */
  transitions: number[];
}

export function buildTimeline(durations: readonly number[], fps: MotionFps, transition: MotionTransition): Timeline {
  if (durations.length === 0) throw new Error('A linha do tempo precisa de pelo menos uma cena.');
  for (const d of durations) {
    if (!Number.isFinite(d) || d <= 0) throw new Error(`Duração de cena inválida: ${d}.`);
  }
  const transitions = durations.slice(0, -1).map((d, i) =>
    transition === 'cut' ? 0 : Math.min(TRANSITION_MAX_SEC, d / 2, durations[i + 1]! / 2),
  );
  let t = 0;
  const scenes = durations.map((d, index) => {
    const start = t;
    t += d;
    const half = index > 0 ? transitions[index - 1]! / 2 : 0;
    return { index, start, end: t, visibleFrom: start - half };
  });
  const durationSec = t;
  return { fps, transition, durationSec, totalFrames: Math.round(durationSec * fps), scenes, transitions };
}

export interface FrameLayer {
  sceneIndex: number;
  /** Opacidade da cena inteira (0–1). */
  opacity: number;
  /** Deslocamento horizontal em fração da largura (−1 a 1). */
  offsetX: number;
  /** Segundos desde que a cena começou a aparecer (anima a entrada dos elementos). */
  localSec: number;
}

export const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
export const easeOut = (p: number) => 1 - (1 - p) ** 3;
const clamp01 = (p: number) => Math.min(1, Math.max(0, p));

/** Tempo (s) do início do quadro. */
export const frameTime = (tl: Timeline, frame: number) => frame / tl.fps;

/** Índice da cena ativa no tempo `t` (pelos limites nominais). */
export function sceneAt(tl: Timeline, t: number): number {
  const i = tl.scenes.findIndex((s) => t < s.end);
  return i === -1 ? tl.scenes.length - 1 : i;
}

/**
 * Camadas a desenhar num quadro, de baixo para cima. Fora de transições há uma
 * só; durante uma transição, a cena que sai e a que entra.
 */
export function frameLayers(tl: Timeline, frame: number): FrameLayer[] {
  if (!Number.isInteger(frame) || frame < 0 || frame >= tl.totalFrames) {
    throw new Error(`Quadro ${frame} fora do intervalo 0–${tl.totalFrames - 1}.`);
  }
  const t = frameTime(tl, frame);
  const i = sceneAt(tl, t);
  const layer = (sceneIndex: number, opacity: number, offsetX: number): FrameLayer => ({
    sceneIndex,
    opacity,
    offsetX,
    localSec: Math.max(0, t - tl.scenes[sceneIndex]!.visibleFrom),
  });

  // Transição com a próxima (estamos na metade final da cena i) ou com a anterior (metade inicial).
  const pairs: Array<[number, number]> = [];
  if (i < tl.scenes.length - 1) pairs.push([i, i + 1]);
  if (i > 0) pairs.push([i - 1, i]);
  for (const [a, b] of pairs) {
    const dur = tl.transitions[a]!;
    if (dur <= 0) continue;
    const from = tl.scenes[a]!.end - dur / 2;
    if (t < from || t >= from + dur) continue;
    const p = easeInOut(clamp01((t - from) / dur));
    if (tl.transition === 'fade') return [layer(a, 1, 0), layer(b, p, 0)];
    return [layer(a, 1, -p), layer(b, 1, 1 - p)];
  }
  return [layer(i, 1, 0)];
}

/**
 * Ordem de entrada dos elementos de conteúdo. Elementos fora da lista
 * (fundo, marca, assinatura) ficam fixos durante toda a cena.
 */
const ENTER_GROUP: Readonly<Record<string, number>> = {
  'accent-bar': 0,
  number: 0,
  heading: 1,
  body: 2,
  'cta-pill': 3,
  cta: 3,
};

export interface ElementState {
  opacity: number;
  /** Deslocamento vertical em fração do menor lado da cena. */
  dy: number;
}

const STATIC: ElementState = { opacity: 1, dy: 0 };

export function elementState(id: string, localSec: number): ElementState {
  const group = ENTER_GROUP[id];
  if (group === undefined) return STATIC;
  const p = easeOut(clamp01((localSec - ENTER_DELAY_SEC - group * ENTER_STAGGER_SEC) / ENTER_DURATION_SEC));
  return { opacity: p, dy: (1 - p) * ENTER_RISE };
}

/** "1:05.3" — tempo legível para a interface. */
export function formatTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, '0')}`;
}
