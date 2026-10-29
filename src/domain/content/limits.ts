import type { ContentFormat } from './types';

/** Limites de texto e estrutura. Fonte única para validação, contadores e prompt. */
export const LIMITS = {
  subject: { min: 3, max: 140 },
  audience: { max: 120 },
  notes: { max: 1000 },
  heading: { max: 90, recommended: 60 },
  body: { max: 420 },
  caption: { max: 2200 },
  cta: { max: 80 },
  hashtags: { max: 30, tagMax: 40 },
  sceneDuration: { min: 1, max: 15, default: 4 },
  motionTotalMax: 90,
} as const;

export const PAGE_LIMITS: Record<ContentFormat, { min: number; max: number }> = {
  post: { min: 1, max: 1 },
  carousel: { min: 2, max: 10 },
  motion: { min: 1, max: 12 },
};
