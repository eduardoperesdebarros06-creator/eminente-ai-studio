import type { Scene } from '../domain/design/layout';
import { readPngInfo } from '../lib/png';
import { drawScene, ensureFonts } from './canvas';

export interface RenderedPng {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Renderiza a cena em resolução final e devolve um PNG verificado: o
 * cabeçalho é lido de volta e as dimensões precisam bater com o formato.
 */
export async function renderScenePng(scene: Scene): Promise<RenderedPng> {
  await ensureFonts();
  const canvas = document.createElement('canvas');
  canvas.width = scene.width;
  canvas.height = scene.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador.');
  drawScene(ctx, scene);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('O navegador não conseguiu gerar o PNG (memória insuficiente?).');
  const info = readPngInfo(new Uint8Array(await blob.arrayBuffer()));
  if (!info) throw new Error('O arquivo gerado não é um PNG válido.');
  if (info.width !== scene.width || info.height !== scene.height) {
    throw new Error(`PNG com ${info.width}×${info.height}, mas o formato exige ${scene.width}×${scene.height}.`);
  }
  return { blob, width: info.width, height: info.height, bytes: blob.size };
}
