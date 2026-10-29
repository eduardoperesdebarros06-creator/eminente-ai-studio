import { LIMITS } from './limits';
import type { Brief } from './types';

export const EMPTY_BRIEF: Brief = {
  subject: '',
  objective: 'authority',
  audience: '',
  tone: 'executive',
  format: 'carousel',
  notes: '',
};

export type BriefErrors = Partial<Record<keyof Brief, string>>;

export interface BriefValidation {
  ok: boolean;
  errors: BriefErrors;
  value: Brief;
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Normaliza e valida um briefing. */
export function validateBrief(input: Brief): BriefValidation {
  const value: Brief = {
    ...input,
    subject: collapse(input.subject),
    audience: collapse(input.audience),
    notes: input.notes.trim(),
  };
  const errors: BriefErrors = {};

  if (!value.subject) {
    errors.subject = 'Informe o assunto do conteúdo.';
  } else if (value.subject.length < LIMITS.subject.min) {
    errors.subject = `O assunto precisa de pelo menos ${LIMITS.subject.min} caracteres.`;
  } else if (value.subject.length > LIMITS.subject.max) {
    errors.subject = `O assunto pode ter no máximo ${LIMITS.subject.max} caracteres.`;
  }

  if (value.audience.length > LIMITS.audience.max) {
    errors.audience = `O público pode ter no máximo ${LIMITS.audience.max} caracteres.`;
  }

  if (value.notes.length > LIMITS.notes.max) {
    errors.notes = `As observações podem ter no máximo ${LIMITS.notes.max} caracteres.`;
  }

  return { ok: Object.keys(errors).length === 0, errors, value };
}
