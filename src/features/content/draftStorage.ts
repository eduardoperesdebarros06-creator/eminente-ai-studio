import { createDraft } from '../../domain/content/draft';
import { deserializeDraft, serializeDraft } from '../../domain/content/serialize';
import type { ContentDraft } from '../../domain/content/types';
import { readStored, removeStored, writeStored } from '../../lib/storage';

/**
 * Rascunho em andamento, salvo no navegador. É uma proteção contra perda
 * de trabalho (recarregar, fechar a aba), não a biblioteca de projetos —
 * esta chega com SQLite na Fase 5.
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

/** Leitura sem efeitos colaterais, para o dashboard. */
export function peekDraft(): ContentDraft | null {
  const stored = readStored(KEY);
  return stored.status === 'ok' ? deserializeDraft(stored.value) : null;
}

export function saveDraft(draft: ContentDraft): boolean {
  return writeStored(KEY, serializeDraft(draft));
}

export function clearDraft(): void {
  removeStored(KEY);
}
