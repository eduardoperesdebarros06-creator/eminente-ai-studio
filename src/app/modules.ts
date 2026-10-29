import {
  Clapperboard,
  FolderOpen,
  GalleryHorizontalEnd,
  LayoutDashboard,
  PenLine,
  Settings,
  Shapes,
  type LucideIcon,
} from 'lucide-react';

export type ModuleId =
  | 'dashboard'
  | 'content'
  | 'design'
  | 'carousel'
  | 'motion'
  | 'library'
  | 'settings';

/**
 * Situação real de cada módulo. Nada é marcado como `available`
 * enquanto a funcionalidade não estiver implementada de fato.
 */
export type ModuleStatus = 'available' | 'planned';

export type ModuleGroup = 'overview' | 'create' | 'manage';

export interface StudioModule {
  id: ModuleId;
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: ModuleGroup;
  /** Fase do roadmap em que o módulo passa a ser funcional. */
  phase: number;
  status: ModuleStatus;
  /** Recursos previstos para o módulo, exibidos nos estados vazios. */
  capabilities: string[];
}

export const MODULES: readonly StudioModule[] = [
  {
    id: 'dashboard',
    path: '/',
    label: 'Dashboard',
    description: 'Visão geral do estúdio, atalhos e andamento do roadmap.',
    icon: LayoutDashboard,
    group: 'overview',
    phase: 1,
    status: 'available',
    capabilities: ['Atalhos para os módulos', 'Roadmap de implementação', 'Formatos suportados'],
  },
  {
    id: 'content',
    path: '/content',
    label: 'Content Studio',
    description: 'Transforme um assunto em roteiro, copy e estrutura de peças.',
    icon: PenLine,
    group: 'create',
    phase: 2,
    status: 'available',
    capabilities: [
      'Briefing com validação',
      'Templates de estrutura por formato',
      'Prompt para IA externa e importação da resposta (JSON ou texto)',
      'Edição de páginas, cenas, legenda, CTA e hashtags',
      'Exportação .md e .json e reabertura de .json',
    ],
  },
  {
    id: 'design',
    path: '/design',
    label: 'Design Studio',
    description: 'Posts gráficos editáveis com pré-visualização em tempo real.',
    icon: Shapes,
    group: 'create',
    phase: 3,
    status: 'planned',
    capabilities: [
      'Templates editoriais da marca',
      'Composição em SVG/Canvas',
      'Formatos 1:1, 4:5, 9:16 e 16:9',
      'Exportação PNG real',
    ],
  },
  {
    id: 'carousel',
    path: '/carousel',
    label: 'Carousel Studio',
    description: 'Carrosséis multipágina com consistência visual entre slides.',
    icon: GalleryHorizontalEnd,
    group: 'create',
    phase: 3,
    status: 'planned',
    capabilities: [
      'Sequência de páginas reordenáveis',
      'Capa, desenvolvimento e CTA',
      'Pré-visualização por página',
      'Exportação PNG individual de cada página',
    ],
  },
  {
    id: 'motion',
    path: '/motion',
    label: 'Motion Studio',
    description: 'Cenas animadas renderizadas quadro a quadro e codificadas em MP4.',
    icon: Clapperboard,
    group: 'create',
    phase: 4,
    status: 'planned',
    capabilities: [
      'Sistema de cenas e transições',
      'Renderização de quadros com Playwright',
      'Codificação MP4 com FFmpeg',
      'Validação de resolução, FPS e duração',
    ],
  },
  {
    id: 'library',
    path: '/library',
    label: 'Biblioteca',
    description: 'Projetos, versões e arquivos exportados, salvos localmente.',
    icon: FolderOpen,
    group: 'manage',
    phase: 5,
    status: 'planned',
    capabilities: [
      'Persistência em SQLite',
      'Histórico de versões',
      'Arquivos exportados por projeto',
      'Recuperação após reinício',
    ],
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Configurações',
    description: 'Preferências, pastas de exportação e integrações locais.',
    icon: Settings,
    group: 'manage',
    phase: 5,
    status: 'planned',
    capabilities: [
      'Pasta de exportação',
      'Diagnóstico de FFmpeg e Playwright',
      'Padrões de formato e qualidade',
      'Integração opcional com Ollama (Fase 6)',
    ],
  },
];

export const GROUP_LABELS: Record<ModuleGroup, string> = {
  overview: 'Visão geral',
  create: 'Criação',
  manage: 'Gestão',
};

export function getModule(id: ModuleId): StudioModule {
  const found = MODULES.find((m) => m.id === id);
  if (!found) throw new Error(`Módulo desconhecido: ${id}`);
  return found;
}

export function modulesByGroup(group: ModuleGroup): StudioModule[] {
  return MODULES.filter((m) => m.group === group);
}
