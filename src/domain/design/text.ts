/**
 * Quebra e ajuste de texto independentes de navegador: a largura é obtida
 * por um `Measurer` injetado (Canvas no app, função aproximada nos testes).
 */
export interface FontSpec {
  size: number;
  weight: number;
  /** Espaçamento entre letras em em (ex.: -0.03). */
  letterSpacing: number;
}

export type Measurer = (text: string, font: FontSpec) => number;

/** Quebra uma palavra maior que a linha em pedaços que caibam. */
function breakWord(word: string, font: FontSpec, maxWidth: number, measure: Measurer): string[] {
  const parts: string[] = [];
  let current = '';
  for (const ch of word) {
    if (current && measure(current + ch, font) > maxWidth) {
      parts.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/** Quebra o texto em linhas que caibam em `maxWidth`, respeitando quebras explícitas. */
export function wrapText(text: string, font: FontSpec, maxWidth: number, measure: Measurer): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      if (lines.length > 0) lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, font) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (measure(word, font) <= maxWidth) {
        line = word;
      } else {
        const pieces = breakWord(word, font, maxWidth, measure);
        lines.push(...pieces.slice(0, -1));
        line = pieces[pieces.length - 1] ?? '';
      }
    }
    if (line) lines.push(line);
  }
  // Remove linhas vazias no fim (parágrafos vazios finais).
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export interface FitResult {
  font: FontSpec;
  lines: string[];
  lineHeight: number;
  height: number;
  /** true quando nem no tamanho mínimo o texto coube. */
  overflow: boolean;
}

export interface FitOptions {
  maxWidth: number;
  maxHeight: number;
  maxLines: number;
  maxSize: number;
  minSize: number;
  weight: number;
  letterSpacing: number;
  /** Altura de linha relativa ao tamanho da fonte. */
  leading: number;
}

/**
 * Procura o maior tamanho de fonte (de `maxSize` a `minSize`) em que o texto
 * cabe na largura, no número de linhas e na altura disponíveis.
 */
export function fitText(text: string, opts: FitOptions, measure: Measurer): FitResult {
  const step = Math.max(1, Math.round((opts.maxSize - opts.minSize) / 24));
  let last: FitResult | null = null;
  for (let size = opts.maxSize; size >= opts.minSize; size -= step) {
    const font: FontSpec = { size, weight: opts.weight, letterSpacing: opts.letterSpacing };
    const lines = wrapText(text, font, opts.maxWidth, measure);
    const lineHeight = Math.round(size * opts.leading);
    const height = lines.length * lineHeight;
    last = { font, lines, lineHeight, height, overflow: false };
    if (lines.length <= opts.maxLines && height <= opts.maxHeight) return last;
  }
  // Não coube: devolve o tamanho mínimo marcado como estouro.
  const font: FontSpec = { size: opts.minSize, weight: opts.weight, letterSpacing: opts.letterSpacing };
  const lines = wrapText(text, font, opts.maxWidth, measure);
  const lineHeight = Math.round(opts.minSize * opts.leading);
  return last && last.font.size === opts.minSize
    ? { ...last, overflow: true }
    : { font, lines, lineHeight, height: lines.length * lineHeight, overflow: true };
}
