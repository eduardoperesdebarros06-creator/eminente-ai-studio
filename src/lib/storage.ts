/**
 * Preferências de interface no navegador. Somente conveniências
 * (ex.: sidebar recolhida). Dados de projeto irão para SQLite na Fase 5.
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
