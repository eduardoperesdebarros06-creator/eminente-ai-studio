import { describe, expect, it } from 'vitest';
import { createDraft, createPage } from '../content/draft';
import {
  AUTO_COALESCE_MS,
  contentKey,
  draftTitle,
  duplicateDraft,
  hasContent,
  readSettings,
  shouldCoalesce,
  versionLabel,
} from './library';

const now = new Date('2026-10-29T12:00:00.000Z');
const base = () => createDraft({ subject: '', objective: 'authority', audience: '', tone: 'executive', format: 'motion', notes: '' }, now);

describe('regras da biblioteca', () => {
  it('título: assunto, senão o primeiro título preenchido, senão genérico', () => {
    const d = base();
    expect(draftTitle(d)).toBe('Motion sem título');
    d.pages = [createPage('cover', '  '), createPage('content', 'Primeiro   título')];
    expect(draftTitle(d)).toBe('Primeiro título');
    d.brief.subject = 'Lançamento';
    expect(draftTitle(d)).toBe('Lançamento');
  });

  it('rascunho vazio não vira projeto', () => {
    const d = base();
    d.pages = [createPage('cover')];
    expect(hasContent(d)).toBe(false);
    d.pages = [createPage('cover', '', 'texto')];
    expect(hasContent(d)).toBe(true);
    expect(hasContent({ ...base(), caption: 'legenda' })).toBe(true);
  });

  it('a chave de conteúdo ignora updatedAt e a ordem das chaves', () => {
    const d = base();
    const later = { ...d, updatedAt: '2030-01-01T00:00:00.000Z' };
    expect(contentKey(later)).toBe(contentKey(d));
    const { design, ...rest } = d;
    const reordered = JSON.parse(JSON.stringify({ design, ...rest }));
    expect(contentKey(reordered)).toBe(contentKey(d));
    expect(contentKey({ ...d, caption: 'x' })).not.toBe(contentKey(d));
  });

  it('agrupa só automática após automática dentro da janela', () => {
    const at = (ms: number) => new Date(now.getTime() + ms);
    const auto = { kind: 'auto' as const, createdAt: now.toISOString() };
    expect(shouldCoalesce(null, 'auto', now)).toBe(false);
    expect(shouldCoalesce(auto, 'auto', at(1000))).toBe(true);
    expect(shouldCoalesce(auto, 'auto', at(AUTO_COALESCE_MS))).toBe(false);
    expect(shouldCoalesce(auto, 'manual', at(1000))).toBe(false);
    expect(shouldCoalesce({ ...auto, kind: 'manual' }, 'auto', at(1000))).toBe(false);
    // Relógio voltou no tempo: não agrupa.
    expect(shouldCoalesce(auto, 'auto', at(-1000))).toBe(false);
  });

  it('rótulos de versão', () => {
    expect(versionLabel('manual', '  Aprovada   pelo cliente ')).toBe('Aprovada pelo cliente');
    expect(versionLabel('manual', '')).toBe('Versão salva');
    expect(versionLabel('auto', undefined)).toBe('Gravação automática');
    expect(versionLabel('restore', undefined, 3)).toBe('Restaurada da versão 3');
    expect(versionLabel('manual', 'x'.repeat(200))).toHaveLength(80);
  });

  it('duplicar gera outro id e marca o título, sem alterar o original', () => {
    const d = { ...base(), brief: { ...base().brief, subject: 'Peça' } };
    d.pages = [createPage('cover', 'Capa')];
    const copy = duplicateDraft(d, 'novo-id', new Date('2026-11-01T00:00:00.000Z'));
    expect(copy).toMatchObject({ id: 'novo-id', createdAt: '2026-11-01T00:00:00.000Z', brief: { subject: 'Peça (cópia)' } });
    copy.pages[0]!.heading = 'Mudou';
    expect(d.pages[0]!.heading).toBe('Capa');
  });

  it('configurações: campos inválidos voltam ao padrão', () => {
    expect(readSettings(null)).toMatchObject({ exportsDir: null, defaults: { format: 'carousel' } });
    expect(readSettings({ exportsDir: 3, defaults: { format: 'motion', design: { themeId: 'laranja' } } })).toMatchObject({
      exportsDir: null,
      defaults: { format: 'motion', design: { themeId: 'laranja', fps: 30 } },
    });
  });
});
