import type { Brief, ContentFormat, Objective, PageRole } from './types';

/**
 * Templates determinísticos: montam a ESTRUTURA do conteúdo a partir do
 * briefing. Não há IA aqui. Trechos entre [colchetes] são marcadores que o
 * usuário precisa substituir; a validação avisa enquanto existirem.
 */
export interface TemplatePage {
  role: PageRole;
  heading: string;
  body: string;
  durationSec?: number;
}

export interface ContentTemplate {
  id: string;
  format: ContentFormat;
  name: string;
  description: string;
  build: (brief: Brief) => TemplatePage[];
}

export const CTA_BY_OBJECTIVE: Record<Objective, string> = {
  awareness: 'Siga para acompanhar os próximos conteúdos',
  engagement: 'Comente sua opinião',
  conversion: 'Fale com a gente pelo link da bio',
  authority: 'Salve este post para consultar depois',
};

const audienceOf = (b: Brief) => b.audience || '[seu público]';

export const TEMPLATES: readonly ContentTemplate[] = [
  // ---------- Post ----------
  {
    id: 'post-statement',
    format: 'post',
    name: 'Afirmação forte',
    description: 'Uma tese clara sobre o assunto, sustentada em poucas linhas.',
    build: (b) => [
      {
        role: 'cover',
        heading: `${b.subject}: [sua tese em uma frase]`,
        body: `[Explique em até 3 frases por que isso importa para ${audienceOf(b)}.]`,
      },
    ],
  },
  {
    id: 'post-data',
    format: 'post',
    name: 'Dado + insight',
    description: 'Um número relevante e a leitura estratégica dele.',
    build: (b) => [
      {
        role: 'cover',
        heading: '[Dado impactante: ex. 7 em cada 10 empresas…]',
        body: `[Fonte do dado.] [O que esse dado sobre ${b.subject} significa para ${audienceOf(b)}.]`,
      },
    ],
  },
  {
    id: 'post-question',
    format: 'post',
    name: 'Pergunta provocativa',
    description: 'Abre uma conversa e convida o público a se posicionar.',
    build: (b) => [
      {
        role: 'cover',
        heading: `[Pergunta provocativa sobre ${b.subject}]?`,
        body: '[Contextualize a pergunta em 2 frases e convide o público a responder.]',
      },
    ],
  },

  // ---------- Carrossel ----------
  {
    id: 'carousel-tips',
    format: 'carousel',
    name: 'Lista de dicas',
    description: 'Capa, cinco dicas práticas e uma chamada final.',
    build: (b) => [
      { role: 'cover', heading: `5 práticas para dominar ${b.subject}`, body: `[Promessa da leitura para ${audienceOf(b)}.]` },
      ...[1, 2, 3, 4, 5].map((n) => ({
        role: 'content' as const,
        heading: `${n}. [Dica ${n}]`,
        body: `[Como aplicar a dica ${n} na prática.]`,
      })),
      { role: 'cta', heading: '[Fechamento: a ideia que fica]', body: CTA_BY_OBJECTIVE[b.objective] },
    ],
  },
  {
    id: 'carousel-problem-solution',
    format: 'carousel',
    name: 'Problema → Solução',
    description: 'Narrativa que parte da dor do público até o resultado.',
    build: (b) => [
      { role: 'cover', heading: `O erro mais comum em ${b.subject}`, body: '[Gancho: por que continuar lendo.]' },
      { role: 'content', heading: 'O problema', body: `[Descreva a dor de ${audienceOf(b)}.]` },
      { role: 'content', heading: 'O custo de ignorar', body: '[Consequência concreta: tempo, dinheiro, reputação.]' },
      { role: 'content', heading: 'A solução', body: `[A abordagem certa para ${b.subject}.]` },
      { role: 'content', heading: 'Como aplicar', body: '[Passos objetivos para começar.]' },
      { role: 'content', heading: 'O resultado', body: '[O que muda depois de aplicar.]' },
      { role: 'cta', heading: '[Fechamento]', body: CTA_BY_OBJECTIVE[b.objective] },
    ],
  },
  {
    id: 'carousel-myths',
    format: 'carousel',
    name: 'Mitos x Verdades',
    description: 'Desconstrói crenças comuns e posiciona a marca como referência.',
    build: (b) => [
      { role: 'cover', heading: `3 mitos sobre ${b.subject}`, body: '[Por que esses mitos atrapalham.]' },
      ...[1, 2, 3].map((n) => ({
        role: 'content' as const,
        heading: `Mito ${n}: [crença comum]`,
        body: '[A verdade, com um argumento ou dado.]',
      })),
      { role: 'cta', heading: '[Qual desses você já ouviu?]', body: CTA_BY_OBJECTIVE[b.objective] },
    ],
  },
  {
    id: 'carousel-steps',
    format: 'carousel',
    name: 'Passo a passo',
    description: 'Processo em etapas numeradas, fácil de salvar e revisitar.',
    build: (b) => [
      { role: 'cover', heading: `${b.subject} em 4 passos`, body: `[Para quem é: ${audienceOf(b)}.]` },
      ...[1, 2, 3, 4].map((n) => ({
        role: 'content' as const,
        heading: `Passo ${n}: [nome do passo]`,
        body: '[O que fazer e como saber que está certo.]',
      })),
      { role: 'cta', heading: '[Resumo em uma frase]', body: CTA_BY_OBJECTIVE[b.objective] },
    ],
  },

  // ---------- Motion ----------
  {
    id: 'motion-teaser-15',
    format: 'motion',
    name: 'Teaser 15s',
    description: 'Gancho, dois pontos-chave e chamada final em 15 segundos.',
    build: (b) => [
      { role: 'cover', heading: `[Gancho sobre ${b.subject}]`, body: '', durationSec: 3 },
      { role: 'content', heading: '[Ponto-chave 1]', body: '', durationSec: 4 },
      { role: 'content', heading: '[Ponto-chave 2]', body: '', durationSec: 4 },
      { role: 'cta', heading: CTA_BY_OBJECTIVE[b.objective], body: 'EMINENTE', durationSec: 4 },
    ],
  },
  {
    id: 'motion-explainer-30',
    format: 'motion',
    name: 'Explicativo 30s',
    description: 'Seis cenas de 5 segundos: contexto, problema, solução e chamada.',
    build: (b) => [
      { role: 'cover', heading: `${b.subject}`, body: '[Subtítulo curto]', durationSec: 5 },
      { role: 'content', heading: '[Contexto]', body: '', durationSec: 5 },
      { role: 'content', heading: '[O problema]', body: '', durationSec: 5 },
      { role: 'content', heading: '[A solução]', body: '', durationSec: 5 },
      { role: 'content', heading: '[O resultado]', body: '', durationSec: 5 },
      { role: 'cta', heading: CTA_BY_OBJECTIVE[b.objective], body: 'EMINENTE', durationSec: 5 },
    ],
  },
  {
    id: 'motion-manifesto',
    format: 'motion',
    name: 'Manifesto',
    description: 'Frases curtas e afirmativas em ritmo crescente.',
    build: (b) => [
      { role: 'cover', heading: '[Frase de abertura]', body: '', durationSec: 3 },
      { role: 'content', heading: '[Nós acreditamos que…]', body: '', durationSec: 3 },
      { role: 'content', heading: `[${b.subject} não é sobre…]`, body: '', durationSec: 3 },
      { role: 'content', heading: '[É sobre…]', body: '', durationSec: 3 },
      { role: 'cta', heading: '[Assinatura da marca]', body: 'EMINENTE', durationSec: 4 },
    ],
  },
];

export function templatesFor(format: ContentFormat): ContentTemplate[] {
  return TEMPLATES.filter((t) => t.format === format);
}

export function getTemplate(id: string): ContentTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
