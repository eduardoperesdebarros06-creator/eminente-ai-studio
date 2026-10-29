import { describe, expect, it } from 'vitest';
import { importWarnings, MAX_IMPORT_CHARS, parseExternalResponse } from './parse';

function ok(input: string) {
  const r = parseExternalResponse(input);
  if (!r.ok) throw new Error(`esperava sucesso: ${r.error}`);
  return r;
}

describe('parseExternalResponse — JSON', () => {
  it('lê o formato pedido no prompt', () => {
    const r = ok(
      JSON.stringify({
        paginas: [
          { titulo: 'Capa', texto: 'Gancho' },
          { titulo: 'Dica 1', texto: 'Faça X' },
        ],
        legenda: 'Legenda aqui',
        cta: 'Salve',
        hashtags: ['#ia', '#marketing'],
      }),
    );
    expect(r.mode).toBe('json');
    expect(r.content.pages).toEqual([
      { heading: 'Capa', body: 'Gancho' },
      { heading: 'Dica 1', body: 'Faça X' },
    ]);
    expect(r.content).toMatchObject({ caption: 'Legenda aqui', cta: 'Salve', hashtags: ['#ia', '#marketing'] });
    expect(r.warnings).toEqual([]);
  });

  it('extrai JSON de bloco ```json com texto ao redor', () => {
    const r = ok('Claro! Aqui está:\n```json\n{"slides":[{"title":"A","body":"B"}]}\n```\nBom uso!');
    expect(r.content.pages).toEqual([{ heading: 'A', body: 'B' }]);
  });

  it('aceita chaves em inglês, acentos e maiúsculas, e durações em texto', () => {
    const r = ok('{"Cenas":[{"Título":"Gancho","Duração":"3s"},{"title":"Fim","duration":4.5}],"Caption":"x","tags":"#a #b"}');
    expect(r.content.pages).toEqual([
      { heading: 'Gancho', body: '', durationSec: 3 },
      { heading: 'Fim', body: '', durationSec: 4.5 },
    ]);
    expect(r.content.hashtags).toEqual(['#a', '#b']);
  });

  it('aceita lista na raiz e itens como texto', () => {
    const r = ok('["Primeira", {"titulo":"Segunda"}]');
    expect(r.content.pages.map((p) => p.heading)).toEqual(['Primeira', 'Segunda']);
  });

  it('avisa sobre itens vazios ou sem título', () => {
    const r = ok('{"paginas":[{"titulo":"A"},{},{"texto":"só texto"}, 42]}');
    expect(r.content.pages).toHaveLength(2);
    expect(r.warnings.join(' ')).toMatch(/vazia/);
    expect(r.warnings.join(' ')).toMatch(/sem título/);
    expect(r.warnings.join(' ')).toMatch(/ignorado/);
  });

  it('explica JSON inválido em vez de importar lixo', () => {
    const r = parseExternalResponse('{"paginas": [{"titulo": "A",}]');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/JSON, mas está inválida/);
  });

  it('reconhece JSON truncado (resposta cortada) como JSON inválido', () => {
    for (const input of ['{"paginas": [ quebrado', '```json\n{"paginas": [{"titulo": "A"\n```']) {
      const r = parseExternalResponse(input);
      expect(r.ok, input).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/JSON, mas está inválida/);
    }
  });

  it('explica JSON sem a lista de páginas', () => {
    const r = parseExternalResponse('{"legenda": "x"}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/paginas/);
  });
});

describe('parseExternalResponse — texto livre', () => {
  it('interpreta marcadores de slide, rótulos e metadados', () => {
    const r = ok(
      [
        '**Slide 1 — Capa**',
        'Título: IA no marketing',
        'Texto: O que muda em 2026',
        '',
        'Slide 2: Primeira dica',
        'Use dados próprios.',
        'Comece pequeno.',
        '',
        'Legenda: Um guia rápido.',
        'Segunda linha da legenda.',
        'CTA: Salve este post',
        'Hashtags: #ia #marketing',
      ].join('\n'),
    );
    expect(r.mode).toBe('text');
    expect(r.content.pages).toEqual([
      { heading: 'IA no marketing', body: 'O que muda em 2026' },
      { heading: 'Primeira dica', body: 'Use dados próprios.\nComece pequeno.' },
    ]);
    expect(r.content.caption).toBe('Um guia rápido.\nSegunda linha da legenda.');
    expect(r.content.cta).toBe('Salve este post');
    expect(r.content.hashtags).toEqual(['#ia', '#marketing']);
    expect(r.warnings[0]).toMatch(/marcadores/);
  });

  it('lê cenas com duração', () => {
    const r = ok('Cena 1\nTítulo: Gancho\nDuração: 3 segundos\n\nCena 2\nTítulo: Fim\nDuração: 4');
    expect(r.content.pages).toEqual([
      { heading: 'Gancho', body: '', durationSec: 3 },
      { heading: 'Fim', body: '', durationSec: 4 },
    ]);
  });

  it('sem marcadores, cada parágrafo vira uma página', () => {
    const r = ok('# Título A\nCorpo A\n\nTítulo B\nCorpo B1\nCorpo B2\n\nLegenda: texto final');
    expect(r.content.pages).toEqual([
      { heading: 'Título A', body: 'Corpo A' },
      { heading: 'Título B', body: 'Corpo B1\nCorpo B2' },
    ]);
    expect(r.content.caption).toBe('texto final');
    expect(r.warnings[0]).toMatch(/parágrafo/);
  });

  it('trata "Título:" repetido sem marcador como nova página', () => {
    const r = ok('Título: A\nTexto: a\nTítulo: B\nTexto: b');
    expect(r.content.pages.map((p) => p.heading)).toEqual(['A', 'B']);
  });
});

describe('parseExternalResponse — limites', () => {
  it('rejeita entrada vazia', () => {
    expect(parseExternalResponse('   ').ok).toBe(false);
  });
  it('rejeita entrada grande demais', () => {
    const r = parseExternalResponse('a'.repeat(MAX_IMPORT_CHARS + 1));
    expect(r.ok).toBe(false);
  });
});

describe('importWarnings', () => {
  const pages = (n: number) => Array.from({ length: n }, (_, i) => ({ heading: `P${i}`, body: '' }));
  it('avisa sobre truncamento e páginas faltantes', () => {
    expect(importWarnings({ pages: pages(12) }, 'carousel')[0]).toMatch(/primeiras 10/);
    expect(importWarnings({ pages: pages(1) }, 'carousel')[0]).toMatch(/exige 2/);
    expect(importWarnings({ pages: pages(3) }, 'carousel')).toEqual([]);
  });
  it('avisa que durações só valem em motion', () => {
    expect(importWarnings({ pages: [{ heading: 'a', body: '', durationSec: 3 }] }, 'post')[0]).toMatch(/Motion/);
  });
});
