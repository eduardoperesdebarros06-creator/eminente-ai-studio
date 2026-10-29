import { useMemo, useSyncExternalStore } from 'react';
import { validateDraft } from '../../domain/content/validate';
import { dispatchDraft, getDraftSnapshot, subscribeDraft } from './draftStore';

export type { SaveState } from './draftStore';

/** Rascunho compartilhado entre os módulos, com validação derivada. */
export function useContentDraft() {
  const { draft, saveState, recovery } = useSyncExternalStore(subscribeDraft, getDraftSnapshot, getDraftSnapshot);
  const validation = useMemo(() => validateDraft(draft), [draft]);
  return { draft, dispatch: dispatchDraft, validation, saveState, recovery };
}
