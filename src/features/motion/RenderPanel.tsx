import { CheckCircle2, CircleSlash, Clapperboard, Download, RefreshCw, X, XCircle } from 'lucide-react';
import { Alert, Button, Card, CardHeader, ProgressBar, Spinner } from '../../components/ui';
import type { JobStatus, ToolCheck } from '../../domain/motion/api';
import { formatTime } from '../../domain/motion/timeline';
import type { VideoSpec } from '../../domain/motion/video';
import type { HealthState } from './useRenderJob';

const mb = (n: number) => `${(n / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;

const STEP_LABEL: Record<JobStatus['state'], string> = {
  starting: 'Preparando',
  rendering: 'Renderizando quadros',
  encoding: 'Codificando MP4',
  verifying: 'Conferindo o arquivo',
  done: 'Pronto',
  error: 'Falhou',
  cancelled: 'Cancelado',
};

function Tool({ name, check }: { name: string; check: ToolCheck }) {
  return (
    <li className={check.ok ? 'tools__item' : 'tools__item tools__item--missing'}>
      {check.ok ? <CheckCircle2 size={14} aria-hidden /> : <XCircle size={14} aria-hidden />}
      <span className="tools__name">{name}</span>
      <span className="tools__detail">{check.detail}</span>
    </li>
  );
}

export function RenderPanel({
  spec,
  health,
  onRefreshHealth,
  job,
  error,
  starting,
  blockedReason,
  onRender,
  onCancel,
  onDismiss,
}: {
  spec: VideoSpec;
  health: HealthState;
  onRefreshHealth: () => void;
  job: JobStatus | null;
  error: string | null;
  starting: boolean;
  /** Erros de conteúdo/layout; `null` libera. */
  blockedReason: string | null;
  onRender: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const h = health.status === 'ready' ? health.health : null;
  const toolsOk = h !== null && h.ffmpeg.ok && h.ffprobe.ok && h.browser.ok;
  const running = job !== null && !['done', 'error', 'cancelled'].includes(job.state);
  const disabled = starting || running || blockedReason !== null || !toolsOk;

  return (
    <Card className="studio-panel export-panel">
      <CardHeader
        title="Exportar MP4"
        description={`${spec.width} × ${spec.height} px · ${spec.fps} fps · ${formatTime(spec.durationSec)} · ${spec.totalFrames.toLocaleString('pt-BR')} quadros · H.264`}
        actions={
          <Button size="sm" variant="ghost" icon={RefreshCw} onClick={onRefreshHealth} disabled={health.status === 'loading'}>
            Verificar ferramentas
          </Button>
        }
      />
      <div className="studio-panel__body">
        {health.status === 'loading' && (
          <p className="stage__loading">
            <Spinner size={16} /> Verificando FFmpeg e navegador…
          </p>
        )}
        {health.status === 'offline' && (
          <Alert tone="danger" title="Servidor de renderização indisponível">
            {health.message}
          </Alert>
        )}
        {h && (
          <ul className="tools" aria-label="Ferramentas de renderização">
            <Tool name="FFmpeg" check={h.ffmpeg} />
            <Tool name="ffprobe" check={h.ffprobe} />
            <Tool name="Navegador" check={h.browser} />
          </ul>
        )}
        {h && !toolsOk && (
          <Alert tone="warning" title="Falta instalar ferramentas">
            Veja a seção “Pré-requisitos” do README. Depois de instalar, feche e reabra o terminal, rode <code>npm run dev</code> de novo e
            clique em “Verificar ferramentas”.
          </Alert>
        )}

        {blockedReason && <Alert tone="danger" title="Renderização bloqueada">{blockedReason}</Alert>}

        <div className="export-panel__actions">
          <Button variant="primary" icon={Clapperboard} disabled={disabled} loading={starting} onClick={onRender}>
            Renderizar MP4
          </Button>
          {running && (
            <Button icon={CircleSlash} onClick={onCancel}>
              Cancelar
            </Button>
          )}
        </div>

        {running && job && (
          <ProgressBar
            value={job.state === 'rendering' ? (job.framesDone / job.totalFrames) * 100 : job.state === 'starting' ? undefined : 100}
            label={job.message || STEP_LABEL[job.state]}
            detail={job.state === 'rendering' ? `${job.framesDone} / ${job.totalFrames}` : undefined}
          />
        )}

        {error && (
          <Alert tone="danger" title="Não foi possível renderizar." actions={<Button size="sm" icon={X} onClick={onDismiss}>Fechar</Button>}>
            {error}
          </Alert>
        )}

        {job?.state === 'error' && (
          <Alert tone="danger" title="A renderização falhou." actions={<Button size="sm" icon={X} onClick={onDismiss}>Fechar</Button>}>
            {job.message}
          </Alert>
        )}
        {job?.state === 'cancelled' && (
          <Alert tone="info" title="Renderização cancelada." actions={<Button size="sm" icon={X} onClick={onDismiss}>Fechar</Button>}>
            Nenhum arquivo foi gravado.
          </Alert>
        )}

        {job?.state === 'done' && job.file && (
          <div className="export-result" role="status">
            <p className="export-result__title">
              <CheckCircle2 size={16} aria-hidden />
              Vídeo exportado e conferido
            </p>
            <ul className="export-result__list">
              <li>
                <span className="mono export-result__name">{job.file.name}</span>
                <span className="export-result__meta">
                  {job.file.probe.width} × {job.file.probe.height} · {job.file.spec.fps} fps · {job.file.probe.durationSec.toFixed(2)} s ·{' '}
                  {mb(job.file.bytes)}
                </span>
              </li>
            </ul>
            <p className="source__note">
              Gravado em <span className="mono">{job.file.path}</span>. Resolução, FPS, quadros e duração conferidos com o ffprobe.
            </p>
            <div className="export-panel__actions">
              <a className="btn btn--secondary btn--sm" href={`/api/motion/files/${encodeURIComponent(job.file.name)}`} download={job.file.name}>
                <Download size={14} aria-hidden />
                <span>Baixar cópia</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
