import { useCallback, useRef, useState } from 'react';
import { slugify } from '../../domain/content/export';
import type { ContentDraft } from '../../domain/content/types';
import { slideFileName, type Scene } from '../../domain/design/layout';
import { downloadBlob } from '../../lib/files';
import { renderScenePng } from '../../render/png';
import { downloadAll, pickFolder, SaveCancelled, writeToFolder, zipFiles, type OutputFile } from '../../render/save';

export type ExportMode = 'current' | 'download' | 'folder' | 'zip';

export interface ExportedFile {
  name: string;
  width: number;
  height: number;
  bytes: number;
}

export type ExportState =
  | { status: 'idle' }
  | { status: 'running'; done: number; total: number; step: string }
  | { status: 'done'; files: ExportedFile[]; destination: string; zipName?: string }
  | { status: 'error'; message: string; files: ExportedFile[] };

export function baseName(draft: ContentDraft): string {
  const kind = draft.brief.format === 'post' ? 'post' : 'carrossel';
  return `eminente-${kind}-${slugify(draft.brief.subject)}`;
}

/**
 * Exporta PNGs reais. Cada página é renderizada, verificada (cabeçalho e
 * dimensões) e então gravada no destino escolhido, com progresso por página.
 */
export function useExport(draft: ContentDraft, scenes: readonly Scene[]) {
  const [state, setState] = useState<ExportState>({ status: 'idle' });
  const running = useRef(false);

  const run = useCallback(
    async (mode: ExportMode, currentIndex: number) => {
      if (running.current) return;
      running.current = true;
      const base = baseName(draft);
      const indices = mode === 'current' ? [currentIndex] : scenes.map((_, i) => i);
      const total = indices.length;
      const produced: ExportedFile[] = [];
      try {
        // A pasta precisa ser escolhida logo após o clique (exigência do navegador).
        const folder = mode === 'folder' ? await pickFolder() : null;
        const files: OutputFile[] = [];
        for (const [n, i] of indices.entries()) {
          const scene = scenes[i]!;
          const page = draft.pages[i]!;
          const name = slideFileName(base, i, draft.pages.length, page.role, scene.width, scene.height);
          setState({ status: 'running', done: n, total, step: `Renderizando ${name}` });
          let png;
          try {
            png = await renderScenePng(scene);
          } catch (e) {
            throw new Error(`Página ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
          }
          if (folder) {
            setState({ status: 'running', done: n, total, step: `Gravando ${name}` });
            await writeToFolder(folder, { name, blob: png.blob });
          } else {
            files.push({ name, blob: png.blob });
          }
          produced.push({ name, width: png.width, height: png.height, bytes: png.bytes });
        }

        if (folder) {
          setState({ status: 'done', files: produced, destination: `Pasta “${folder.name}”` });
        } else if (mode === 'zip') {
          setState({ status: 'running', done: total, total, step: 'Compactando .zip' });
          const zipName = `${base}-${scenes[0]!.width}x${scenes[0]!.height}.zip`;
          downloadBlob(zipName, await zipFiles(files));
          setState({ status: 'done', files: produced, destination: 'Downloads do navegador (.zip)', zipName });
        } else {
          setState({ status: 'running', done: total, total, step: 'Iniciando downloads' });
          if (files.length === 1) downloadBlob(files[0]!.name, files[0]!.blob);
          else await downloadAll(files);
          setState({ status: 'done', files: produced, destination: 'Downloads do navegador' });
        }
      } catch (e) {
        if (e instanceof SaveCancelled) setState({ status: 'idle' });
        else setState({ status: 'error', message: e instanceof Error ? e.message : String(e), files: produced });
      } finally {
        running.current = false;
      }
    },
    [draft, scenes],
  );

  const reset = useCallback(() => setState({ status: 'idle' }), []);
  return { state, run, reset };
}
