import type { ContentDraft, ContentFormat } from '../content/types';
import { FORMAT_LABELS } from '../content/types';
import { readDesign, type DesignSettings } from '../design/settings';

/**
 * Biblioteca de projetos (Fase 5). Contrato entre a interface e o servidor
 * local e regras puras (sem banco, sem DOM), testáveis isoladamente.
 *
 * Um projeto é um rascunho do Content Studio, identificado pelo `id` do
 * rascunho. Cada gravação com conteúdo diferente vira uma versão; gravações
 * automáticas próximas no tempo são agrupadas numa só versão.
 */

export type VersionKind = 'auto' | 'manual' | 'restore';

export const VERSION_KIND_LABELS: Record<VersionKind, string> = {
  auto: 'Automática',
  manual: 'Salva por você',
  restore: 'Restaurada',
};

/** Gravações automáticas dentro desta janela substituem a última versão automática. */
export const AUTO_COALESCE_MS = 10 * 60 * 1000;
/** Máximo de versões automáticas guardadas por projeto (as manuais nunca são apagadas). */
export const AUTO_VERSIONS_KEPT = 30;
/** Rótulo de uma versão salva manualmente. */
export const VERSION_LABEL_MAX = 80;

export interface ProjectSummary {
  id: string;
  title: string;
  format: ContentFormat;
  createdAt: string;
  updatedAt: string;
  versions: number;
  exports: number;
  /** Data da exclusão (na lixeira), ou `null`. */
  deletedAt: string | null;
}

export interface VersionSummary {
  number: number;
  kind: VersionKind;
  label: string;
  createdAt: string;
  /** Última gravação agrupada nesta versão (igual a `createdAt` se não houve). */
  savedAt: string;
}

export type ExportKind = 'png' | 'zip' | 'mp4' | 'md' | 'json';

export const EXPORT_KINDS: readonly ExportKind[] = ['png', 'zip', 'mp4', 'md', 'json'];

export interface ExportRecord {
  id: number;
  kind: ExportKind;
  name: string;
  /** Caminho no disco quando o servidor gravou o arquivo (MP4); downloads do navegador não têm. */
  path: string | null;
  bytes: number;
  width: number | null;
  height: number | null;
  /** Versão do projeto no momento da exportação. */
  version: number | null;
  createdAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  versionList: VersionSummary[];
  exportList: ExportRecord[];
}

/** Resultado de uma gravação. */
export interface SaveResult {
  project: ProjectSummary;
  version: VersionSummary;
  /** `false` quando o conteúdo era igual ao da última versão (nada mudou). */
  changed: boolean;
}

/** Padrões aplicados a cada conteúdo novo. */
export interface StudioDefaults {
  format: ContentFormat;
  design: DesignSettings;
}

export interface AppSettings {
  /** Pasta dos MP4. `null` = pasta padrão (`exports/` do projeto). */
  exportsDir: string | null;
  defaults: StudioDefaults;
}

export interface SettingsView {
  settings: AppSettings;
  /** Pasta efetivamente usada (resolvida). */
  exportsDir: string;
  defaultExportsDir: string;
}

export interface LibraryHealth {
  ok: boolean;
  file: string;
  sqlite: string;
  /** Mensagem de recuperação na abertura (banco corrompido trocado por um novo), se houve. */
  recovered: string | null;
  backups: { name: string; bytes: number; createdAt: string }[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  exportsDir: null,
  defaults: { format: 'carousel', design: readDesign(undefined) },
};

const FORMATS: readonly ContentFormat[] = ['post', 'carousel', 'motion'];
export const isContentFormat = (v: unknown): v is ContentFormat => FORMATS.includes(v as ContentFormat);
export const isExportKind = (v: unknown): v is ExportKind => EXPORT_KINDS.includes(v as ExportKind);

/** Lê configurações salvas campo a campo; valores inválidos voltam ao padrão. */
export function readSettings(v: unknown): AppSettings {
  if (typeof v !== 'object' || v === null) return structuredClone(DEFAULT_SETTINGS);
  const o = v as Record<string, unknown>;
  const d = (typeof o.defaults === 'object' && o.defaults !== null ? o.defaults : {}) as Record<string, unknown>;
  return {
    exportsDir: typeof o.exportsDir === 'string' && o.exportsDir.trim() ? o.exportsDir.trim() : null,
    defaults: {
      format: isContentFormat(d.format) ? d.format : DEFAULT_SETTINGS.defaults.format,
      design: readDesign(d.design),
    },
  };
}

/** Título exibido na biblioteca: o assunto, ou o primeiro título preenchido. */
export function draftTitle(draft: ContentDraft): string {
  const subject = draft.brief.subject.trim();
  if (subject) return subject.slice(0, 140);
  const heading = draft.pages.map((p) => p.heading.trim()).find(Boolean);
  if (heading) return heading.replace(/\s+/g, ' ').slice(0, 140);
  return `${FORMAT_LABELS[draft.brief.format]} sem título`;
}

/** Um rascunho só vira projeto quando tem algum conteúdo (evita encher a biblioteca de vazios). */
export function hasContent(draft: ContentDraft): boolean {
  if (draft.brief.subject.trim()) return true;
  if (draft.caption.trim() || draft.cta.trim() || draft.hashtags.length) return true;
  return draft.pages.some((p) => p.heading.trim() || p.body.trim());
}

/**
 * Forma canônica do conteúdo, para saber se algo mudou: ignora `updatedAt`
 * (muda a cada tecla) e usa sempre a mesma ordem de chaves.
 */
export function contentKey(draft: ContentDraft): string {
  const { updatedAt: _ignored, ...rest } = draft;
  return stableStringify(rest);
}

function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

/**
 * Uma gravação automática substitui a última versão quando esta também é
 * automática e foi criada há pouco. Manuais e restaurações nunca são substituídas.
 */
export function shouldCoalesce(last: { kind: VersionKind; createdAt: string } | null, kind: VersionKind, now: Date): boolean {
  if (!last || kind !== 'auto' || last.kind !== 'auto') return false;
  const age = now.getTime() - Date.parse(last.createdAt);
  return age >= 0 && age < AUTO_COALESCE_MS;
}

/** Rótulo padrão de uma versão. */
export function versionLabel(kind: VersionKind, label: string | undefined, restoredFrom?: number): string {
  const clean = (label ?? '').replace(/\s+/g, ' ').trim().slice(0, VERSION_LABEL_MAX);
  if (clean) return clean;
  if (kind === 'restore') return restoredFrom ? `Restaurada da versão ${restoredFrom}` : 'Restaurada';
  return kind === 'manual' ? 'Versão salva' : 'Gravação automática';
}

/** Cópia de um projeto com novo id e título marcado. */
export function duplicateDraft(draft: ContentDraft, newId: string, now: Date): ContentDraft {
  const ts = now.toISOString();
  const subject = draft.brief.subject.trim();
  return {
    ...structuredClone(draft),
    id: newId,
    createdAt: ts,
    updatedAt: ts,
    brief: { ...draft.brief, subject: subject ? `${subject} (cópia)`.slice(0, 140) : subject },
  };
}
