export type ThemeId = 'carvao' | 'laranja' | 'papel';

export interface Theme {
  id: ThemeId;
  label: string;
  background: string;
  text: string;
  muted: string;
  /** Cor de destaque (barras, numeração, pílula de CTA). */
  accent: string;
  /** Texto sobre a cor de destaque. */
  onAccent: string;
  /** Brilho radial laranja ao fundo (somente temas escuros). */
  glow: boolean;
}

/** Temas da marca EMINENTE: carvão com laranja, laranja sólido e papel. */
export const THEMES: readonly Theme[] = [
  {
    id: 'carvao',
    label: 'Carvão',
    background: '#0B0B0C',
    text: '#FFFFFF',
    muted: '#B4B4BB',
    accent: '#FF6A13',
    onAccent: '#0B0B0C',
    glow: true,
  },
  {
    id: 'laranja',
    label: 'Laranja',
    background: '#FF6A13',
    text: '#0B0B0C',
    muted: '#3A1A06',
    accent: '#0B0B0C',
    onAccent: '#FFFFFF',
    glow: false,
  },
  {
    id: 'papel',
    label: 'Papel',
    background: '#F4F2EE',
    text: '#0B0B0C',
    muted: '#55555C',
    accent: '#FF6A13',
    onAccent: '#0B0B0C',
    glow: false,
  },
];

export const isThemeId = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

export function getTheme(id: ThemeId): Theme {
  const t = THEMES.find((x) => x.id === id);
  if (!t) throw new Error(`Tema desconhecido: ${id}`);
  return t;
}
