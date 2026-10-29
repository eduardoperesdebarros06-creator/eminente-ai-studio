import { describe, expect, it } from 'vitest';
import { readPngInfo } from './png';
import { crc32, createZip } from './zip';

/** PNG 1×1 real (gerado por um encoder padrão). */
const TINY_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/eL9GtQAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

describe('readPngInfo', () => {
  it('lê dimensões de um PNG real', () => {
    expect(readPngInfo(TINY_PNG)).toEqual({ width: 1, height: 1, bitDepth: 8, colorType: 6 });
  });

  it('lê dimensões grandes do IHDR', () => {
    const fake = TINY_PNG.slice();
    new DataView(fake.buffer).setUint32(16, 1080);
    new DataView(fake.buffer).setUint32(20, 1350);
    expect(readPngInfo(fake)).toMatchObject({ width: 1080, height: 1350 });
  });

  it('rejeita bytes que não são PNG', () => {
    expect(readPngInfo(new TextEncoder().encode('not a png at all, definitely not a png'))).toBeNull();
    expect(readPngInfo(TINY_PNG.slice(0, 20))).toBeNull();
  });
});

describe('zip', () => {
  it('crc32 confere com valores conhecidos', () => {
    expect(crc32(new TextEncoder().encode('hello'))).toBe(0x3610a686);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('gera estrutura ZIP válida (assinaturas, tamanhos e diretório central)', () => {
    const files = [
      { name: '01-capa.png', data: TINY_PNG },
      { name: 'ção.txt', data: new TextEncoder().encode('olá') },
    ];
    const zip = createZip(files, new Date(2026, 9, 29, 12, 30, 10));
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const eocd = zip.length - 22;
    expect(view.getUint32(eocd, true)).toBe(0x06054b50);
    expect(view.getUint16(eocd + 10, true)).toBe(2);
    const cdOffset = view.getUint32(eocd + 16, true);
    expect(view.getUint32(cdOffset, true)).toBe(0x02014b50);
    // Primeira entrada: CRC e conteúdo íntegros.
    expect(view.getUint32(14, true)).toBe(crc32(TINY_PNG));
    const nameLen = view.getUint16(26, true);
    expect(new TextDecoder().decode(zip.slice(30, 30 + nameLen))).toBe('01-capa.png');
    expect(zip.slice(30 + nameLen, 30 + nameLen + TINY_PNG.length)).toEqual(TINY_PNG);
  });

  it('recusa nomes duplicados ou inválidos', () => {
    const d = new Uint8Array([1]);
    expect(() => createZip([{ name: 'a', data: d }, { name: 'a', data: d }])).toThrow(/duplicado/);
    expect(() => createZip([{ name: '/abs', data: d }])).toThrow(/inválido/);
  });
});
