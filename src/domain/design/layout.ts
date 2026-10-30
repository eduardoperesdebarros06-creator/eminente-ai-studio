import type { ContentFormat, ContentPage } from '../content/types';
import { effectiveFormat, type DesignSettings } from './settings';
import { getFormat, type FormatId } from './formats';
import { getTheme, type Theme } from './themes';
import { fitText, wrapText, type FitOptions, type FontSpec, type Measurer } from './text';

/**
 * Monta a "cena" de uma página: elementos com posição e tamanho finais em
 * pixels. É puro (sem DOM): o mesmo resultado alimenta a pré-visualização,
 * a exportação PNG e os quadros do vídeo (motion).
 */
export type SceneElement =
  | { kind: 'rect'; id: string; x: number; y: number; w: number; h: number; fill: string; radius: number }
  | { kind: 'glow'; id: string; cx: number; cy: number; r: number; color: string; opacity: number }
  | {
      kind: 'text';
      id: string;
      x: number;
      y: number;
      maxWidth: number;
      lines: string[];
      font: FontSpec;
      lineHeight: number;
      color: string;
      align: 'left' | 'right';
    };

export interface SceneIssue {
  field: 'heading' | 'body' | 'cta';
  message: string;
}

export interface Scene {
  width: number;
  height: number;
  formatId: FormatId;
  background: string;
  elements: SceneElement[];
  issues: SceneIssue[];
}

export interface SlideInput {
  page: ContentPage;
  index: number;
  total: number;
  contentFormat: ContentFormat;
  /** CTA do rascunho, usado na página de chamada final. */
  cta: string;
  design: DesignSettings;
}

const ELLIPSIS = '…';

/**
 * Limita as linhas e marca o corte com reticências, garantindo que a última
 * linha (com "…") continue dentro da largura.
 */
function clampLines(lines: string[], max: number, font: FontSpec, maxWidth: number, measure: Measurer): string[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, Math.max(1, max));
  let last = kept[kept.length - 1]!.replace(/[\s.,;:]+$/, '');
  while (last && measure(`${last}${ELLIPSIS}`, font) > maxWidth) {
    const cut = last.lastIndexOf(' ');
    last = (cut > 0 ? last.slice(0, cut) : last.slice(0, -1)).replace(/[\s.,;:]+$/, '');
  }
  kept[kept.length - 1] = `${last}${ELLIPSIS}`;
  return kept;
}

