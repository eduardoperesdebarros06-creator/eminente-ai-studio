export const BRIEF_LIMITS = {
  subjectMin: 3,
  subjectMax: 140,
  notesMax: 1000,
} as const;

export interface BriefInput {
  subject: string;
  notes: string;
}

export type BriefErrors = Partial<Record<keyof BriefInput, string>>;

export interface BriefValidation {
  ok: boolean;
  errors: BriefErrors;
  value: BriefInput;
}

/** Normaliza e valida um briefing. Regras compartilhadas com o Content Studio (Fase 2). */
export function validateBrief(input: BriefInput): BriefValidation {
  const value: BriefInput = {
    subject: input.subject.replace(/\s+/g, ' ').trim(),
    notes: input.notes.trim(),
  };
  const errors: BriefErrors = {};

  if (!value.subject) {
    errors.subject = 'Informe o assunto do conteúdo.';
  } else if (value.subject.length < BRIEF_LIMITS.subjectMin) {
    errors.subject = `O assunto precisa de pelo menos ${BRIEF_LIMITS.subjectMin} caracteres.`;
  } else if (value.subject.length > BRIEF_LIMITS.subjectMax) {
    errors.subject = `O assunto pode ter no máximo ${BRIEF_LIMITS.subjectMax} caracteres.`;
  }

  if (value.notes.length > BRIEF_LIMITS.notesMax) {
    errors.notes = `As observações podem ter no máximo ${BRIEF_LIMITS.notesMax} caracteres.`;
  }

  return { ok: Object.keys(errors).length === 0, errors, value };
}
