import { Copy, FileJson, FileText } from 'lucide-react';
import { Button, useToast } from '../../components/ui';
import { draftToCaptionText, draftToMarkdown, exportFileName } from '../../domain/content/export';
import { serializeDraft } from '../../domain/content/serialize';
import type { ContentDraft } from '../../domain/content/types';
import type { DraftValidation } from '../../domain/content/validate';
import { copyText, downloadText } from '../../lib/files';
import { recordExport } from '../library/librarySync';

export function ExportActions({ draft, validation }: { draft: ContentDraft; validation: DraftValidation }) {
  const toast = useToast();
  const blocked = !validation.ok;
  const reason = blocked ? `Corrija ${validation.errors.length === 1 ? 'o erro' : `os ${validation.errors.length} erros`} para exportar.` : undefined;

  async function copy(text: string, what: string) {
    try {
      await copyText(text);
      toast({ tone: 'success', title: `${what} copiado.` });
    } catch (e) {
      toast({ tone: 'danger', title: 'Não foi possível copiar.', description: e instanceof Error ? e.message : String(e) });
    }
  }

  function download(kind: 'md' | 'json') {
    try {
      const name = exportFileName(draft, kind);
      const text = kind === 'md' ? draftToMarkdown(draft) : serializeDraft(draft);
      downloadText(name, text, kind === 'md' ? 'text/markdown' : 'application/json');
      void recordExport(draft, [{ kind, name, bytes: new TextEncoder().encode(text).length }]);
      toast({ tone: 'success', title: 'Arquivo gerado.', description: `${name} — verifique a pasta de downloads do navegador.` });
    } catch (e) {
      toast({ tone: 'danger', title: 'Falha ao gerar o arquivo.', description: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="export-actions" title={reason}>
      <Button size="sm" icon={Copy} disabled={blocked} onClick={() => copy(draftToCaptionText(draft), 'Texto da publicação')}>
        Copiar legenda
      </Button>
      <Button size="sm" icon={Copy} disabled={blocked} onClick={() => copy(draftToMarkdown(draft), 'Conteúdo completo')}>
        Copiar tudo
      </Button>
      <Button size="sm" icon={FileText} disabled={blocked} onClick={() => download('md')} aria-label="Baixar .md" title="Baixar o conteúdo em Markdown">
        .md
      </Button>
      <Button size="sm" icon={FileJson} disabled={blocked} onClick={() => download('json')} aria-label="Baixar .json" title="Baixar o conteúdo em JSON (pode ser reaberto depois)">
        .json
      </Button>
      {reason && <span className="export-actions__reason">{reason}</span>}
    </div>
  );
}
