import { describe, expect, it } from 'vitest';
import { EMPTY_BRIEF } from './brief';
import { createDraft, draftReducer, pagesLostOnFormatChange, totalDuration, type DraftAction } from './draft';
import { LIMITS, PAGE_LIMITS } from './limits';
import { TEMPLATES } from './templates';
import type { ContentDraft, ContentFormat } from './types';

const base = (format: ContentFormat = 'carousel'): ContentDraft =>
  createDraft({ ...EMPTY_BRIEF, subject: 'IA no marketing', audience: 'gestores', format }, new Date('2026-01-01T00:00:00Z'));

const run = (d: ContentDraft, ...actions: DraftAction[]) => actions.reduce((acc, a) => draftReducer(acc, a), d);
const roles = (d: ContentDraft) => d.pages.map((p) => p.role);

describe('templates', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s respeita os limites do formato', (_, tpl) => {
    const d = run(base(tpl.format), { type: 'template/apply', templateId: tpl.id });
    const { min, max } = PAGE_LIMITS[tpl.format];
    expect(d.pages.length).toBeGreaterThanOrEqual(min);
    expect(d.pages.length).toBeLessThanOrEqual(max);
    expect(d.source).toBe('template');
    expect(d.pages[0]!.heading.length).toBeGreaterThan(0);
    if (tpl.format === 'motion') expect(totalDuration(d.pages)).toBeLessThanOrEqual(LIMITS.motionTotalMax);
  });

  it('usa o assunto do briefing', () => {
    const d = run(base(), { type: 'template/apply', templateId: 'carousel-tips' });
    expect(d.pages[0]!.heading).toContain('IA no marketing');
  });

  it('ignora template de outro formato', () => {
    const d = base('post');
    expect(draftReducer(d, { type: 'template/apply', templateId: 'carousel-tips' })).toBe(d);
  });
});

describe('estrutura de páginas', () => {
  it('início manual cria páginas em branco com papéis corretos', () => {
    expect(roles(run(base(), { type: 'manual/start' }))).toEqual(['cover', 'content', 'cta']);
    expect(roles(run(base('post'), { type: 'manual/start' }))).toEqual(['cover']);
  });

  it('adiciona, remove e reordena recalculando papéis', () => {
    let d = run(base(), { type: 'manual/start' });
    const [a, b, c] = d.pages.map((p) => p.id);
    d = draftReducer(d, { type: 'page/add', afterId: a });
    expect(d.pages).toHaveLength(4);
    expect(roles(d)).toEqual(['cover', 'content', 'content', 'cta']);
    d = draftReducer(d, { type: 'page/move', id: c!, direction: -1 });
    expect(d.pages[2]!.id).toBe(c);
    expect(roles(d)).toEqual(['cover', 'content', 'content', 'cta']);
    d = draftReducer(d, { type: 'page/remove', id: b! });
    expect(d.pages.map((p) => p.id)).not.toContain(b);
  });

  it('não ultrapassa os limites do formato', () => {
    let d = run(base(), { type: 'manual/start' });
    for (let i = 0; i < 20; i++) d = draftReducer(d, { type: 'page/add' });
    expect(d.pages).toHaveLength(PAGE_LIMITS.carousel.max);
    for (const p of [...d.pages]) d = draftReducer(d, { type: 'page/remove', id: p.id });
    expect(d.pages).toHaveLength(PAGE_LIMITS.carousel.min);
  });

  it('mover além das bordas não altera o rascunho', () => {
    const d = run(base(), { type: 'manual/start' });
    expect(draftReducer(d, { type: 'page/move', id: d.pages[0]!.id, direction: -1 })).toBe(d);
  });

  it('limita a duração das cenas', () => {
    let d = run(base('motion'), { type: 'manual/start' });
    const id = d.pages[0]!.id;
    d = draftReducer(d, { type: 'page/update', id, patch: { durationSec: 99 } });
    expect(d.pages[0]!.durationSec).toBe(LIMITS.sceneDuration.max);
    d = draftReducer(d, { type: 'page/update', id, patch: { durationSec: Number.NaN } });
    expect(d.pages[0]!.durationSec).toBe(LIMITS.sceneDuration.default);
  });
});

describe('troca de formato', () => {
  it('carrossel → post mantém só a primeira página e informa a perda', () => {
    const d = run(base(), { type: 'template/apply', templateId: 'carousel-tips' });
    expect(pagesLostOnFormatChange(d.pages, 'post')).toBe(d.pages.length - 1);
    const post = draftReducer(d, { type: 'format/set', format: 'post' });
    expect(post.brief.format).toBe('post');
    expect(post.pages).toHaveLength(1);
    expect(post.pages[0]!.heading).toBe(d.pages[0]!.heading);
    expect(post.templateId).toBeNull();
  });

  it('post → carrossel completa o mínimo de páginas', () => {
    const d = run(base('post'), { type: 'manual/start' }, { type: 'format/set', format: 'carousel' });
    expect(d.pages).toHaveLength(2);
  });

  it('brief/set não altera o formato (troca é explícita)', () => {
    const d = draftReducer(base(), { type: 'brief/set', brief: { ...EMPTY_BRIEF, subject: 'x', format: 'post' } });
    expect(d.brief.format).toBe('carousel');
    expect(d.brief.subject).toBe('x');
  });
});

describe('importação', () => {
  it('aplica conteúdo importado ajustado ao formato', () => {
    const d = run(base(), {
      type: 'import/apply',
      content: {
        pages: Array.from({ length: 12 }, (_, i) => ({ heading: `P${i + 1}`, body: '' })),
        caption: 'Legenda',
        hashtags: ['ia', '#IA', 'marketing'],
      },
    });
    expect(d.source).toBe('external-ai');
    expect(d.pages).toHaveLength(10);
    expect(roles(d)[0]).toBe('cover');
    expect(roles(d)[9]).toBe('cta');
    expect(d.caption).toBe('Legenda');
    expect(d.hashtags).toEqual(['#ia', '#marketing']);
  });

  it('mantém legenda/CTA existentes quando a importação não os traz', () => {
    let d = run(base(), { type: 'meta/set', patch: { caption: 'Minha legenda', cta: 'Meu CTA' } });
    d = draftReducer(d, { type: 'import/apply', content: { pages: [{ heading: 'A', body: '' }, { heading: 'B', body: '' }] } });
    expect(d.caption).toBe('Minha legenda');
    expect(d.cta).toBe('Meu CTA');
  });
});

it('atualiza updatedAt a cada alteração', () => {
  const d = base();
  const next = draftReducer(d, { type: 'meta/set', patch: { cta: 'x' } }, new Date('2026-02-02T00:00:00Z'));
  expect(next.updatedAt).toBe('2026-02-02T00:00:00.000Z');
  expect(next.createdAt).toBe(d.createdAt);
});
