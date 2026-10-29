/**
 * Gerador de arquivo ZIP mínimo (método "store", sem compressão) — suficiente
 * para empacotar PNGs, que já são comprimidos. Sem dependências.
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const MAX_ZIP_BYTES = 0xffffffff;

export function createZip(entries: readonly ZipEntry[], now = new Date()): Uint8Array {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(now);
  const names = entries.map((e) => encoder.encode(e.name));
  const seen = new Set<string>();
  for (const e of entries) {
    if (!e.name || e.name.includes('\\') || e.name.startsWith('/')) throw new Error(`Nome de arquivo inválido no ZIP: "${e.name}".`);
    if (seen.has(e.name)) throw new Error(`Arquivo duplicado no ZIP: "${e.name}".`);
    seen.add(e.name);
  }

  const localSize = entries.reduce((s, e, i) => s + 30 + names[i]!.length + e.data.length, 0);
  const centralSize = names.reduce((s, n) => s + 46 + n.length, 0);
  const total = localSize + centralSize + 22;
  if (total > MAX_ZIP_BYTES || entries.length > 0xffff) throw new Error('Conteúdo grande demais para um ZIP simples.');

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let p = 0;
  const offsets: number[] = [];
  const crcs = entries.map((e) => crc32(e.data));
  const UTF8_FLAG = 0x0800;

  entries.forEach((e, i) => {
    const name = names[i]!;
    offsets.push(p);
    view.setUint32(p, 0x04034b50, true);
    view.setUint16(p + 4, 20, true);
    view.setUint16(p + 6, UTF8_FLAG, true);
    view.setUint16(p + 8, 0, true);
    view.setUint16(p + 10, time, true);
    view.setUint16(p + 12, date, true);
    view.setUint32(p + 14, crcs[i]!, true);
    view.setUint32(p + 18, e.data.length, true);
    view.setUint32(p + 22, e.data.length, true);
    view.setUint16(p + 26, name.length, true);
    view.setUint16(p + 28, 0, true);
    out.set(name, p + 30);
    out.set(e.data, p + 30 + name.length);
    p += 30 + name.length + e.data.length;
  });

  const cdStart = p;
  entries.forEach((e, i) => {
    const name = names[i]!;
    view.setUint32(p, 0x02014b50, true);
    view.setUint16(p + 4, 20, true);
    view.setUint16(p + 6, 20, true);
    view.setUint16(p + 8, UTF8_FLAG, true);
    view.setUint16(p + 10, 0, true);
    view.setUint16(p + 12, time, true);
    view.setUint16(p + 14, date, true);
    view.setUint32(p + 16, crcs[i]!, true);
    view.setUint32(p + 20, e.data.length, true);
    view.setUint32(p + 24, e.data.length, true);
    view.setUint16(p + 28, name.length, true);
    // extra, comentário, disco, atributos internos/externos = 0
    view.setUint32(p + 42, offsets[i]!, true);
    out.set(name, p + 46);
    p += 46 + name.length;
  });

  view.setUint32(p, 0x06054b50, true);
  view.setUint16(p + 8, entries.length, true);
  view.setUint16(p + 10, entries.length, true);
  view.setUint32(p + 12, p - cdStart, true);
  view.setUint32(p + 16, cdStart, true);
  return out;
}
