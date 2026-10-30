import type { ContentDraft } from '../../domain/content/types';
import type { ExportKind, SettingsView, VersionSummary } from '../../domain/library/library';
import { hasContent } from '../../domain/library/library';
import { dispatchDraft, getDraftSnapshot, subscribeDraft } from '../content/draftStore';
import { libraryClient } from './libraryClient';

/**
 * Sincroniza o rascunho em andamento com a biblioteca (SQLite no servidor).
 *
 * O navegador continua guardando uma cópia (localStorage), que protege contra
 * fechar a aba; a biblioteca guarda o projeto e o histórico de versões e
 * sobrevive a limpar o navegador. Se o servidor estiver fora do ar, nada se
 * perde: a próxima alteração (ou a nova tentativa periódica) envia o rascunho.
 */
export type SyncStatus = 'starting' | 'saving' | 'saved' | 'empty' | 'offline' | 'error';

export interface SyncSnapshot {
  status: SyncStatus;
  message: string | null;
  at: Date | null;
  /** Versão atual do projeto no banco. */
  version: VersionSummary | null;
  settings: SettingsView | null;
}

const SYNC_DELAY_MS = 1500;
const RETRY_MS = 15_000;

let snap: SyncSnapshot = { status: 'starting', message: null, at: null, version: null, settings: null };
const listeners = new Set<() => void>();
let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let retry: ReturnType<typeof setInterval> | null = null;
let lastSent: ContentDraft | null = null;
let inFlight: Promise<void> | null = null;

function set(patch: Partial<SyncSnapshot>) {
  snap = { ...snap, ...patch };
  for (const l of listeners) l();
}

export const getSyncSnapshot = () => snap;
export function subscribeSync(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function offline(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  set({ status: /indisponível|npm run dev/.test(message) ? 'offline' : 'error', message });
  if (!retry) {
    retry = setInterval(() => {
      if (snap.status === 'offline' || snap.status === 'error') void pushNow();
    }, RETRY_MS);
  }
}

/** Envia o rascunho atual agora (espera um envio em andamento terminar antes). */
export async function pushNow(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (inFlight) await inFlight;
  const draft = getDraftSnapshot().draft;
  if (draft === lastSent && snap.status === 'saved') return;
  if (!hasContent(draft)) {
    lastSent = draft;
    set({ status: 'empty', message: null, version: null });
    return;
  }
  set({ status: 'saving' });
  inFlight = (async () => {
    try {
      const r = await libraryClient.save(draft);
      lastSent = draft;
      if (retry) {
        clearInterval(retry);
        retry = null;
      }
      set({ status: r ? 'saved' : 'empty', message: null, at: new Date(), version: r?.version ?? null });
    } catch (e) {
      offline(e);
    } finally {
      inFlight = null;
    }
  })();
  await inFlight;
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void pushNow(), SYNC_DELAY_MS);
}

/** Inicia a sincronização (uma vez, ao abrir o app). */
export function startLibrarySync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  let current = getDraftSnapshot().draft;
  subscribeDraft(() => {
    const next = getDraftSnapshot().draft;
    if (next === current) return;
    current = next;
    schedule();
  });
  // Ao fechar a aba, envia o pendente mesmo com a página saindo (keepalive).
  window.addEventListener('pagehide', () => {
    const draft = getDraftSnapshot().draft;
    if (timer && hasContent(draft)) void libraryClient.save(draft, 'auto', undefined, true).catch(() => undefined);
  });
  void refreshSettings();
  void pushNow();
}

export async function refreshSettings(): Promise<SettingsView | null> {
  try {
    const settings = await libraryClient.settings();
    set({ settings });
    return settings;
  } catch {
    return null;
  }
}

export function setSettingsView(settings: SettingsView) {
  set({ settings });
}

/** Salva uma versão com nome (nunca agrupada com as automáticas). */
export async function saveNamedVersion(label: string): Promise<VersionSummary> {
  await pushNow();
  const r = await libraryClient.save(getDraftSnapshot().draft, 'manual', label);
  if (!r) throw new Error('O rascunho está vazio: escreva algo antes de salvar uma versão.');
  lastSent = getDraftSnapshot().draft;
  set({ status: 'saved', at: new Date(), version: r.version, message: null });
  return r.version;
}

/**
 * Abre a versão mais recente de um projeto no lugar do rascunho atual. O atual
 * é enviado à biblioteca antes, então nada se perde. (Versões antigas voltam
 * por "Restaurar", que cria uma versão nova com o conteúdo antigo.)
 */
export async function openProject(id: string): Promise<ContentDraft> {
  await pushNow();
  if (snap.status === 'offline' || snap.status === 'error') {
    throw new Error(`O rascunho atual ainda não foi salvo na biblioteca (${snap.message ?? 'servidor indisponível'}). Tente de novo em instantes.`);
  }
  const { draft, version } = await libraryClient.draft(id);
  dispatchDraft({ type: 'draft/replace', draft });
  // O que veio do banco já está salvo: não precisa ser reenviado.
  lastSent = getDraftSnapshot().draft;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  set({ status: 'saved', message: null, at: new Date(), version });
  return draft;
}

/** Restaura uma versão antiga (cria versão nova) e a abre, se for o projeto aberto ou se `open`. */
export async function restoreVersion(id: string, version: number, open: boolean): Promise<VersionSummary> {
  await pushNow();
  const r = await libraryClient.restore(id, version);
  if (open || getDraftSnapshot().draft.id === id) await openProject(id);
  return r.version;
}

/** Registra no projeto um arquivo exportado pelo navegador. Falhas não interrompem a exportação. */
export async function recordExport(
  draft: ContentDraft,
  files: Array<{ kind: ExportKind; name: string; bytes: number; width?: number | null; height?: number | null }>,
): Promise<void> {
  try {
    if (getDraftSnapshot().draft.id === draft.id) await pushNow();
    else await libraryClient.save(draft);
    for (const f of files) await libraryClient.addExport(draft.id, f);
  } catch (e) {
    console.warn('Não foi possível registrar a exportação na biblioteca:', e);
  }
}
