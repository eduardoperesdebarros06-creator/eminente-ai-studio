import { describe, expect, it } from 'vitest';
import { BRIEF_LIMITS, validateBrief } from './brief';

describe('validateBrief', () => {
  it('exige assunto', () => {
    const r = validateBrief({ subject: '   ', notes: '' });
    expect(r.ok).toBe(false);
    expect(r.errors.subject).toMatch(/Informe/);
  });

  it('aplica tamanho mínimo e máximo do assunto', () => {
    expect(validateBrief({ subject: 'ab', notes: '' }).errors.subject).toMatch(/pelo menos/);
    const long = 'a'.repeat(BRIEF_LIMITS.subjectMax + 1);
    expect(validateBrief({ subject: long, notes: '' }).errors.subject).toMatch(/no máximo/);
  });

  it('limita observações', () => {
    const r = validateBrief({ subject: 'Marketing B2B', notes: 'x'.repeat(BRIEF_LIMITS.notesMax + 1) });
    expect(r.ok).toBe(false);
    expect(r.errors.notes).toBeDefined();
  });

  it('normaliza espaços e aceita entrada válida', () => {
    const r = validateBrief({ subject: '  IA   no  marketing ', notes: ' tom executivo ' });
    expect(r).toEqual({
      ok: true,
      errors: {},
      value: { subject: 'IA no marketing', notes: 'tom executivo' },
    });
  });
});
