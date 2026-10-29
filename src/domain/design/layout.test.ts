import { describe, expect, it } from 'vitest';
import { createPage } from '../content/draft';
import type { ContentFormat, PageRole } from '../content/types';
import { getFormat, OUTPUT_FORMATS } from './formats';
import { buildSlideScene, slideFileName, type Scene } from './layout';
import { DEFAULT_DESIGN, effectiveFormat, type DesignSettings } from './settings';
import { THEMES } from './themes';
import { fitText, wrapText, type FontSpec, type Measurer } from './text';

/** Medidor aproximado: largura média de 0,55 em por caractere, mais o espaçamento. */
const measure: Measurer = (text: string, font: FontSpec) => [...text].length * font.size * (0.55 + font.letterSpacing);

describe('wrapText', () => {
  const font: FontSpec = { size: 10, weight: 400, letterSpacing: 0 }; // 5,5 px por caractere

  it('quebra por palavras sem ultrapassar a largura', () => {
    const lines = wrapText('um dois tres quatro cinco seis', font, 60, measure);
    expect(lines).toEqual(['um dois', 'tres', 'quatro', 'cinco seis']);
    for (const l of lines) expect(measure(l, font)).toBeLessThanOrEqual(60);
  });

  it('respeita quebras explícitas e ignora espaços extras', () => {
    expect(wrapText('a  b\nc', font, 1000, measure)).toEqual(['a b', 'c']);
  });

  it('quebra palavras maiores que a linha', () => {
    const lines = wrapText('supercalifragilistico', font, 30, measure);
    expect(lines.join('')).toBe('supercalifragilistico');
    for (const l of lines) expect(measure(l, font)).toBeLessThanOrEqual(30);
  });
});

describe('fitText', () => {
  const opts = { maxWidth: 500, maxHeight: 400, maxLines: 3, maxSize: 100, minSize: 40, weight: 800, letterSpacing: 0, leading: 1 };

  it('usa o tamanho máximo quando o texto é curto', () => {
    const r = fitText('Curto', opts, measure);
    expect(r.font.size).toBe(100);
    expect(r.overflow).toBe(false);
  });

  it('reduz o tamanho até caber', () => {
    const r = fitText('Um título bem mais longo que precisa encolher para caber', opts, measure);
    expect(r.overflow).toBe(false);
    expect(r.font.size).toBeLessThan(100);
    expect(r.lines.length).toBeLessThanOrEqual(3);
  });

  it('marca estouro quando nem o mínimo cabe', () => {
    const r = fitText('palavra '.repeat(80), opts, measure);
    expect(r.overflow).toBe(true);
    expect(r.font.size).toBe(40);
  });
});

function scene(role: PageRole, heading: string, body: string, opts: { format?: ContentFormat; index?: number; total?: number; cta?: string; design?: Partial<DesignSettings> } = {}): Scene {
  const total = opts.total ?? 5;
  return buildSlideScene(
    {
      page: createPage(role, heading, body),
      index: opts.index ?? 0,
      total,
      contentFormat: opts.format ?? 'carousel',
      cta: opts.cta ?? '',
      design: { ...DEFAULT_DESIGN, ...opts.design },
    },
    measure,
  );
}

const byId = (s: Scene, id: string) => s.elements.find((e) => e.id === id);

function assertInside(s: Scene) {
  for (const e of s.elements) {
    if (e.kind === 'rect') {
      expect(e.x, e.id).toBeGreaterThanOrEqual(0);
      expect(e.y, e.id).toBeGreaterThanOrEqual(0);
      expect(e.x + e.w, e.id).toBeLessThanOrEqual(s.width);
      expect(e.y + e.h, e.id).toBeLessThanOrEqual(s.height);
    }
    if (e.kind === 'text') {
      expect(e.y, e.id).toBeGreaterThanOrEqual(0);
      expect(e.y + e.lines.length * e.lineHeight, e.id).toBeLessThanOrEqual(s.height);
      for (const line of e.lines) expect(measure(line, e.font), `${e.id}: ${line}`).toBeLessThanOrEqual(e.maxWidth + 0.5);
      const left = e.align === 'left' ? e.x : e.x - e.maxWidth;
      expect(left, e.id).toBeGreaterThanOrEqual(0);
    }
  }
}

