import type { Scene } from '../domain/design/layout';
import { elementState, frameLayers, type Timeline } from '../domain/motion/timeline';
import { drawElement } from './canvas';

/**
 * Desenha um quadro do motion. Usado pela pré-visualização (em escala menor)
 * e pela página de renderização do Playwright (em resolução final): os dois
 * caminhos produzem o mesmo desenho.
 */
export function drawMotionFrame(
  ctx: CanvasRenderingContext2D,
  scenes: readonly Scene[],
  timeline: Timeline,
  frame: number,
  scale = 1,
): void {
  const first = scenes[0];
  if (!first) return;
  const { width: W, height: H } = first;
  const unit = Math.min(W, H);
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = first.background;
  ctx.fillRect(0, 0, W, H);
  for (const layer of frameLayers(timeline, frame)) {
    const scene = scenes[layer.sceneIndex];
    if (!scene) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.translate(layer.offsetX * W, 0);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.fillStyle = scene.background;
    ctx.fillRect(0, 0, W, H);
    for (const el of scene.elements) {
      const st = elementState(el.id, layer.localSec);
      if (st.opacity <= 0) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity * st.opacity;
      if (st.dy) ctx.translate(0, st.dy * unit);
      drawElement(ctx, el, scene);
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}
