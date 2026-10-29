import type { ContentFormat } from '../content/types';

export type FormatId = 'square' | 'portrait' | 'story' | 'landscape';

export interface OutputFormat {
  id: FormatId;
  label: string;
  ratio: string;
  width: number;
  height: number;
  use: string;
}

/** Formatos de saída com dimensões exatas em pixels. */
export const OUTPUT_FORMATS: readonly OutputFormat[] = [
  { id: 'square', label: 'Quadrado', ratio: '1:1', width: 1080, height: 1080, use: 'Feed e carrossel' },
  { id: 'portrait', label: 'Retrato', ratio: '4:5', width: 1080, height: 1350, use: 'Feed com mais área' },
  { id: 'story', label: 'Vertical', ratio: '9:16', width: 1080, height: 1920, use: 'Stories, Reels e Shorts' },
  { id: 'landscape', label: 'Paisagem', ratio: '16:9', width: 1920, height: 1080, use: 'YouTube e apresentações' },
];

/** Formatos permitidos por tipo de peça (carrosséis do Instagram aceitam 1:1 e 4:5). */
export const FORMATS_BY_CONTENT: Record<ContentFormat, readonly FormatId[]> = {
  post: ['square', 'portrait', 'story', 'landscape'],
  carousel: ['square', 'portrait'],
  motion: ['story', 'square', 'portrait', 'landscape'],
};

export const isFormatId = (v: unknown): v is FormatId => OUTPUT_FORMATS.some((f) => f.id === v);

export function getFormat(id: FormatId): OutputFormat {
  const f = OUTPUT_FORMATS.find((x) => x.id === id);
  if (!f) throw new Error(`Formato desconhecido: ${id}`);
  return f;
}