export function buildSlideScene(input: SlideInput, measure: Measurer): Scene {
  const { page, index, total, contentFormat, design } = input;
  const formatId = effectiveFormat(design, contentFormat);
  const { width: W, height: H } = getFormat(formatId);
  const theme: Theme = getTheme(design.themeId);

  const u = Math.min(W, H) / 100;
  const m = 8 * u;
  const textW = Math.min(W - 2 * m, 92 * u);
  const elements: SceneElement[] = [];
  const issues: SceneIssue[] = [];
  const isCarousel = contentFormat === 'carousel';
  const isLast = index === total - 1;

  // ---------- Fundo
  if (theme.glow) {
    elements.push({ kind: 'glow', id: 'glow', cx: W * 0.96, cy: H * 0.98, r: Math.max(W, H) * 0.62, color: theme.accent, opacity: 0.26 });
  }

  // ---------- Cabeçalho: marca + numeração
  const metaFont: FontSpec = { size: Math.round(2.1 * u), weight: 700, letterSpacing: 0.22 };
  const metaLH = Math.round(metaFont.size * 1.2);
  const mark = Math.round(1.5 * u);
  elements.push({ kind: 'rect', id: 'brand-mark', x: m, y: m + (metaLH - mark) / 2, w: mark, h: mark, fill: theme.accent, radius: 0 });
  elements.push({
    kind: 'text', id: 'brand', x: m + mark + 1.2 * u, y: m, maxWidth: textW, lines: ['EMINENTE'], font: metaFont,
    lineHeight: metaLH, color: theme.text, align: 'left',
  });
  if (isCarousel && design.showPageNumbers) {
    const counter = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    elements.push({
      kind: 'text', id: 'counter', x: W - m, y: m, maxWidth: textW / 2, lines: [counter],
      font: { ...metaFont, weight: 600, letterSpacing: 0.08 }, lineHeight: metaLH, color: theme.muted, align: 'right',
    });
  }

  // ---------- Rodapé: assinatura + "arraste"
  const footY = H - m - metaLH;
  const handle = design.handle.trim();
  if (handle) {
    elements.push({
      kind: 'text', id: 'handle', x: m, y: footY, maxWidth: textW / 2, lines: [handle],
      font: { ...metaFont, weight: 500, letterSpacing: 0.02 }, lineHeight: metaLH, color: theme.muted, align: 'left',
    });
  }
  if (isCarousel && design.showSwipeHint && !isLast) {
    elements.push({
      kind: 'text', id: 'swipe', x: W - m, y: footY, maxWidth: textW / 2, lines: ['Arraste →'],
      font: { ...metaFont, weight: 600, letterSpacing: 0.04 }, lineHeight: metaLH, color: theme.accent === theme.background ? theme.text : theme.accent,
      align: 'right',
    });
  }

  // ---------- Área de conteúdo
  const areaTop = m + metaLH + 7 * u;
  const areaBottom = footY - 6 * u;
  const areaH = areaBottom - areaTop;
  const heading = page.heading.trim();
  const body = page.body.trim();
  const isPost = contentFormat === 'post';
  const role = isPost ? 'cover' : page.role;

  interface TextBlock {
    lines: string[];
    font: FontSpec;
    lineHeight: number;
    height: number;
    overflow: boolean;
  }
  const EMPTY_BLOCK: TextBlock = { lines: [], font: { size: 0, weight: 400, letterSpacing: 0 }, lineHeight: 0, height: 0, overflow: false };
  /** Texto de apoio em tamanho fixo, limitado a `maxLines`. */
  const bodyBlock = (size: number, leading: number, maxLines: number): TextBlock => {
    if (!body) return EMPTY_BLOCK;
    const font: FontSpec = { size: Math.round(size), weight: 400, letterSpacing: 0 };
    const lineHeight = Math.round(font.size * leading);
    const all = wrapText(body, font, textW, measure);
    const lines = clampLines(all, maxLines, font, textW, measure);
    return { lines, font, lineHeight, height: lines.length * lineHeight, overflow: all.length > maxLines };
  };

  /** Título ajustado ao espaço; se não couber, corta respeitando linhas E altura. */
  const headingBlock = (opts: Omit<FitOptions, 'maxWidth'>): TextBlock => {
    const fit = fitText(heading, { ...opts, maxWidth: textW }, measure);
    const limit = Math.max(1, Math.min(opts.maxLines, Math.floor(opts.maxHeight / fit.lineHeight)));
    const lines = fit.overflow ? clampLines(fit.lines, limit, fit.font, textW, measure) : fit.lines;
    if (fit.overflow) issues.push({ field: 'heading', message: 'o título não cabe no layout.' });
    return { lines, font: fit.font, lineHeight: fit.lineHeight, height: lines.length * fit.lineHeight, overflow: fit.overflow };
  };

  const pushText = (id: string, y: number, lines: string[], font: FontSpec, lineHeight: number, color: string) => {
    if (lines.length) elements.push({ kind: 'text', id, x: m, y, maxWidth: textW, lines, font, lineHeight, color, align: 'left' });
  };

  if (role === 'cover') {
    // Barra de destaque, título grande e apoio, alinhados à base da área.
    const b = bodyBlock(3.3 * u, 1.42, isPost ? 6 : 3);
    if (b.overflow) issues.push({ field: 'body', message: `o texto passa de ${isPost ? 6 : 3} linhas no layout.` });
    const barH = Math.round(0.9 * u);
    const barGap = 3.6 * u;
    const bodyGap = b.height ? 3 * u : 0;
    const h = headingBlock({
      maxHeight: areaH - barH - barGap - b.height - bodyGap, maxLines: 6,
      maxSize: Math.round(9.4 * u), minSize: Math.round(5 * u), weight: 800, letterSpacing: -0.035, leading: 1.04,
    });
    const blockH = barH + barGap + h.height + bodyGap + b.height;
    let y = Math.max(areaTop, areaBottom - blockH);
    elements.push({ kind: 'rect', id: 'accent-bar', x: m, y, w: Math.round(9 * u), h: barH, fill: theme.accent, radius: 0 });
    y += barH + barGap;
    pushText('heading', y, h.lines, h.font, h.lineHeight, theme.text);
    y += h.height + bodyGap;
    pushText('body', y, b.lines, b.font, b.lineHeight, theme.muted);
  } else if (role === 'content') {
    // Número grande em destaque, título e texto. O bloco começa numa altura fixa
    // (igual em todos os slides, para manter o ritmo ao passar o carrossel) e só
    // sobe quando o conteúdo é alto demais.
    const numFont: FontSpec = { size: Math.round(7 * u), weight: 800, letterSpacing: -0.04 };
    const numLH = Math.round(numFont.size * 1.0);
    const numGap = 3.4 * u;
    const remaining = areaH - numLH - numGap;
    const bodyLH = Math.round(3.4 * u * 1.45);
    const bodyGap = body ? 2.8 * u : 0;
    // Até ~60% da área restante para o texto; o título ocupa o resto.
    const bodyMaxLines = Math.min(10, Math.max(2, Math.floor((remaining * 0.62) / bodyLH)));
    const b = bodyBlock(3.4 * u, 1.45, bodyMaxLines);
    if (b.overflow) issues.push({ field: 'body', message: `o texto passa de ${bodyMaxLines} linhas no layout.` });
    const h = headingBlock({
      maxHeight: remaining - b.height - bodyGap, maxLines: 4,
      maxSize: Math.round(6.4 * u), minSize: Math.round(4.2 * u), weight: 800, letterSpacing: -0.03, leading: 1.08,
    });
    const blockH = numLH + numGap + h.height + bodyGap + b.height;
    let y = areaTop + Math.min(areaH * 0.12, Math.max(0, areaH - blockH));
    elements.push({
      kind: 'text', id: 'number', x: m, y, maxWidth: textW, lines: [String(index + 1).padStart(2, '0')],
      font: numFont, lineHeight: numLH, color: theme.accent === theme.background ? theme.text : theme.accent, align: 'left',
    });
    y += numLH + numGap;
    pushText('heading', y, h.lines, h.font, h.lineHeight, theme.text);
    y += h.height + bodyGap;
    pushText('body', y, b.lines, b.font, b.lineHeight, theme.muted);
  } else {
    // Chamada final: título, apoio (se diferente do CTA) e pílula com o CTA, centralizados na vertical.
    const cta = input.cta.trim();
    const showBody = body && body !== cta;
    const b = showBody ? bodyBlock(3.3 * u, 1.42, 3) : EMPTY_BLOCK;
    if (showBody && b.overflow) issues.push({ field: 'body', message: 'o texto passa de 3 linhas no layout.' });

    const pillFont: FontSpec = { size: Math.round(3 * u), weight: 700, letterSpacing: 0 };
    const padX = 3 * u;
    const pillH = Math.round(pillFont.size * 1.2 + 3.6 * u);
    const pillText = cta;
    const pillTextW = pillText ? measure(pillText, pillFont) : 0;
    if (pillText && pillTextW > textW - 2 * padX) issues.push({ field: 'cta', message: 'o CTA é longo demais para caber em uma linha.' });
    const pillGap = pillText ? 4.4 * u : 0;
    const bodyGap = b.height ? 3 * u : 0;
    const h = headingBlock({
      maxHeight: areaH - b.height - bodyGap - (pillText ? pillH + pillGap : 0), maxLines: 5,
      maxSize: Math.round(8 * u), minSize: Math.round(4.6 * u), weight: 800, letterSpacing: -0.035, leading: 1.06,
    });
    const blockH = h.height + bodyGap + b.height + (pillText ? pillGap + pillH : 0);
    let y = Math.max(areaTop, areaTop + (areaH - blockH) / 2);
    pushText('heading', y, h.lines, h.font, h.lineHeight, theme.text);
    y += h.height + bodyGap;
    pushText('body', y, b.lines, b.font, b.lineHeight, theme.muted);
    y += b.height + pillGap;
    if (pillText) {
      const pillW = Math.min(textW, pillTextW + 2 * padX);
      elements.push({ kind: 'rect', id: 'cta-pill', x: m, y, w: pillW, h: pillH, fill: theme.accent, radius: pillH / 2 });
      elements.push({
        kind: 'text', id: 'cta', x: m + padX, y: y + (pillH - pillFont.size * 1.2) / 2, maxWidth: pillW - 2 * padX,
        lines: [pillText], font: pillFont, lineHeight: Math.round(pillFont.size * 1.2), color: theme.onAccent, align: 'left',
      });
    }
  }

  if (!heading) issues.push({ field: 'heading', message: 'o título está vazio.' });

  return { width: W, height: H, formatId, background: theme.background, elements, issues };
}

/** Nome do arquivo PNG de uma página. */
export function slideFileName(base: string, index: number, total: number, role: ContentPage['role'], w: number, h: number): string {
  const roleSlug = role === 'cover' ? 'capa' : role === 'cta' ? 'chamada' : 'conteudo';
  return total === 1 ? `${base}-${w}x${h}.png` : `${base}-${String(index + 1).padStart(2, '0')}-${roleSlug}-${w}x${h}.png`;
}
