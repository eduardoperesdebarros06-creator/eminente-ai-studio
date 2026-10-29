import { LIMITS } from './limits';

/**
 * Converte texto livre ("#ia marketing, #B2B") em hashtags normalizadas:
 * sem caracteres inválidos, sem duplicatas (ignorando maiúsculas) e com "#".
 */
export function parseHashtags(input: string | readonly string[]): string[] {
  const raw = typeof input === 'string' ? input.split(/[\s,;]+/) : input.flatMap((t) => t.split(/[\s,;]+/));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of raw) {
    const clean = token
      .replace(/^#+/, '')
      .normalize('NFC')
      .replace(/[^\p{L}\p{N}_]/gu, '')
      .slice(0, LIMITS.hashtags.tagMax);
    if (!clean) continue;
    const key = clean.toLocaleLowerCase('pt-BR');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`#${clean}`);
  }
  return out;
}
