/** Operações de arquivo e área de transferência no navegador. */

/** Dispara o download de um arquivo real pelo navegador. */
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoga depois que o navegador iniciou o download.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Gera um arquivo de texto e dispara o download. */
export function downloadText(fileName: string, content: string, mime: string): void {
  downloadBlob(fileName, new Blob([content], { type: `${mime};charset=utf-8` }));
}

/** Copia texto; usa a API moderna e recorre ao método legado se necessário. */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Permissão negada ou contexto inseguro: tenta o método legado.
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('O navegador bloqueou o acesso à área de transferência.');
}

export const MAX_OPEN_FILE_BYTES = 2 * 1024 * 1024;

/** Lê um arquivo de texto escolhido pelo usuário, com limite de tamanho. */
export async function readTextFile(file: File, maxBytes = MAX_OPEN_FILE_BYTES): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(`O arquivo tem ${(file.size / 1024 / 1024).toFixed(1)} MB; o limite é ${maxBytes / 1024 / 1024} MB.`);
  }
  return file.text();
}
