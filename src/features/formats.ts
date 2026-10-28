/** Formatos de saída planejados. Consumido pelo dashboard e, nas próximas fases, pelos estúdios. */
export interface OutputFormat {
  id: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
  use: string;
}

export const OUTPUT_FORMATS: readonly OutputFormat[] = [
  { id: 'square', label: 'Quadrado', ratio: '1:1', width: 1080, height: 1080, use: 'Feed e carrossel' },
  { id: 'portrait', label: 'Retrato', ratio: '4:5', width: 1080, height: 1350, use: 'Feed com mais área' },
  { id: 'story', label: 'Vertical', ratio: '9:16', width: 1080, height: 1920, use: 'Stories, Reels e Shorts' },
  { id: 'landscape', label: 'Paisagem', ratio: '16:9', width: 1920, height: 1080, use: 'YouTube e apresentações' },
];
