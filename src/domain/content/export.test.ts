import { describe, expect, it } from 'vitest';
import { EMPTY_BRIEF } from './brief';
import { createDraft, draftReducer } from './draft';
import { draftToCaptionText, draftToMarkdown, exportFileName, slugify } from './export';
import { buildExternalPrompt } from './prompt';
import { deserializeDraft, serializeDraft } from './serialize';

const sample = () => {
  let d = createDraft({ ...EMPTY_BRIEF, subject: 'Gestão de Marketing com IA', audience: 'CEOs', format: 'motion' });
  d = draftReducer(d, { type: 'template/apply', templateId: 'motion-teaser-15' });
  d = draftReducer(d, { type: 'meta/set', patch: { caption: 'Legenda final', cta: 'Saiba mais' } });
  return draftReducer(d, { type: 'hashtags/set', value: '#ia marketing' });
};

describe('exportação', () => {
  it('gera markdown com todas as cenas, durações e metadados', () => {
    const md = draftToMarkdown(sample());
    expect(md).toMatch(/^# Gestão de Marketing com IA/);
    expect(md).toContain('**Duração total:** 15 s');
    expect(md.match(/^## Cena \d/gm)).toHaveLength(4);
    expect(md).toContain('## Legenda\n\nLegenda final');
    expect(md).toContain('#ia #marketing');
  });

  it('texto da publicação junta legenda, CTA e hashtags', () => {
    expect(draftToCaptionText(sample())).toBe('Legenda final\n\nSaiba mais\n\n#ia #marketing');
  });

  it('nomes de arquivo seguros', () => {
    expect(slugify('Gestão de Marketing: IA & Dados!')).toBe('gestao-de-marketing-ia-dados');
    expect(slugify('***')).toBe('conteudo');
    expect(exportFileName(sample(), 'md', new Date('2026-10-28T12:00:00Z'))).toBe(
      'eminente-motion-gestao-de-marketing-com-ia-2026-10-28.md',
    );
  });
});

describe('serialização (recuperação de rascunho)', () => {
  it('ida e volta preserva o rascunho', () => {
    const d = sample();
    expect(deserializeDraft(JSON.parse(serializeDraft(d)))).toEqual(d);
  });

  it('abre rascunho antigo (sem design) com o design padrão', () => {
    const { design: _omit, ...old } = sample();
    void _omit;
    const opened = deserializeDraft(JSON.parse(JSON.stringify(old)));
    expect(opened?.design).toEqual({ formatId: 'portrait', themeId: 'carvao', handle: '@eminente', showPageNumbers: true, showSwipeHint: true });
  });

  it('corrige campos de design inválidos individualmente', () => {
    const d = { ...sample(), design: { formatId: 'xxx', themeId: 'papel', handle: 42, showPageNumbers: false } };
    expect(deserializeDraft(JSON.parse(JSON.stringify(d)))?.design).toMatchObject({ formatId: 'portrait', themeId: 'papel', handle: '@eminente', showPageNumbers: false });
  });

  it.each([
    ['nulo', null],
    ['versão desconhecida', { ...sample(), schemaVersion: 2 }],
    ['formato inválido', { ...sample(), brief: { ...sample().brief, format: 'video' } }],
    ['página corrompida', { ...sample(), pages: [{ id: 1 }] }],
    ['hashtags inválidas', { ...sample(), hashtags: [1, 2] }],
  ])('rejeita dado %s', (_, value) => {
    expect(deserializeDraft(value)).toBeNull();
  });
});

describe('prompt para IA externa', () => {
  it('inclui briefing, estrutura do template, limites e formato JSON', () => {
    const d = sample();
    const p = buildExternalPrompt(d.brief, 'motion-teaser-15');
    expect(p).toContain('Assunto: Gestão de Marketing com IA');
    expect(p).toContain('Público: CEOs');
    expect(p).toContain('exatamente 4 cenas');
    expect(p).toContain('"duracao"');
    expect(p).toContain('"paginas"');
  });

  it('sem template, usa os limites do formato', () => {
    const p = buildExternalPrompt({ ...EMPTY_BRIEF, subject: 'X', format: 'carousel' });
    expect(p).toContain('entre 2 e 10 slides');
    expect(p).not.toContain('"duracao"');
  });
});
