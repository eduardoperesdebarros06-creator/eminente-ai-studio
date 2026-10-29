import type { DesignSettings } from '../design/settings';

export type ContentFormat = 'post' | 'carousel' | 'motion';
export type Objective = 'awareness' | 'engagement' | 'conversion' | 'authority';
export type Tone = 'executive' | 'didactic' | 'inspiring' | 'provocative';

export interface Brief {
  subject: string;
  objective: Objective;
  audience: string;
  tone: Tone;
  format: ContentFormat;
  notes: string;
}

/** Papel da página na narrativa: capa, desenvolvimento ou chamada final. */
export type PageRole = 'cover' | 'content' | 'cta';

/**
 * Unidade de conteúdo. Para post há uma página; para carrossel, uma por slide;
 * para motion, uma por cena (com duração em segundos).
 */
export interface ContentPage {
  id: string;
  role: PageRole;
  heading: string;
  body: string;
  /** Usado apenas em motion. Mantido nos demais formatos para conversões sem perda. */
  durationSec: number;
}

/** De onde veio o texto atual do rascunho. */
export type DraftSource = 'template' | 'external-ai' | 'manual';

export interface ContentDraft {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  brief: Brief;
  templateId: string | null;
  source: DraftSource;
  pages: ContentPage[];
  caption: string;
  cta: string;
  hashtags: string[];
  /** Aparência das peças (formato, tema, assinatura). Usado pelos estúdios visuais. */
  design: DesignSettings;
}

export const FORMAT_LABELS: Record<ContentFormat, string> = {
  post: 'Post',
  carousel: 'Carrossel',
  motion: 'Motion',
};

export const OBJECTIVE_LABELS: Record<Objective, string> = {
  awareness: 'Alcance e reconhecimento',
  engagement: 'Engajamento',
  conversion: 'Conversão',
  authority: 'Autoridade',
};

export const TONE_LABELS: Record<Tone, string> = {
  executive: 'Executivo',
  didactic: 'Didático',
  inspiring: 'Inspirador',
  provocative: 'Provocativo',
};

export const ROLE_LABELS: Record<PageRole, string> = {
  cover: 'Capa',
  content: 'Conteúdo',
  cta: 'Chamada final',
};

export const isFormat = (v: unknown): v is ContentFormat => v === 'post' || v === 'carousel' || v === 'motion';
export const isObjective = (v: unknown): v is Objective => typeof v === 'string' && v in OBJECTIVE_LABELS;
export const isTone = (v: unknown): v is Tone => typeof v === 'string' && v in TONE_LABELS;
export const isRole = (v: unknown): v is PageRole => v === 'cover' || v === 'content' || v === 'cta';
