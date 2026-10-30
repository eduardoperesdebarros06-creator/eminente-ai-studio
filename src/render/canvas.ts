import type { Scene, SceneElement } from '../domain/design/layout';
import type { FontSpec, Measurer } from '../domain/design/text';

/**
 * Desenho de cenas no Canvas 2D. Medição e desenho usam exatamente a mesma
 * configuração de fonte, para que a quebra de linha calculada no layout seja a
 * mesma que aparece no PNG.
 */
export const FONT_FAMILY = '"Inter Variable"';
const WEIGHTS = [400, 500, 600, 700, 800] as const;
const SAMPLE = 'EMINENTE Aa Çç ÁÉÍÓÚ ãõ → … 0123456789';

const supportsLetterSpacing =
  typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;

export const fontString = (f: FontSpec) => `${f.weight} ${f.size}px ${FONT_FAMILY}`;

function applyFont(ctx: CanvasRenderingContext2D, f: FontSpec) {
  ctx.font = fontString(f);
  if (supportsLetterSpacing) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(f.letterSpacing * f.size).toFixed(2)}px`;
  }
}

let fontsPromise: Promise<void> | null = null;

/** Garante que a Inter (empacotada no app) esteja carregada nos pesos usados. */
export function ensureFonts(): Promise<void> {
  fontsPromise ??= (async () => {
    await Promise.all(WEIGHTS.map((w) => document.fonts.load(`${w} 40px ${FONT_FAMILY}`, SAMPLE)));
    const missing = WEIGHTS.filter((w) => !document.fonts.check(`${w} 40px ${FONT_FAMILY}`, SAMPLE));
    if (missing.length) {
      throw new Error(`A fonte Inter não carregou (pesos ${missing.join(', ')}). A exportação foi bloqueada para não gerar imagens com a fonte errada.`);
    }
  })().catch((e: unknown) => {
    fontsPromise = null; // permite nova tentativa
    throw e;
  });
  return fontsPromise;
}

/** Medidor baseado em Canvas; chame somente depois de `ensureFonts()`. */
export function createCanvasMeasurer(): Measurer {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador.');
  const cache = new Map<string, number>();
  return (text, font) => {
    const key = `${font.weight}|${font.size}|${font.letterSpacing}|${text}`;
    let w = cache.get(key);
    if (w === undefined) {
      applyFont(ctx, font);
      w = ctx.measureText(text).width;
      if (cache.size > 5000) cache.clear();
      cache.set(key, w);
    }
    return w;
  };
}

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function drawElement(ctx: CanvasRenderingContext2D, el: SceneElement, scene: Scene) {
  switch (el.kind) {
    case 'rect':
      ctx.fillStyle = el.fill;
      ctx.beginPath();
      if (el.radius > 0) ctx.roundRect(el.x, el.y, el.w, el.h, el.radius);
      else ctx.rect(el.x, el.y, el.w, el.h);
      ctx.fill();
      return;
    case 'glow': {
      const g = ctx.createRadialGradient(el.cx, el.cy, 0, el.cx, el.cy, el.r);
      g.addColorStop(0, rgba(el.color, el.opacity));
      g.addColorStop(1, rgba(el.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, scene.width, scene.height);
      return;
    }
    case 'text':
      applyFont(ctx, el.font);
      ctx.fillStyle = el.color;
      ctx.textAlign = el.align;
      ctx.textBaseline = 'middle';
      el.lines.forEach((line, i) => {
        ctx.fillText(line, el.x, el.y + i * el.lineHeight + el.lineHeight / 2);
      });
      return;
  }
}

/** Desenha a cena; `scale` permite miniaturas com o mesmo layout. */
export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, scale = 1): void {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = scene.background;
  ctx.fillRect(0, 0, scene.width, scene.height);
  for (const el of scene.elements) drawElement(ctx, el, scene);
  ctx.restore();
}
