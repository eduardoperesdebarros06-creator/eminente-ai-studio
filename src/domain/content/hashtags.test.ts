import { describe, expect, it } from 'vitest';
import { parseHashtags } from './hashtags';

describe('parseHashtags', () => {
  it('normaliza separadores, prefixo e caracteres inválidos', () => {
    expect(parseHashtags('#ia marketing, ##B2B; gestão-digital')).toEqual(['#ia', '#marketing', '#B2B', '#gestãodigital']);
  });

  it('remove duplicatas sem diferenciar maiúsculas', () => {
    expect(parseHashtags(['#IA', 'ia', '#Ia'])).toEqual(['#IA']);
  });

  it('ignora entradas vazias', () => {
    expect(parseHashtags('  #  , ;  ')).toEqual([]);
  });
});
