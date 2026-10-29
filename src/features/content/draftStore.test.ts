import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acknowledgeRecovery, consumeRecoveryNotice, dispatchDraft, flushDraft, getDraftSnapshot, resetDraftStoreForTests, subscribeDraft } from './draftStore';

/** localStorage em memória para rodar no Node. */
function fakeWindow(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
  vi.stubGlobal('window', { localStorage, addEventListener: () => {} });
  return data;
}

describe('draftStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDraftStoreForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('a alteração é vista imediatamente por qualquer leitor (troca de módulo sem perda)', () => {
    fakeWindow();
    dispatchDraft({ type: 'brief/set', brief: { ...getDraftSnapshot().draft.brief, subject: 'Assunto novo' } });
    dispatchDraft({ type: 'manual/start' });
    // Nenhum timer rodou ainda: um "novo módulo" lê o mesmo estado em memória.
    expect(getDraftSnapshot().draft.brief.subject).toBe('Assunto novo');
    expect(getDraftSnapshot().draft.pages.length).toBeGreaterThan(0);
    expect(getDraftSnapshot().saveState.status).toBe('pending');
  });

  it('grava com debounce e informa o estado', () => {
    const data = fakeWindow();
    dispatchDraft({ type: 'manual/start' });
    expect(data.has('eminente:contentDraft')).toBe(false);
    vi.advanceTimersByTime(500);
    expect(JSON.parse(data.get('eminente:contentDraft')!).pages.length).toBeGreaterThan(0);
    expect(getDraftSnapshot().saveState.status).toBe('saved');
  });

  it('flush grava imediatamente o que está pendente', () => {
    const data = fakeWindow();
    dispatchDraft({ type: 'manual/start' });
    flushDraft();
    expect(data.has('eminente:contentDraft')).toBe(true);
  });

  it('informa falha de gravação', () => {
    fakeWindow();
    (window.localStorage as { setItem: (k: string, v: string) => void }).setItem = () => {
      throw new Error('QuotaExceededError');
    };
    dispatchDraft({ type: 'manual/start' });
    vi.advanceTimersByTime(500);
    expect(getDraftSnapshot().saveState.status).toBe('error');
  });

  it('notifica assinantes e ignora ações sem efeito', () => {
    fakeWindow();
    const listener = vi.fn();
    subscribeDraft(listener);
    dispatchDraft({ type: 'page/remove', id: 'nao-existe' });
    expect(listener).not.toHaveBeenCalled();
    dispatchDraft({ type: 'manual/start' });
    expect(listener).toHaveBeenCalled();
  });

  it('recupera rascunho salvo e avisa uma única vez', () => {
    const first = fakeWindow();
    dispatchDraft({ type: 'manual/start' });
    flushDraft();
    const saved = first.get('eminente:contentDraft')!;
    resetDraftStoreForTests();
    fakeWindow({ 'eminente:contentDraft': saved });
    expect(getDraftSnapshot().recovery).toBe('restored');
    expect(consumeRecoveryNotice()).toBe('restored');
    expect(consumeRecoveryNotice()).toBeNull();
  });

  it('rascunho corrompido: recomeça, preserva cópia e o aviso pode ser dispensado', () => {
    const data = fakeWindow({ 'eminente:contentDraft': '{quebrado' });
    expect(getDraftSnapshot().recovery).toBe('corrupt');
    expect(getDraftSnapshot().draft.pages).toEqual([]);
    expect(data.get('eminente:contentDraft.corrupt')).toBe('{quebrado');
    acknowledgeRecovery();
    expect(getDraftSnapshot().recovery).toBe('new');
  });
});
