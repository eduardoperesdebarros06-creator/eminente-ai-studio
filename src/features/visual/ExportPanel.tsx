import { CheckCircle2, Download, FileArchive, FolderDown, ImageDown, X } from 'lucide-react';
import { Alert, Button, Card, CardHeader, ProgressBar } from '../../components/ui';
import { supportsFolderSave } from '../../render/save';
import type { ExportMode, ExportState } from './useExport';

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024)).toLocaleString('pt-BR')} KB`;

export function ExportPanel({
  kind,
  state,
  blockedReason,
  pageCount,
  currentLabel,
  onExport,
  onDismiss,
}: {
  kind: 'post' | 'carousel';
  state: ExportState;
  /** Motivo do bloqueio (erros no conteúdo/layout); `null` libera. */
  blockedReason: string | null;
  pageCount: number;
  currentLabel: string;
  onExport: (mode: ExportMode) => void;
  onDismiss: () => void;
}) {
  const busy = state.status === 'running';
  const disabled = busy || blockedReason !== null;
  const folder = supportsFolderSave();

  return (
    <Card className="studio-panel export-panel">
      <CardHeader title="Exportar PNG" description={kind === 'post' ? 'Arquivo na resolução final do formato.' : `${pageCount} arquivos, um por página.`} />
      <div className="studio-panel__body">
        {blockedReason && <Alert tone="danger" title="Exportação bloqueada">{blockedReason}</Alert>}

        {kind === 'post' ? (
          <Button variant="primary" icon={ImageDown} disabled={disabled} onClick={() => onExport('current')}>
            Baixar PNG
          </Button>
        ) : (
          <div className="export-panel__actions">
            {folder && (
              <Button variant="primary" icon={FolderDown} disabled={disabled} onClick={() => onExport('folder')}>
                Salvar todas em pasta…
              </Button>
            )}
            <Button variant={folder ? 'secondary' : 'primary'} icon={Download} disabled={disabled} onClick={() => onExport('download')}>
              Baixar todas ({pageCount} PNG)
            </Button>
            <Button icon={FileArchive} disabled={disabled} onClick={() => onExport('zip')}>
              Baixar .zip
            </Button>
            <Button variant="ghost" icon={ImageDown} disabled={disabled} onClick={() => onExport('current')}>
              Só a {currentLabel}
            </Button>
            {!folder && (
              <p className="source__note">
                Para gravar direto numa pasta, use Edge ou Chrome. Ao baixar vários arquivos, o navegador pode pedir permissão.
              </p>
            )}
          </div>
        )}

        {state.status === 'running' && (
          <ProgressBar value={(state.done / state.total) * 100} label={state.step} detail={`${state.done} / ${state.total}`} />
        )}

        {state.status === 'error' && (
          <Alert tone="danger" title="A exportação falhou." actions={<Button size="sm" icon={X} onClick={onDismiss}>Fechar</Button>}>
            <p>{state.message}</p>
            {state.files.length > 0 && <p>{state.files.length} arquivo(s) foram gerados antes da falha.</p>}
          </Alert>
        )}

        {state.status === 'done' && (
          <div className="export-result" role="status">
            <p className="export-result__title">
              <CheckCircle2 size={16} aria-hidden />
              {state.files.length === 1 ? '1 arquivo exportado' : `${state.files.length} arquivos exportados`} · {state.destination}
            </p>
            {state.zipName && <p className="export-result__zip mono">{state.zipName}</p>}
            <ul className="export-result__list">
              {state.files.map((f) => (
                <li key={f.name}>
                  <span className="mono export-result__name">{f.name}</span>
                  <span className="export-result__meta">
                    {f.width} × {f.height} · {kb(f.bytes)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="source__note">Dimensões conferidas no cabeçalho de cada PNG antes de salvar.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
