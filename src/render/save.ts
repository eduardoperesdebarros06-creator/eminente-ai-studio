/** Formas de gravar os arquivos gerados: pasta escolhida, downloads ou ZIP. */
import { downloadBlob } from '../lib/files';
import { createZip } from '../lib/zip';

export interface OutputFile {
  name: string;
  blob: Blob;
}

interface WritableLike {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}
interface FileHandleLike {
  createWritable(): Promise<WritableLike>;
  getFile(): Promise<File>;
}
interface DirHandleLike {
  name: string;
  getFileHandle(name: string, opts: { create: boolean }): Promise<FileHandleLike>;
}
type DirectoryPicker = (opts?: { id?: string; mode?: 'read' | 'readwrite'; startIn?: string }) => Promise<DirHandleLike>;

function picker(): DirectoryPicker | null {
  const w = window as unknown as { showDirectoryPicker?: DirectoryPicker };
  return typeof w.showDirectoryPicker === 'function' ? w.showDirectoryPicker.bind(window) : null;
}

/** Edge e Chrome (Windows) permitem gravar diretamente numa pasta escolhida. */
export const supportsFolderSave = (): boolean => typeof window !== 'undefined' && picker() !== null;

export class SaveCancelled extends Error {
  constructor() {
    super('Operação cancelada.');
    this.name = 'SaveCancelled';
  }
}

/** Pede a pasta ao usuário (precisa ocorrer logo após o clique). */
export async function pickFolder(): Promise<DirHandleLike> {
  const pick = picker();
  if (!pick) throw new Error('Este navegador não permite escolher uma pasta. Use "Baixar" ou ".zip".');
  try {
    return await pick({ id: 'eminente-export', mode: 'readwrite', startIn: 'pictures' });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new SaveCancelled();
    throw e;
  }
}

/** Grava os arquivos na pasta e confere o tamanho de cada um depois de gravado. */
export async function writeToFolder(dir: DirHandleLike, file: OutputFile): Promise<void> {
  try {
    const handle = await dir.getFileHandle(file.name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file.blob);
    await writable.close();
    const written = await handle.getFile();
    if (written.size !== file.blob.size) {
      throw new Error(`gravado com ${written.size} bytes, esperado ${file.blob.size}.`);
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'NotAllowedError') {
      throw new Error('Sem permissão para gravar na pasta escolhida.');
    }
    throw new Error(`Falha ao gravar "${file.name}": ${e instanceof Error ? e.message : String(e)}`);
  }
}


const pause = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/** Downloads sequenciais (o navegador pode pedir permissão para vários arquivos). */
export async function downloadAll(files: readonly OutputFile[]): Promise<void> {
  for (const f of files) {
    downloadBlob(f.name, f.blob);
    await pause(350);
  }
}

export async function zipFiles(files: readonly OutputFile[]): Promise<Blob> {
  const entries = await Promise.all(files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) })));
  return new Blob([createZip(entries) as BlobPart], { type: 'application/zip' });
}
