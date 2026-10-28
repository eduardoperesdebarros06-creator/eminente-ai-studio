import { describe, expect, it } from 'vitest';
import { MODULES, getModule } from './modules';
import { ROADMAP } from './roadmap';

describe('registro de módulos', () => {
  it('ids e caminhos são únicos', () => {
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(MODULES.length);
    expect(new Set(MODULES.map((m) => m.path)).size).toBe(MODULES.length);
  });

  it('inclui os sete módulos exigidos', () => {
    expect(MODULES.map((m) => m.id).sort()).toEqual(
      ['carousel', 'content', 'dashboard', 'design', 'library', 'motion', 'settings'].sort(),
    );
  });

  it('nenhum módulo de fase futura é anunciado como disponível', () => {
    const current = ROADMAP.find((p) => p.state === 'current')!.phase;
    for (const m of MODULES) {
      if (m.phase > current) expect(m.status, m.id).toBe('planned');
    }
  });

  it('getModule falha alto para ids inválidos', () => {
    // @ts-expect-error id inválido de propósito
    expect(() => getModule('xyz')).toThrow(/desconhecido/);
  });
});

describe('roadmap', () => {
  it('tem exatamente uma fase em andamento e fases em ordem', () => {
    expect(ROADMAP.filter((p) => p.state === 'current')).toHaveLength(1);
    expect(ROADMAP.map((p) => p.phase)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
