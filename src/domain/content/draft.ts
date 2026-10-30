import { DEFAULT_DESIGN, HANDLE_MAX, type DesignSettings } from '../design/settings';
import { EMPTY_BRIEF } from './brief';
import { parseHashtags } from './hashtags';
import { createId } from './id';
import { LIMITS, PAGE_LIMITS } from './limits';
import { CTA_BY_OBJECTIVE, getTemplate, type TemplatePage } from './templates';
import type { Brief, ContentDraft, ContentFormat, ContentPage, DraftSource, PageRole } from './types';

export function createPage(role: PageRole, heading = '', body = '', durationSec: number = LIMITS.sceneDuration.default): ContentPage {
  return { id: createId(), role, heading, body, durationSec };
}

export function createDraft(brief: Brief = EMPTY_BRIEF, now = new Date()): ContentDraft {
  const ts = now.toISOString();
  return {
    schemaVersion: 1,
    id: createId(),
    createdAt: ts,
    updatedAt: ts,
    brief,
    templateId: null,
    source: 'manual',
    pages: [],
    caption: '',
    cta: '',
    hashtags: [],
    design: { ...DEFAULT_DESIGN },
  };
}

/** Páginas vazias mínimas para começar a escrever manualmente. */
export function blankPages(format: ContentFormat): ContentPage[] {
  switch (format) {
    case 'post':
      return [createPage('cover')];
    case 'carousel':
      return [createPage('cover'), createPage('content'), createPage('cta')];
    case 'motion':
      return [createPage('cover'), createPage('content'), createPage('cta')];
  }
}

/** Recalcula papéis: primeira = capa, última = CTA (com 3+ páginas), demais = conteúdo. */
export function normalizeRoles(pages: ContentPage[], format: ContentFormat): ContentPage[] {
  if (format === 'post') return pages.map((p) => ({ ...p, role: 'cover' }));
  return pages.map((p, i) => {
    const role: PageRole = i === 0 ? 'cover' : i === pages.length - 1 && pages.length >= 3 ? 'cta' : 'content';
    return p.role === role ? p : { ...p, role };
  });
}

const clampDuration = (n: number) =>
  Math.min(LIMITS.sceneDuration.max, Math.max(LIMITS.sceneDuration.min, Math.round(Number.isFinite(n) ? n : LIMITS.sceneDuration.default)));

/**
 * Adapta as páginas a outro formato. Ao ir para "post" só a primeira página é
 * mantida — a interface pede confirmação antes, pois é uma perda de conteúdo.
 */
export function adaptPages(pages: ContentPage[], format: ContentFormat): ContentPage[] {
  const { min, max } = PAGE_LIMITS[format];
  let next = pages.slice(0, max).map((p) => ({ ...p, durationSec: clampDuration(p.durationSec) }));
  while (next.length < min && next.length > 0) next = [...next, createPage('content')];
  return normalizeRoles(next, format);
}

/** Quantas páginas seriam descartadas ao mudar para `format`. */
export function pagesLostOnFormatChange(pages: ContentPage[], format: ContentFormat): number {
  return Math.max(0, pages.length - PAGE_LIMITS[format].max);
}

export function pagesFromTemplate(pages: TemplatePage[]): ContentPage[] {
  return pages.map((p) => createPage(p.role, p.heading, p.body, p.durationSec));
}

export function totalDuration(pages: readonly ContentPage[]): number {
  return pages.reduce((sum, p) => sum + p.durationSec, 0);
}

/** Conteúdo vindo de fora (IA externa ou texto colado), já interpretado. */
export interface ImportedContent {
  pages: Array<{ heading: string; body: string; durationSec?: number }>;
  caption?: string;
  cta?: string;
  hashtags?: string[];
}

export type DraftAction =
  | { type: 'brief/set'; brief: Brief }
  | { type: 'format/set'; format: ContentFormat }
  | { type: 'template/apply'; templateId: string }
  | { type: 'manual/start' }
  | { type: 'import/apply'; content: ImportedContent; source?: 'external-ai' | 'local-ai' }
  | { type: 'page/update'; id: string; patch: Partial<Pick<ContentPage, 'heading' | 'body' | 'durationSec'>> }
  | { type: 'page/add'; afterId?: string }
  | { type: 'page/remove'; id: string }
  | { type: 'page/move'; id: string; direction: -1 | 1 }
  | { type: 'meta/set'; patch: Partial<Pick<ContentDraft, 'caption' | 'cta'>> }
  | { type: 'hashtags/set'; value: string }
  | { type: 'design/set'; patch: Partial<DesignSettings> }
  | { type: 'draft/replace'; draft: ContentDraft }
  /** `defaults` vem das Configurações; sem ele, mantém o formato e a aparência atuais. */
  | { type: 'draft/reset'; defaults?: { format: ContentFormat; design: DesignSettings } };

