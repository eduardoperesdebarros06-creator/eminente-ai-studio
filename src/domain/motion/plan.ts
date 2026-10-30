import type { ContentDraft } from '../content/types';
import { getFormat } from '../design/formats';
import { effectiveFormat } from '../design/settings';
import { buildTimeline, type Timeline } from './timeline';
import type { VideoSpec } from './video';

/** Linha do tempo e especificação do vídeo de um rascunho de motion. */
export function motionPlan(draft: ContentDraft): { timeline: Timeline; spec: VideoSpec } {
  const { width, height } = getFormat(effectiveFormat(draft.design, 'motion'));
  const timeline = buildTimeline(
    draft.pages.map((p) => p.durationSec),
    draft.design.fps,
    draft.design.transition,
  );
  return {
    timeline,
    spec: { width, height, fps: timeline.fps, totalFrames: timeline.totalFrames, durationSec: timeline.durationSec },
  };
}
