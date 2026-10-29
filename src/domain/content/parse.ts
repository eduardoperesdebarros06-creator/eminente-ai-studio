import type { ImportedContent } from './draft';
import { PAGE_LIMITS } from './limits';
import type { ContentFormat } from './types';

/**
 * Interpreta a resposta colada de uma IA externa.
 * 1. JSON (inclusive dentro de bloco ```json) com chaves em português ou inglês.
 * 2. Texto livre com marcadores ("Slide 1", "Título:", "Legenda:"…) ou parágrafos.
 */
export type ParseResult =
  | { ok: true; mode: 'json' | 'text'; content: ImportedContent; warnings: string[] }
  | { ok: false; error: string };

const PAGE_KEYS = ['paginas', 'páginas', 'pages', 'slides', 'cenas', 'scenes'];
const HEADING_KEYS = ['titulo', 'título', 'title', 'heading', 'headline', 'manchete'];
const BODY_KEYS = ['texto', 'text', 'body', 'conteudo', 'conteúdo', 'descricao', 'descrição', 'subtitulo', 'subtítulo', 'subtitle'];
const DURATION_KEYS = ['duracao', 'duração', 'duration', 'durationsec', 'segundos', 'seconds'];
const CAPTION_KEYS = ['legenda', 'caption'];
const CTA_KEYS = ['cta', 'chamada'];
const HASHTAG_KEYS = ['hashtags', 'tags'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function pick(obj: Obj, keys: string[]): unknown {
  for (const [k, v] of Object.entries(obj)) {
    if (keys.includes(k.toLowerCase())) return v;
  }
  return undefined;
}

const asText = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

function asDuration(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const m = v.replace(',', '.').match(/\d+(\.\d+)?/);
    if (m) return Number(m[0]);
  }
  return undefined;
}

function asHashtags(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map(asText).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return v.split(/[\s,;]+/).filter(Boolean);
  return undefined;
}

