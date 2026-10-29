export type PhaseState = 'done' | 'current' | 'next';

export interface RoadmapPhase {
  phase: number;
  title: string;
  summary: string;
  state: PhaseState;
}

/** Fonte única do andamento do projeto, exibida no dashboard. */
export const ROADMAP: readonly RoadmapPhase[] = [
  {
    phase: 1,
    title: 'Fundação',
    summary: 'Interface navegável, design system e dashboard.',
    state: 'done',
  },
  {
    phase: 2,
    title: 'Conteúdo',
    summary: 'Criação e edição com templates e texto de IA externa.',
    state: 'done',
  },
  {
    phase: 3,
    title: 'Posts e carrosséis',
    summary: 'Pré-visualização e exportação PNG real.',
    state: 'current',
  },
  {
    phase: 4,
    title: 'Motion',
    summary: 'Cenas animadas, quadros via Playwright e MP4 via FFmpeg.',
    state: 'next',
  },
  {
    phase: 5,
    title: 'Persistência',
    summary: 'SQLite, biblioteca, histórico e testes de recuperação.',
    state: 'next',
  },
  {
    phase: 6,
    title: 'IA local',
    summary: 'Avaliação de integração opcional com Ollama.',
    state: 'next',
  },
];
