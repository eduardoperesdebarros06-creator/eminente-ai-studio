import type { ContentFormat } from '../content/types';
import { FORMATS_BY_CONTENT, isFormatId, type FormatId } from './formats';
import { isThemeId, type ThemeId } from './themes';

export type MotionFps = 24 | 30 | 60;
export type MotionTransition = 'fade' | 'slide' | 'cut';
export const MOTION_FPS: readonly MotionFps[] = [24, 30, 60];
export const MOTION_TRANSITIONS: readonly MotionTransition[] = ['fade', 'slide', 'cut'];
export const TRANSITION_LABELS: Record<MotionTransition, string> = { fade: 'Esmaecer', slide: 'Deslizar', cut: 'Corte' };

export interface DesignSettings {
  formatId: FormatId;
  themeId: ThemeId;
  /** Assinatura no rodapé, ex.: "@eminente". Vazio = sem assinatura. */
  handle: string;
  showPageNumbers: boolean;
  showSwipeHint: boolean;
  /** Motion: quadros por segundo do vídeo. */
  fps: MotionFps;
  /** Motion: como o conteúdo sai de uma cena para a próxima. */
  transition: MotionTransition;
}

export const HANDLE_MAX = 30;

export const DEFAULT_DESIGN: DesignSettings = {
  formatId: 'portrait',
  themeId: 'carvao',
  handle: '@eminente',
  showPageNumbers: true,
  showSwipeHint: true,
  fps: 30,
  transition: 'fade',
};

/** Formato efetivo: se o salvo não vale para o tipo de peça, usa o primeiro permitido que for retrato, ou o primeiro. */
export function effectiveFormat(settings: DesignSettings, content: ContentFormat): FormatId {
  const allowed = FORMATS_BY_CONTENT[content];
  if (allowed.includes(settings.formatId)) return settings.formatId;
  return allowed.includes('portrait') ? 'portrait' : allowed[0]!;
}

/** Lê configurações salvas campo a campo; valores inválidos voltam ao padrão. */
export function readDesign(v: unknown): DesignSettings {
  if (typeof v !== 'object' || v === null) return { ...DEFAULT_DESIGN };
  const o = v as Record<string, unknown>;
  return {
    formatId: isFormatId(o.formatId) ? o.formatId : DEFAULT_DESIGN.formatId,
    themeId: isThemeId(o.themeId) ? o.themeId : DEFAULT_DESIGN.themeId,
    handle: typeof o.handle === 'string' ? o.handle.slice(0, HANDLE_MAX) : DEFAULT_DESIGN.handle,
    showPageNumbers: typeof o.showPageNumbers === 'boolean' ? o.showPageNumbers : DEFAULT_DESIGN.showPageNumbers,
    showSwipeHint: typeof o.showSwipeHint === 'boolean' ? o.showSwipeHint : DEFAULT_DESIGN.showSwipeHint,
    fps: MOTION_FPS.includes(o.fps as MotionFps) ? (o.fps as MotionFps) : DEFAULT_DESIGN.fps,
    transition: MOTION_TRANSITIONS.includes(o.transition as MotionTransition) ? (o.transition as MotionTransition) : DEFAULT_DESIGN.transition,
  };
}
