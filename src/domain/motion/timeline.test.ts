import { describe, expect, it } from 'vitest';
import { buildTimeline, elementState, formatTime, frameLayers, sceneAt, TRANSITION_MAX_SEC } from './timeline';

describe('linha do tempo', () => {
  it('soma as durações e calcula o total de quadros', () => {
    const tl = buildTimeline([4, 3.5, 2], 30, 'fade');
    expect(tl.durationSec).toBe(9.5);
    expect(tl.totalFrames).toBe(285);
    expect(tl.scenes.map((s) => [s.start, s.end])).toEqual([[0, 4], [4, 7.5], [7.5, 9.5]]);
  });

  it('limita a transição à metade da cena mais curta', () => {
    const tl = buildTimeline([4, 1, 4], 24, 'slide');
    expect(tl.transitions).toEqual([0.5, 0.5]);
    expect(buildTimeline([4, 4], 24, 'fade').transitions).toEqual([TRANSITION_MAX_SEC]);
    expect(buildTimeline([4, 4], 24, 'cut').transitions).toEqual([0]);
  });

  it('rejeita lista vazia e durações inválidas', () => {
    expect(() => buildTimeline([], 30, 'fade')).toThrow(/pelo menos uma/);
    expect(() => buildTimeline([2, 0], 30, 'fade')).toThrow(/inválida/);
    expect(() => buildTimeline([NaN], 30, 'fade')).toThrow(/inválida/);
  });

  it('a cena ativa troca exatamente no limite nominal', () => {
    const tl = buildTimeline([2, 2], 30, 'cut');
    expect(sceneAt(tl, 1.999)).toBe(0);
    expect(sceneAt(tl, 2)).toBe(1);
    expect(sceneAt(tl, 99)).toBe(1);
  });
});

describe('camadas por quadro', () => {
  it('corte: sempre uma camada', () => {
    const tl = buildTimeline([2, 2], 30, 'cut');
    expect(frameLayers(tl, 59)).toEqual([{ sceneIndex: 0, opacity: 1, offsetX: 0, localSec: 59 / 30 }]);
    expect(frameLayers(tl, 60)).toEqual([{ sceneIndex: 1, opacity: 1, offsetX: 0, localSec: 0 }]);
  });

  it('esmaecer: a cena seguinte surge por cima, centrada no limite', () => {
    const tl = buildTimeline([2, 2], 30, 'fade'); // transição de 0,6 s: 1,7 s a 2,3 s
    expect(frameLayers(tl, 50)).toHaveLength(1); // 1,667 s
    const mid = frameLayers(tl, 60); // 2,0 s
    expect(mid.map((l) => l.sceneIndex)).toEqual([0, 1]);
    expect(mid[0]!.opacity).toBe(1);
    expect(mid[1]!.opacity).toBeCloseTo(0.5, 5);
    expect(mid[1]!.localSec).toBeCloseTo(0.3, 5);
    expect(frameLayers(tl, 69)).toHaveLength(1); // 2,3 s: transição terminou
    expect(frameLayers(tl, 69)[0]!.sceneIndex).toBe(1);
  });

  it('deslizar: as duas cenas andam juntas para a esquerda', () => {
    const tl = buildTimeline([2, 2], 30, 'slide');
    const [out, inc] = frameLayers(tl, 60);
    expect(out!.offsetX).toBeCloseTo(-0.5, 5);
    expect(inc!.offsetX).toBeCloseTo(0.5, 5);
    expect(inc!.offsetX - out!.offsetX).toBeCloseTo(1, 5);
  });

  it('o primeiro e o último quadro são válidos; fora do intervalo falha', () => {
    const tl = buildTimeline([1, 1], 24, 'fade');
    expect(frameLayers(tl, 0)[0]!.sceneIndex).toBe(0);
    expect(frameLayers(tl, tl.totalFrames - 1).at(-1)!.sceneIndex).toBe(1);
    expect(() => frameLayers(tl, tl.totalFrames)).toThrow(/fora do intervalo/);
    expect(() => frameLayers(tl, -1)).toThrow();
    expect(() => frameLayers(tl, 1.5)).toThrow();
  });
});

describe('entrada dos elementos', () => {
  it('elementos fixos não animam', () => {
    expect(elementState('brand', 0)).toEqual({ opacity: 1, dy: 0 });
    expect(elementState('glow', 0)).toEqual({ opacity: 1, dy: 0 });
  });

  it('título começa invisível e termina no lugar', () => {
    expect(elementState('heading', 0).opacity).toBe(0);
    expect(elementState('heading', 0).dy).toBeGreaterThan(0);
    expect(elementState('heading', 5)).toEqual({ opacity: 1, dy: 0 });
  });

  it('o texto entra depois do título', () => {
    const t = 0.5;
    expect(elementState('body', t).opacity).toBeLessThan(elementState('heading', t).opacity);
    expect(elementState('cta', t).opacity).toBe(elementState('cta-pill', t).opacity);
  });
});

it('formata o tempo', () => {
  expect(formatTime(0)).toBe('0:00.0');
  expect(formatTime(65.34)).toBe('1:05.3');
});
