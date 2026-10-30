import type { ContentDraft } from '../../domain/content/types';
import type {
  AppSettings,
  ExportKind,
  ExportRecord,
  LibraryHealth,
  ProjectDetail,
  ProjectSummary,
  SaveResult,
  SettingsView,
  VersionSummary,
} from '../../domain/library/library';
import { api, jsonBody } from '../../lib/api';

/** Chamadas à API da biblioteca (servidor local). */
const p = (id: string) => `/api/projects/${encodeURIComponent(id)}`;

export const libraryClient = {
  list: (trash = false) => api<ProjectSummary[]>(`/api/projects${trash ? '?trash=1' : ''}`),
  detail: (id: string) => api<ProjectDetail>(p(id)),
  draft: (id: string, version?: number) =>
    api<{ draft: ContentDraft; version: VersionSummary }>(`${p(id)}/draft${version === undefined ? '' : `?version=${version}`}`),
  /** `undefined` quando o rascunho está vazio e não virou projeto. */
  save: (draft: ContentDraft, kind: 'auto' | 'manual' = 'auto', label?: string, keepalive = false) =>
    api<SaveResult | undefined>(p(draft.id), jsonBody('PUT', { draft, kind, label }, { keepalive })),
  restore: (id: string, version: number) => api<SaveResult>(`${p(id)}/restore`, jsonBody('POST', { version })),
  trash: (id: string) => api<ProjectSummary>(`${p(id)}/trash`, { method: 'POST' }),
  untrash: (id: string) => api<ProjectSummary>(`${p(id)}/untrash`, { method: 'POST' }),
  purge: (id: string) => api<void>(p(id), { method: 'DELETE' }),
  addExport: (id: string, e: { kind: ExportKind; name: string; bytes: number; width?: number | null; height?: number | null }) =>
    api<ExportRecord>(`${p(id)}/exports`, jsonBody('POST', e)),
  settings: () => api<SettingsView>('/api/settings'),
  saveSettings: (s: AppSettings) => api<SettingsView>('/api/settings', jsonBody('PUT', s)),
  health: () => api<LibraryHealth>('/api/library/health'),
  backup: () => api<{ file: string; health: LibraryHealth }>('/api/library/backup', { method: 'POST' }),
};
