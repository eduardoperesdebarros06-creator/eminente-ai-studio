import { useEffect, useMemo, useState } from 'react';
import type { ContentDraft } from '../../domain/content/types';
import { buildSlideScene, type Scene } from '../../domain/design/layout';
import type { Measurer } from '../../domain/design/text';
import { createCanvasMeasurer, ensureFonts } from '../../render/canvas';

type FontState = { status: 'loading' } | { status: 'ready'; measure: Measurer } | { status: 'error'; message: string };

/** Carrega as fontes uma vez e monta as cenas de todas as páginas do rascunho. */
export function useScenes(draft: ContentDraft) {
  const [fonts, setFonts] = useState<FontState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    ensureFonts()
      .then(() => alive && setFonts({ status: 'ready', measure: createCanvasMeasurer() }))
      .catch((e: unknown) => alive && setFonts({ status: 'error', message: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, []);

  const scenes: Scene[] = useMemo(() => {
    if (fonts.status !== 'ready') return [];
    return draft.pages.map((page, index) =>
      buildSlideScene(
        { page, index, total: draft.pages.length, contentFormat: draft.brief.format, cta: draft.cta, design: draft.design },
        fonts.measure,
      ),
    );
  }, [fonts, draft.pages, draft.brief.format, draft.cta, draft.design]);

  return { fonts, scenes };
}
