import { draftReducer, type DraftAction } from '../../domain/content/draft';
import type { ContentDraft } from '../../domain/content/types';
import { loadDraft, saveDraft, type DraftRecovery } from './draftStorage';

/**
 * Fonte única do rascunho em andamento, compartilhada por todos os módulos.
 * O estado vive em memória; o navegador recebe uma cópia (com debounce) e,
 * ao sair da página, a gravação pendente é feita imediatamente.
 *
 * Isso evita perder alterações ao trocar de módulo: a nova página lê o mesmo
 * objeto em memória, sem depender de a anterior já ter gravado.
 */
export type SaveState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'saved'; at: Date }
  | { status: 'error' };

export interface DraftSnapshot {
  draft: ContentDraft;
  saveState: SaveState;
  recovery: DraftRecovery;
}

const SAVE_DELAY_MS = 400;

let snapshot: DraftSnapshot | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let recoveryAnnounced = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function set(patch: Partial<DraftSnapshot>) {
  snapshot = { ...getDraftSnapshot(), ...patch };
  emit();
}

export function getDraftSnapshot(): DraftSnapshot {
  if (!snapshot) {
    const { draft, recovery } = loadDraft();
    snapshot = { draft, recovery, saveState: { status: 'idle' } };
    if (typeof window !== 'undefined') window.addEventListener('pagehide', flushDraft);
  }
  return snapshot;
}

export function subscribeDraft(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Grava imediatamente o que estiver pendente. */
export function flushDraft(): void {
  if (!timer || !snapshot) return;
  clearTimeout(timer);
  timer = null;
  const ok = saveDraft(snapshot.draft);
  set({ saveState: ok ? { status: 'saved', at: new Date() } : { status: 'error' } });
}

export function dispatchDraft(action: DraftAction): void {
  const current = getDraftSnapshot();
  const next = draftReducer(current.draft, action);
  if (next === current.draft) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const ok = saveDraft(getDraftSnapshot().draft);
    set({ saveState: ok ? { status: 'saved', at: new Date() } : { status: 'error' } });
  }, SAVE_DELAY_MS);
  set({ draft: next, saveState: { status: 'pending' } });
}

/** Devolve a situação da recuperação apenas na primeira vez (para avisar uma única vez). */
export function consumeRecoveryNotice(): DraftRecovery | null {
  if (recoveryAnnounced) return null;
  recoveryAnnounced = true;
  return getDraftSnapshot().recovery;
}

/** O usuário leu o aviso de recuperação (corrompido/indisponível): não exibir de novo. */
export function acknowledgeRecovery(): void {
  set({ recovery: 'new' });
}

/** Somente para testes. */
export function resetDraftStoreForTests(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  snapshot = null;
  recoveryAnnounced = false;
  listeners.clear();
}