describe('buildSlideScene', () => {
  it.each(OUTPUT_FORMATS.map((f) => [f.id] as const))('dimensões e limites corretos no formato %s', (formatId) => {
    for (const role of ['cover', 'content', 'cta'] as const) {
      const s = scene(role, 'Como a IA muda a gestão de marketing', 'Dados próprios, objetivos claros e métricas antes de ferramentas.', {
        format: 'post',
        design: { formatId },
        cta: 'Salve este post',
      });
      expect([s.width, s.height]).toEqual([getFormat(formatId).width, getFormat(formatId).height]);
      expect(s.issues).toEqual([]);
      assertInside(s);
    }
  });

  it('todos os temas produzem cena válida', () => {
    for (const t of THEMES) {
      const s = scene('cover', 'Título', 'Texto', { design: { themeId: t.id } });
      expect(s.background).toBe(t.background);
      expect(byId(s, 'glow') !== undefined).toBe(t.glow);
    }
  });

  it('carrossel mostra numeração e "arraste" exceto na última página', () => {
    const first = scene('cover', 'Capa', '', { index: 0, total: 7 });
    expect(byId(first, 'counter')).toMatchObject({ lines: ['01 / 07'] });
    expect(byId(first, 'swipe')).toBeDefined();
    const last = scene('cta', 'Fim', '', { index: 6, total: 7, cta: 'Siga' });
    expect(byId(last, 'swipe')).toBeUndefined();
    const off = scene('cover', 'Capa', '', { design: { showPageNumbers: false, showSwipeHint: false } });
    expect(byId(off, 'counter')).toBeUndefined();
    expect(byId(off, 'swipe')).toBeUndefined();
  });

  it('post não tem numeração nem "arraste"', () => {
    const s = scene('cover', 'Post', 'Texto', { format: 'post', total: 1 });
    expect(byId(s, 'counter')).toBeUndefined();
    expect(byId(s, 'swipe')).toBeUndefined();
  });

  it('assinatura vazia não é desenhada', () => {
    expect(byId(scene('cover', 'X', '', { design: { handle: '  ' } }), 'handle')).toBeUndefined();
    expect(byId(scene('cover', 'X', '', { design: { handle: '@marca' } }), 'handle')).toMatchObject({ lines: ['@marca'] });
  });

  it('página de conteúdo mostra o número da página', () => {
    expect(byId(scene('content', 'Dica', 'Texto', { index: 2 }), 'number')).toMatchObject({ lines: ['03'] });
  });

  it('chamada final desenha a pílula de CTA e não repete o texto igual ao CTA', () => {
    const s = scene('cta', 'Gostou?', 'Salve este post', { cta: 'Salve este post', index: 4 });
    expect(byId(s, 'cta-pill')).toBeDefined();
    expect(byId(s, 'cta')).toMatchObject({ lines: ['Salve este post'] });
    expect(byId(s, 'body')).toBeUndefined();
  });

  it('aponta título que não cabe e limita as linhas com reticências', () => {
    const s = scene('content', 'palavra '.repeat(60), '');
    expect(s.issues.some((i) => i.field === 'heading')).toBe(true);
    const h = byId(s, 'heading');
    expect(h?.kind === 'text' && h.lines.length <= 4 && h.lines[h.lines.length - 1]!.endsWith('…')).toBe(true);
    assertInside(s);
    // O mesmo vale para capa e chamada final.
    for (const role of ['cover', 'cta'] as const) {
      const r = scene(role, 'palavra '.repeat(60), '', { cta: 'Siga' });
      expect(r.issues.some((i) => i.field === 'heading'), role).toBe(true);
      assertInside(r);
    }
  });

  it('aponta texto de apoio longo demais', () => {
    const s = scene('cover', 'Capa', 'frase longa de apoio '.repeat(20));
    expect(s.issues.some((i) => i.field === 'body')).toBe(true);
    assertInside(s);
  });

  it('aponta título vazio', () => {
    expect(scene('cover', '  ', '').issues.some((i) => i.message.includes('vazio'))).toBe(true);
  });

  it('carrossel com formato inválido usa retrato', () => {
    expect(effectiveFormat({ ...DEFAULT_DESIGN, formatId: 'story' }, 'carousel')).toBe('portrait');
    expect(scene('cover', 'X', '', { design: { formatId: 'landscape' } })).toMatchObject({ width: 1080, height: 1350 });
  });
});

describe('slideFileName', () => {
  it('numera páginas de carrossel e omite número em post', () => {
    expect(slideFileName('eminente-x', 0, 7, 'cover', 1080, 1350)).toBe('eminente-x-01-capa-1080x1350.png');
    expect(slideFileName('eminente-x', 6, 7, 'cta', 1080, 1350)).toBe('eminente-x-07-chamada-1080x1350.png');
    expect(slideFileName('eminente-x', 0, 1, 'cover', 1080, 1920)).toBe('eminente-x-1080x1920.png');
  });
});