function touch(draft: ContentDraft, patch: Partial<ContentDraft>, now: Date): ContentDraft {
  return { ...draft, ...patch, updatedAt: now.toISOString() };
}

/**
 * Reducer puro do rascunho. Aplica os limites de estrutura do formato:
 * ações que os violariam são ignoradas (a interface também as desabilita).
 */
export function draftReducer(draft: ContentDraft, action: DraftAction, now = new Date()): ContentDraft {
  const format = draft.brief.format;
  const limits = PAGE_LIMITS[format];

  switch (action.type) {
    case 'brief/set':
      return touch(draft, { brief: { ...action.brief, format } }, now);

    case 'format/set': {
      if (action.format === format) return draft;
      return touch(
        draft,
        { brief: { ...draft.brief, format: action.format }, pages: adaptPages(draft.pages, action.format), templateId: null },
        now,
      );
    }

    case 'template/apply': {
      const tpl = getTemplate(action.templateId);
      if (!tpl || tpl.format !== format) return draft;
      return touch(
        draft,
        {
          templateId: tpl.id,
          source: 'template',
          pages: normalizeRoles(pagesFromTemplate(tpl.build(draft.brief)), format),
          cta: draft.cta || CTA_BY_OBJECTIVE[draft.brief.objective],
        },
        now,
      );
    }

    case 'manual/start':
      return touch(draft, { templateId: null, source: 'manual', pages: blankPages(format) }, now);

    case 'import/apply': {
      const imported = action.content.pages.map((p) => createPage('content', p.heading, p.body, p.durationSec));
      return touch(
        draft,
        {
          templateId: null,
          source: action.source ?? 'external-ai',
          pages: adaptPages(imported, format),
          caption: action.content.caption ?? draft.caption,
          cta: action.content.cta ?? draft.cta,
          hashtags: action.content.hashtags ? parseHashtags(action.content.hashtags) : draft.hashtags,
        },
        now,
      );
    }

    case 'page/update': {
      const patch = { ...action.patch };
      if (patch.durationSec !== undefined) patch.durationSec = clampDuration(patch.durationSec);
      let found = false;
      const pages = draft.pages.map((p) => {
        if (p.id !== action.id) return p;
        found = true;
        return { ...p, ...patch };
      });
      return found ? touch(draft, { pages }, now) : draft;
    }

    case 'page/add': {
      if (draft.pages.length >= limits.max) return draft;
      const idx = action.afterId ? draft.pages.findIndex((p) => p.id === action.afterId) : draft.pages.length - 1;
      const insertAt = idx < 0 ? draft.pages.length : idx + 1;
      const pages = [...draft.pages.slice(0, insertAt), createPage('content'), ...draft.pages.slice(insertAt)];
      return touch(draft, { pages: normalizeRoles(pages, format) }, now);
    }

    case 'page/remove': {
      if (draft.pages.length <= limits.min) return draft;
      const pages = draft.pages.filter((p) => p.id !== action.id);
      if (pages.length === draft.pages.length) return draft;
      return touch(draft, { pages: normalizeRoles(pages, format) }, now);
    }

    case 'page/move': {
      const i = draft.pages.findIndex((p) => p.id === action.id);
      const j = i + action.direction;
      if (i < 0 || j < 0 || j >= draft.pages.length) return draft;
      const pages = [...draft.pages];
      [pages[i], pages[j]] = [pages[j]!, pages[i]!];
      return touch(draft, { pages: normalizeRoles(pages, format) }, now);
    }

    case 'meta/set':
      return touch(draft, action.patch, now);

    case 'hashtags/set':
      return touch(draft, { hashtags: parseHashtags(action.value) }, now);

    case 'design/set': {
      const patch = { ...action.patch };
      if (patch.handle !== undefined) patch.handle = patch.handle.slice(0, HANDLE_MAX);
      return touch(draft, { design: { ...draft.design, ...patch } }, now);
    }

    case 'draft/replace':
      return action.draft;

    case 'draft/reset':
      if (action.defaults) {
        return { ...createDraft({ ...EMPTY_BRIEF, format: action.defaults.format }, now), design: { ...action.defaults.design } };
      }
      // Preferências visuais (tema, assinatura) sobrevivem a um novo conteúdo.
      return { ...createDraft({ ...EMPTY_BRIEF, format: draft.brief.format }, now), design: draft.design };
  }
}

export function sourceLabel(source: DraftSource): string {
  return { template: 'Template', 'external-ai': 'IA externa', 'local-ai': 'IA local', manual: 'Manual' }[source];
}
