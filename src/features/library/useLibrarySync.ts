import { useSyncExternalStore } from 'react';
import { getSyncSnapshot, subscribeSync } from './librarySync';

/** Situação da gravação na biblioteca e configurações carregadas. */
export function useLibrarySync() {
  return useSyncExternalStore(subscribeSync, getSyncSnapshot, getSyncSnapshot);
}
