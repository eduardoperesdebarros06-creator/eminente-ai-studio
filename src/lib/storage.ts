/**
 * Armazenamento no navegador (localStorage). Usado para preferências de
 * interface e para a cópia instantânea do rascunho em andamento. Projetos e
 * histórico ficam na biblioteca (SQLite, no servidor local).
 */
const PREFIX = 'eminente:';

export function readPreference<T>(key: string, fallback: T, validate: (v: unknown) => v is T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writePreference(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Armazenamento indisponível (modo privado, cota): a preferência apenas não persiste.
  }
}

export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';

export type StoredRead = { status: 'empty' } | { status: 'ok'; value: unknown } | { status: 'corrupt'; raw: string } | { status: 'unavailable' };

/** Leitura que distingue "vazio", "corrompido" e "indisponível". */
export function readStored(key: string): StoredRead {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(PREFIX + key);
  } catch {
    return { status: 'unavailable' };
  }
  if (raw === null) return { status: 'empty' };
  try {
    return { status: 'ok', value: JSON.parse(raw) as unknown };
  } catch {
    return { status: 'corrupt', raw };
  }
}

/** Escrita que informa se funcionou (ex.: cota excedida ou modo privado). */
export function writeStored(key: string, serialized: string): boolean {
  try {
    window.localStorage.setItem(PREFIX + key, serialized);
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Sem armazenamento disponível: nada a remover.
  }
}
