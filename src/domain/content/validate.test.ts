import { describe, expect, it } from 'vitest';
import { EMPTY_BRIEF } from './brief';
import { createDraft, createPage, draftReducer } from './draft';
import { LIMITS } from './limits';
import type { ContentDraft, ContentFormat } from './types';
import { hasPlaceholder, validateDraft } from './validate';

function draft(format: ContentFormat, pages: Array<[string, string, number?]>, patch: Partial<ContentDraft> = {}) {
  const d = createDraft({ ...EMPTY_BRIEF, subject: 'Teste', format });
  return {
    ...d,
    caption: 'Legenda',
    ...patch,
    pages: pages.map(([h, b, s], i) => createPage(i === 0 ? 'cover' : 'content', h, b, s)),
  };
}

describe('validateDraft', () => {
  it('aceita um carrossel completo', () => {
    const r = validateDraft(draft('carousel', [['Capa', 'a'], ['Dica', 'b'], ['Fim', 'c']]));
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it('exige título em todas as páginas', () => {
    const r = validateDraft(draft('carousel', [['Capa', ''], ['  ', 'b']]));
    expect(r.ok).toBe(false);
    expect(r.errors[0]!.message).toMatch(/Página 2: o título é obrigatório/);
  });

  it('valida quantidade de páginas por formato', () => {
    expect(validateDraft(draft('post', [['A', ''], ['B', '']])).errors[0]!.message).toMatch(/exatamente 1/);
    expect(validateDraft(draft('carousel', [['A', '']])).errors[0]!.message).toMatch(/entre 2 e 10/);
  });

  it('distingue erro (excede máximo) de aviso (acima do recomendado)', () => {
    const warn = validateDraft(draft('post', [['x'.repeat(LIMITS.heading.recommended + 1), '']]));
    expect(warn.ok).toBe(true);
    expect(warn.warnings.some((w) => w.field === 'heading')).toBe(true);
    const err = validateDraft(draft('post', [['x'.repeat(LIMITS.heading.max + 1), '']]));
    expect(err.ok).toBe(false);
  });

  it('valida duração total do motion', () => {
    const pages = Array.from({ length: 7 }, (_, i): [string, string, number] => [`Cena ${i}`, '', 15]);
    const r = validateDraft(draft('motion', pages));
    expect(r.errors.some((e) => e.field === 'duration')).toBe(true);
  });

  it('avisa sobre marcadores de template pendentes', () => {
    const d = draftReducer(createDraft({ ...EMPTY_BRIEF, subject: 'IA', format: 'carousel' }), { type: 'template/apply', templateId: 'carousel-tips' });
    const r = validateDraft(d);
    expect(r.warnings.some((w) => /colchetes/.test(w.message))).toBe(true);
  });

  it('avisa sobre legenda vazia e erra com hashtags demais', () => {
    const r = validateDraft(draft('post', [['A', '']], { caption: '', hashtags: Array.from({ length: 31 }, (_, i) => `#t${i}`) }));
    expect(r.warnings.some((w) => w.field === 'caption')).toBe(true);
    expect(r.errors.some((e) => e.field === 'hashtags')).toBe(true);
  });
});

describe('hasPlaceholder', () => {
  it('detecta [marcadores] mas não colchetes vazios ou multilinha', () => {
    expect(hasPlaceholder('Dica [1]')).toBe(true);
    expect(hasPlaceholder('sem nada')).toBe(false);
    expect(hasPlaceholder('[]')).toBe(false);
    expect(hasPlaceholder('[abre\nfecha]')).toBe(false);
  });
});
