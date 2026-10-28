import { describe, expect, it } from 'vitest';
import { MODULES } from './modules';
import { normalizePath, resolveRoute } from './router';

describe('normalizePath', () => {
  it.each([
    ['', '/'],
    ['#', '/'],
    ['#/', '/'],
    ['#/content', '/content'],
    ['#/content/', '/content'],
    ['#//Motion//', '/motion'],
    ['#/library?x=1', '/library'],
    ['carousel', '/carousel'],
  ])('%j → %s', (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });
});

describe('resolveRoute', () => {
  it('resolve todos os módulos registrados pelo caminho', () => {
    for (const m of MODULES) {
      expect(resolveRoute(`#${m.path}`).id).toBe(m.id);
    }
  });

  it('hash vazio abre o dashboard', () => {
    expect(resolveRoute('').id).toBe('dashboard');
  });

  it('resolve rotas extras', () => {
    expect(resolveRoute('#/design-system').id).toBe('design-system');
  });

  it('rota desconhecida cai em not-found preservando o caminho', () => {
    expect(resolveRoute('#/nao-existe')).toEqual({ id: 'not-found', path: '/nao-existe' });
  });
});