/** Remove marcação markdown simples de títulos e ênfases. */
function cleanInline(s: string): string {
  return s
    .replace(/^#+\s*/, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^["“]|["”]$/g, '')
    .trim();
}

// ---------------------------------------------------------------- JSON

function extractJsonCandidate(text: string): { candidate: string; strong: boolean } | null {
  const fence = text.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)```/);
  if (fence?.[1] && /^[[{]/.test(fence[1].trim())) return { candidate: fence[1].trim(), strong: true };
  const trimmed = text.trim();
  const strong = trimmed.startsWith('{') || trimmed.startsWith('[');
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  // Começa como JSON mas não fecha (ex.: resposta cortada): ainda é JSON, só que inválido.
  if (start < 0 || end <= start) return strong ? { candidate: trimmed, strong } : null;
  return { candidate: text.slice(start, end + 1), strong };
}

function fromJson(data: unknown): ParseResult {
  const warnings: string[] = [];
  let rawPages: unknown;
  let root: Obj = {};
  if (Array.isArray(data)) {
    rawPages = data;
  } else if (isObj(data)) {
    root = data;
    rawPages = pick(data, PAGE_KEYS);
  }
  if (!Array.isArray(rawPages)) {
    return { ok: false, error: 'O JSON não tem a lista de páginas. Esperado um campo "paginas" (ou "slides"/"cenas") com uma lista.' };
  }

  const pages: ImportedContent['pages'] = [];
  rawPages.forEach((p, i) => {
    if (typeof p === 'string') {
      if (p.trim()) pages.push({ heading: cleanInline(p), body: '' });
      return;
    }
    if (!isObj(p)) {
      warnings.push(`Item ${i + 1} da lista foi ignorado (formato inesperado).`);
      return;
    }
    const heading = cleanInline(asText(pick(p, HEADING_KEYS)));
    const body = asText(pick(p, BODY_KEYS));
    if (!heading && !body) {
      warnings.push(`Página ${i + 1} veio vazia e foi ignorada.`);
      return;
    }
    if (!heading) warnings.push(`Página ${i + 1} veio sem título.`);
    const durationSec = asDuration(pick(p, DURATION_KEYS));
    pages.push(durationSec === undefined ? { heading, body } : { heading, body, durationSec });
  });

  if (pages.length === 0) return { ok: false, error: 'A lista de páginas está vazia.' };

  const content: ImportedContent = { pages };
  const caption = asText(pick(root, CAPTION_KEYS));
  const cta = asText(pick(root, CTA_KEYS));
  const hashtags = asHashtags(pick(root, HASHTAG_KEYS));
  if (caption) content.caption = caption;
  if (cta) content.cta = cta;
  if (hashtags?.length) content.hashtags = hashtags;
  return { ok: true, mode: 'json', content, warnings };
}

// ---------------------------------------------------------------- Texto livre

const PAGE_MARKER = /^\s*(?:#+\s*)?(?:\*\*)?\s*(?:p[áa]gina|slide|cena|scene|page)\s*\d+\s*(?:\*\*)?\s*[:.)\-–—]?\s*(?:\*\*)?\s*(.*)$/i;
const LABEL =
  /^\s*(?:[-*•]\s*)?(?:\*\*)?(t[íi]tulo|title|texto|text|corpo|body|dura[çc][ãa]o|duration|legenda|caption|cta|hashtags)(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.*)$/i;

type Field = 'heading' | 'body' | 'caption' | 'cta' | 'hashtags' | null;

function labelToField(label: string): Field | 'duration' {
  const l = label.toLowerCase();
  if (/^t[íi]tulo|title/.test(l)) return 'heading';
  if (/^texto|text|corpo|body/.test(l)) return 'body';
  if (/^dura/.test(l)) return 'duration';
  if (/^legenda|caption/.test(l)) return 'caption';
  if (l === 'cta') return 'cta';
  return 'hashtags';
}

function fromText(text: string): ParseResult {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const hasMarkers = lines.some((l) => PAGE_MARKER.test(l) || /^\s*(?:[-*•]\s*)?(?:\*\*)?(t[íi]tulo|title)(?:\*\*)?\s*:/i.test(l));

  type Page = { heading: string; body: string; durationSec?: number };
  const pages: Page[] = [];
  const meta = { caption: '', cta: '', hashtags: '' };
  // Estado do laço em objeto: evita estreitamento incorreto de tipos em closures.
  const st: { page: Page | null; field: Field; headingFromMarker: boolean } = {
    page: null,
    field: null,
    headingFromMarker: false,
  };
  const append = (target: string, line: string, sep = '\n') => (target ? `${target}${sep}${line}` : line);
  const newPage = (): Page => {
    const page: Page = { heading: '', body: '' };
    pages.push(page);
    st.page = page;
    st.headingFromMarker = false;
    return page;
  };

  if (hasMarkers) {
    for (const raw of lines) {
      const line = raw.trim();
      const marker = raw.match(PAGE_MARKER);
      if (marker) {
        const page = newPage();
        const rest = cleanInline(marker[1] ?? '');
        page.heading = rest;
        st.headingFromMarker = Boolean(rest);
        st.field = rest ? 'body' : 'heading';
        continue;
      }
      const label = raw.match(LABEL);
      if (label) {
        const f = labelToField(label[1]!);
        const value = (label[2] ?? '').trim();
        if (f === 'duration') {
          const d = asDuration(value);
          if (st.page && d !== undefined) st.page.durationSec = d;
        } else if (f === 'caption' || f === 'cta' || f === 'hashtags') {
          meta[f] = value;
          st.field = f;
        } else if (f === 'heading') {
          // "Título:" substitui o rótulo do marcador ("Slide 1 — Capa"); sem página aberta
          // ou com título já definido, inicia uma nova página.
          const page = st.page && (!st.page.heading || st.headingFromMarker) ? st.page : newPage();
          page.heading = cleanInline(value);
          st.headingFromMarker = false;
          st.field = 'body';
        } else {
          const page = st.page ?? newPage();
          page.body = value;
          st.field = 'body';
        }
        continue;
      }
      if (!line) {
        if (st.field === 'caption') meta.caption = append(meta.caption, '');
        continue;
      }
      if (st.field === 'caption' || st.field === 'cta' || st.field === 'hashtags') {
        meta[st.field] = append(meta[st.field], line, st.field === 'caption' ? '\n' : ' ');
      } else if (st.page) {
        if (st.field === 'heading' && !st.page.heading) {
          st.page.heading = cleanInline(line);
          st.field = 'body';
        } else {
          st.page.body = append(st.page.body, line);
        }
      }
    }
  } else {
    // Sem marcadores: cada parágrafo vira uma página (1ª linha = título).
    const blocks = text.replace(/\r\n?/g, '\n').split(/\n\s*\n/);
    for (const block of blocks) {
      const blines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (blines.length === 0) continue;
      const label = blines[0]!.match(LABEL);
      if (label) {
        const f = labelToField(label[1]!);
        if (f === 'caption' || f === 'cta' || f === 'hashtags') {
          meta[f] = [label[2] ?? '', ...blines.slice(1)].join(f === 'caption' ? '\n' : ' ').trim();
          continue;
        }
      }
      pages.push({ heading: cleanInline(blines[0]!), body: blines.slice(1).join('\n') });
    }
  }

  const cleaned = pages
    .map((p) => ({ ...p, heading: p.heading.trim(), body: p.body.trim() }))
    .filter((p) => p.heading || p.body);
  if (cleaned.length === 0) {
    return { ok: false, error: 'Não foi possível identificar nenhuma página no texto colado.' };
  }

  const content: ImportedContent = { pages: cleaned };
  if (meta.caption.trim()) content.caption = meta.caption.trim();
  if (meta.cta.trim()) content.cta = cleanInline(meta.cta.trim());
  const tags = asHashtags(meta.hashtags);
  if (tags?.length) content.hashtags = tags;

  const warnings = [
    hasMarkers
      ? 'A resposta não estava em JSON; foi interpretada pelos marcadores de texto. Confira a divisão das páginas.'
      : 'A resposta não tinha marcadores; cada parágrafo virou uma página (primeira linha = título). Confira o resultado.',
  ];
  cleaned.forEach((p, i) => {
    if (!p.heading) warnings.push(`Página ${i + 1} ficou sem título.`);
  });
  return { ok: true, mode: 'text', content, warnings };
}

// ---------------------------------------------------------------- API

export const MAX_IMPORT_CHARS = 50_000;

export function parseExternalResponse(input: string): ParseResult {
  const text = input.trim();
  if (!text) return { ok: false, error: 'Cole a resposta da IA antes de importar.' };
  if (text.length > MAX_IMPORT_CHARS) {
    return { ok: false, error: `O texto colado é muito longo (${text.length.toLocaleString('pt-BR')} caracteres; máximo ${MAX_IMPORT_CHARS.toLocaleString('pt-BR')}).` };
  }

  const json = extractJsonCandidate(text);
  if (json) {
    try {
      return fromJson(JSON.parse(json.candidate));
    } catch (e) {
      if (json.strong) {
        const detail = e instanceof Error ? e.message : String(e);
        return {
          ok: false,
          error: `A resposta parece ser JSON, mas está inválida (${detail}). Peça à IA para responder apenas com o JSON, sem texto extra, ou cole a resposta em texto livre.`,
        };
      }
    }
  }
  return fromText(text);
}

/** Avisos sobre como o conteúdo importado será ajustado ao formato atual. */
export function importWarnings(content: ImportedContent, format: ContentFormat): string[] {
  const { min, max } = PAGE_LIMITS[format];
  const n = content.pages.length;
  const out: string[] = [];
  if (n > max) out.push(`Foram encontradas ${n} páginas; o formato permite ${max}. Apenas as primeiras ${max} serão usadas.`);
  if (n < min) out.push(`Foram encontradas ${n} páginas; o formato exige ${min}. Páginas vazias serão adicionadas.`);
  if (format !== 'motion' && content.pages.some((p) => p.durationSec !== undefined)) {
    out.push('As durações informadas só são usadas no formato Motion.');
  }
  return out;
}
