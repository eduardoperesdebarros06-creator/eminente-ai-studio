import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { draftReducer, type DraftAction } from '../../domain/content/draft';
import type { ContentDraft } from '../../domain/content/types';
import { validateDraft } from '../../domain/content/validate';
import { loadDraft, saveDraft, type DraftRecovery } from './draftStorage';

export type SaveState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'saved'; at: Date }
  | { status: 'error' };

const SAVE_DELAY_MS = 400;

function reducer(state: ContentDraft, action: DraftAction): ContentDraft {
  return draftReducer(state, action);
}

/**
 * Estado do rascunho com salvamento automático (debounce) e
 * validação derivada. A recuperação é avaliada uma única vez, na montagem.
 */
export function useContentDraft() {
  const [initial] = useState(loadDraft);
  const [draft, dispatch] = useReducer(reducer, initial.draft);
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState({ status: 'pending' });
    const t = window.setTimeout(() => {
      setSaveState(saveDraft(draft) ? { status: 'saved', at: new Date() } : { status: 'error' });
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [draft]);

  // Garante a gravação do último estado ao sair da página ou do módulo.
  const latest = useRef(draft);
  latest.current = draft;
  useEffect(() => {
    const flush = () => saveDraft(latest.current);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      if (!firstRender.current) flush();
    };
  }, []);

  const validation = useMemo(() => validateDraft(draft), [draft]);

  return { draft, dispatch, validation, saveState, recovery: initial.recovery as DraftRecovery };
}
