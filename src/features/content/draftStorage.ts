import { createDraft } from '../../domain/content/draft';
import { deserializeDraft, serializeDraft } from '../../domain/content/serialize';
import type { ContentDraft } from '../../domain/content/types';
import { readStored, writeStored } from '../../lib/storage';

/**
 * Rascunho em andamento, salvo no navegador. É uma proteção contra perda
 * de trabalho (recarregar, fechar a aba). A biblioteca de projetos (SQLite)
 * recebe uma cópia pela sincronização em `features/library/librarySync.ts`.
 */
const KEY = 'contentDraft';
const CORRUPT_KEY = 'contentDraft.corrupt';

export type DraftRecovery = 'new' | 'restored' | 'corrupt' | 'unavailable';

export function loadDraft(): { draft: ContentDraft; recovery: DraftRecovery } {
  const stored = readStored(KEY);
  switch (stored.status) {
    case 'empty':
      return { draft: createDraft(), recovery: 'new' };
    case 'unavailable':
      return { draft: createDraft(), recovery: 'unavailable' };
    case 'corrupt':
      writeStored(CORRUPT_KEY, stored.raw);
      return { draft: createDraft(), recovery: 'corrupt' };
    case 'ok': {
      const draft = deserializeDraft(stored.value);
      if (draft) return { draft, recovery: 'restored' };
      // Estrutura inválida: preserva uma cópia antes de recomeçar.
      writeStored(CORRUPT_KEY, JSON.stringify(stored.value));
      return { draft: createDraft(), recovery: 'corrupt' };
    }
  }
}

export function saveDraft(draft: ContentDraft): boolean {
  return writeStored(KEY, serializeDraft(draft));
}

