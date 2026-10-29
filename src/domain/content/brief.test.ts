import { describe, expect, it } from 'vitest';
import { EMPTY_BRIEF, validateBrief } from './brief';
import { LIMITS } from './limits';

const brief = (patch: Partial<typeof EMPTY_BRIEF>) => ({ ...EMPTY_BRIEF, ...patch });

describe('validateBrief', () => {
  it('exige assunto', () => {
    const r = validateBrief(brief({ subject: '   ' }));
    expect(r.ok).toBe(false);
    expect(r.errors.subject).toMatch(/Informe/);
  });

  it('aplica tamanho mínimo e máximo do assunto', () => {
    expect(validateBrief(brief({ subject: 'ab' })).errors.subject).toMatch(/pelo menos/);
    const long = 'a'.repeat(LIMITS.subject.max + 1);
    expect(validateBrief(brief({ subject: long })).errors.subject).toMatch(/no máximo/);
  });

  it('limita público e observações', () => {
    const r = validateBrief(
      brief({ subject: 'Marketing B2B', audience: 'x'.repeat(LIMITS.audience.max + 1), notes: 'x'.repeat(LIMITS.notes.max + 1) }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.audience).toBeDefined();
    expect(r.errors.notes).toBeDefined();
  });

  it('normaliza espaços e aceita entrada válida', () => {
    const r = validateBrief(brief({ subject: '  IA   no  marketing ', audience: ' gestores  de PMEs ', notes: ' tom executivo ' }));
    expect(r.ok).toBe(true);
    expect(r.value.subject).toBe('IA no marketing');
    expect(r.value.audience).toBe('gestores de PMEs');
    expect(r.value.notes).toBe('tom executivo');
  });
});
