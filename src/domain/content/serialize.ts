import { readDesign } from '../design/settings';
import { LIMITS } from './limits';
import { isFormat, isObjective, isRole, isTone, type Brief, type ContentDraft, type ContentPage, type DraftSource } from './types';

/**
 * Serialização do rascunho. A leitura valida a estrutura inteira: um dado
 * corrompido ou de versão desconhecida resulta em `null`, nunca em estado inválido.
 */
export function serializeDraft(d: ContentDraft): string {
  return JSON.stringify(d, null, 2);
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isSource = (v: unknown): v is DraftSource => v === 'template' || v === 'external-ai' || v === 'local-ai' || v === 'manual';

function readBrief(v: unknown): Brief | null {
  if (!isObj(v)) return null;
  const { subject, objective, audience, tone, format, notes } = v;
  if (!isStr(subject) || !isStr(audience) || !isStr(notes)) return null;
  if (!isObjective(objective) || !isTone(tone) || !isFormat(format)) return null;
  return { subject, objective, audience, tone, format, notes };
}

function readPage(v: unknown): ContentPage | null {
  if (!isObj(v)) return null;
  const { id, role, heading, body, durationSec } = v;
  if (!isStr(id) || !isRole(role) || !isStr(heading) || !isStr(body)) return null;
  const dur = typeof durationSec === 'number' && Number.isFinite(durationSec) ? durationSec : LIMITS.sceneDuration.default;
  return { id, role, heading, body, durationSec: dur };
}

export function deserializeDraft(v: unknown): ContentDraft | null {
  if (!isObj(v) || v.schemaVersion !== 1) return null;
  const brief = readBrief(v.brief);
  if (!brief) return null;
  if (!isStr(v.id) || !isStr(v.createdAt) || !isStr(v.updatedAt)) return null;
  if (!(v.templateId === null || isStr(v.templateId)) || !isSource(v.source)) return null;
  if (!Array.isArray(v.pages) || !isStr(v.caption) || !isStr(v.cta)) return null;
  if (!Array.isArray(v.hashtags) || !v.hashtags.every(isStr)) return null;
  const pages = v.pages.map(readPage);
  if (pages.some((p) => p === null)) return null;
  return {
    schemaVersion: 1,
    id: v.id,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    brief,
    templateId: v.templateId,
    source: v.source,
    pages: pages as ContentPage[],
    caption: v.caption,
    cta: v.cta,
    hashtags: v.hashtags,
    // Rascunhos da Fase 2 não têm `design`: recebem os valores padrão.
    design: readDesign(v.design),
  };
}
