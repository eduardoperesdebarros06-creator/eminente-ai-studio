import '@fontsource-variable/inter';
import { deserializeDraft } from '../domain/content/serialize';
import { buildSlideScene, type Scene } from '../domain/design/layout';
import { motionPlan } from '../domain/motion/plan';
import type { MotionRenderBridge } from '../domain/motion/api';
import type { Timeline } from '../domain/motion/timeline';
import { createCanvasMeasurer, ensureFonts } from './canvas';
import { drawMotionFrame } from './motion';

/**
 * Ponte com o servidor de renderização. O servidor abre render.html no
 * Chromium, chama `load(rascunho)` e depois `frame(i)` para cada quadro,
 * recebendo PNGs em base64 na resolução final.
 */
declare global {
  interface Window {
    eminenteMotion?: MotionRenderBridge;
  }
}

let state: { scenes: Scene[]; timeline: Timeline; ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement } | null = null;

window.eminenteMotion = {
  async load(raw) {
    const draft = deserializeDraft(raw);
    if (!draft) throw new Error('Rascunho inválido.');
    await ensureFonts();
    const measure = createCanvasMeasurer();
    const scenes = draft.pages.map((page, index) =>
      buildSlideScene({ page, index, total: draft.pages.length, contentFormat: 'motion', cta: draft.cta, design: draft.design }, measure),
    );
    const { timeline, spec } = motionPlan(draft);
    const canvas = document.createElement('canvas');
    canvas.width = spec.width;
    canvas.height = spec.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível no Chromium.');
    state = { scenes, timeline, ctx, canvas };
    const issues = scenes.flatMap((s, i) => s.issues.map((issue) => `Cena ${i + 1}: ${issue.message}`));
    return { spec, issues };
  },

  frame(index) {
    if (!state) throw new Error('Chame load() antes de frame().');
    drawMotionFrame(state.ctx, state.scenes, state.timeline, index);
    return state.canvas.toDataURL('image/png').slice('data:image/png;base64,'.length);
  },
};

document.documentElement.dataset.ready = 'true';
