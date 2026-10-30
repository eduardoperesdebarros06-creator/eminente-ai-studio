import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, PenLine, XCircle } from 'lucide-react';
import { getModule } from '../../app/modules';
import { Alert, Badge, ButtonLink, Card, CardHeader, EmptyState, PageHeader, Spinner, TextArea, TextInput } from '../../components/ui';
import type { DraftAction } from '../../domain/content/draft';
import { LIMITS } from '../../domain/content/limits';
import { FORMAT_LABELS, ROLE_LABELS, type ContentDraft } from '../../domain/content/types';
import type { Scene } from '../../domain/design/layout';
import { motionPlan } from '../../domain/motion/plan';
import { formatTime } from '../../domain/motion/timeline';
import { cx } from '../../lib/cx';
import { useContentDraft } from '../content/useContentDraft';
import { DesignControls } from '../visual/DesignControls';
import { useScenes } from '../visual/useScenes';
import { MotionStage } from './MotionStage';
import { RenderPanel } from './RenderPanel';
import { useMotionPlayer } from './useMotionPlayer';
import { useRenderJob } from './useRenderJob';

interface Problem {
  severity: 'error' | 'warning';
  sceneIndex: number | null;
  message: string;
}

function collectProblems(
  draft: ContentDraft,
  scenes: readonly Scene[],
  errors: { pageId?: string; message: string }[],
  warnings: { pageId?: string; message: string }[],
): Problem[] {
  const indexOf = (id?: string) => {
    const i = id ? draft.pages.findIndex((p) => p.id === id) : -1;
    return i >= 0 ? i : null;
  };
  const out: Problem[] = errors.map((e) => ({ severity: 'error', sceneIndex: indexOf(e.pageId), message: e.message }));
  scenes.forEach((s, i) => {
    for (const issue of s.issues) {
      // Título vazio já é apontado pela validação do conteúdo.
      if (issue.message.includes('vazio')) continue;
      out.push({ severity: 'error', sceneIndex: i, message: `Cena ${i + 1}: ${issue.message}` });
    }
  });
  for (const w of warnings) out.push({ severity: 'warning', sceneIndex: indexOf(w.pageId), message: w.message });
  return out;
}

function SceneEdit({ draft, index, scene, dispatch }: { draft: ContentDraft; index: number; scene: Scene | undefined; dispatch: (a: DraftAction) => void }) {
  const page = draft.pages[index];
  if (!page) return null;
  const issue = (field: 'heading' | 'body' | 'cta') => scene?.issues.find((i) => i.field === field)?.message;
  const { min, max } = LIMITS.sceneDuration;
  return (
    <Card className="studio-panel">
      <CardHeader title={`Cena ${index + 1} · ${ROLE_LABELS[page.role]}`} description="Ajustes rápidos. A edição completa fica no Content Studio." />
      <div className="form studio-panel__body">
        <TextArea
          label="Título"
          rows={2}
          value={page.heading}
          onChange={(e) => dispatch({ type: 'page/update', id: page.id, patch: { heading: e.target.value } })}
          error={issue('heading')}
          counter={{ current: page.heading.trim().length, max: LIMITS.heading.max }}
        />
        <TextArea
          label="Texto"
          rows={3}
          value={page.body}
          onChange={(e) => dispatch({ type: 'page/update', id: page.id, patch: { body: e.target.value } })}
          error={issue('body')}
          counter={{ current: page.body.trim().length, max: LIMITS.body.max }}
        />
        <TextInput
          label="Duração (segundos)"
          type="number"
          min={min}
          max={max}
          step={0.5}
          value={page.durationSec}
          onChange={(e) => {
            const v = e.target.valueAsNumber;
            if (Number.isFinite(v)) dispatch({ type: 'page/update', id: page.id, patch: { durationSec: v } });
          }}
          hint={`De ${min} a ${max} s por cena; até ${LIMITS.motionTotalMax} s no total.`}
        />
        {page.role === 'cta' && (
          <TextArea
            label="CTA (pílula)"
            rows={1}
            value={draft.cta}
            onChange={(e) => dispatch({ type: 'meta/set', patch: { cta: e.target.value } })}
            error={issue('cta')}
            hint="O mesmo CTA da legenda."
          />
        )}
      </div>
    </Card>
  );
}

export function MotionStudioPage() {
  const module = getModule('motion');
  const { draft, dispatch, validation } = useContentDraft();
  const { fonts, scenes } = useScenes(draft);
  const [selected, setSelected] = useState(0);
  const render = useRenderJob();

  const isMotion = draft.brief.format === 'motion' && draft.pages.length > 0;
  // A linha do tempo só existe com durações válidas; se alguma não for, a validação já aponta.
  const plan = useMemo(() => {
    if (!isMotion) return null;
    try {
      return motionPlan(draft);
    } catch {
      return null;
    }
  }, [isMotion, draft]);
  const player = useMotionPlayer(plan?.timeline ?? null);
  const problems = useMemo(
    () => collectProblems(draft, scenes, validation.errors, validation.warnings),
    [draft, scenes, validation],
  );
  const errorCount = problems.filter((p) => p.severity === 'error').length;
  const index = Math.min(selected, Math.max(0, draft.pages.length - 1));

  const header = (
    <PageHeader
      eyebrow="Criação"
      title={module.label}
      description={module.description}
      meta={
        <>
          <Badge tone="accent">{FORMAT_LABELS[draft.brief.format]}</Badge>
          {draft.brief.subject && <Badge>{draft.brief.subject}</Badge>}
          {plan && <Badge>{formatTime(plan.timeline.durationSec)}</Badge>}
        </>
      }
      actions={
        <ButtonLink to="/content" icon={PenLine}>
          Editar no Content Studio
        </ButtonLink>
      }
    />
  );

  if (draft.pages.length === 0 || draft.brief.format !== 'motion') {
    const other = draft.brief.format;
    const empty = draft.pages.length === 0;
    return (
      <div className="page">
        {header}
        <Card padding="none">
          <EmptyState
            icon={empty ? PenLine : AlertTriangle}
            title={empty ? 'Nenhum roteiro para animar' : `O conteúdo atual é ${other === 'carousel' ? 'um carrossel' : 'um post'}`}
            description={
              empty
                ? 'Crie o roteiro no Content Studio com o formato "Motion" (cenas com duração) e volte aqui para animar e exportar o MP4.'
                : 'Para gerar vídeo, mude o formato para "Motion" no Content Studio, ou abra o estúdio correspondente.'
            }
            actions={
              <>
                {!empty && (
                  <ButtonLink to={other === 'carousel' ? '/carousel' : '/design'} variant="primary" iconRight={ArrowRight}>
                    Abrir no {other === 'carousel' ? 'Carousel Studio' : 'Design Studio'}
                  </ButtonLink>
                )}
                <ButtonLink to="/content" variant={empty ? 'primary' : 'secondary'} icon={empty ? undefined : ArrowLeft} iconRight={empty ? ArrowRight : undefined}>
                  {empty ? 'Ir para o Content Studio' : 'Content Studio'}
                </ButtonLink>
              </>
            }
          />
        </Card>
      </div>
    );
  }

  const blockedReason =
    fonts.status === 'error'
      ? fonts.message
      : fonts.status === 'loading'
        ? 'Aguardando o carregamento das fontes.'
        : errorCount > 0
          ? `Corrija ${errorCount === 1 ? 'o problema apontado' : `os ${errorCount} problemas apontados`} para renderizar. Texto cortado ou faltando não é exportado.`
          : null;

  return (
    <div className="page">
      {header}
      <div className="visual">
        <div className="studio__side">
          <DesignControls draft={draft} dispatch={dispatch} />
          <SceneEdit draft={draft} index={index} scene={scenes[index]} dispatch={dispatch} />
        </div>

        <div className="studio__main">
          {fonts.status === 'error' && <Alert tone="danger" title="Falha ao carregar a fonte">{fonts.message}</Alert>}

          {fonts.status === 'loading' || scenes.length === 0 ? (
            <div className="stage">
              <div className="stage__loading">
                <Spinner size={20} /> Carregando fontes…
              </div>
            </div>
          ) : plan ? (
            <MotionStage
              scenes={scenes}
              timeline={plan.timeline}
              frame={player.frame}
              playing={player.playing}
              onToggle={player.toggle}
              onSeek={player.seek}
              selected={index}
              onSelectScene={setSelected}
              sceneHasError={(i) => problems.some((p) => p.severity === 'error' && p.sceneIndex === i)}
            />
          ) : (
            <Alert tone="danger" title="Linha do tempo inválida">
              Alguma cena está com duração inválida. Corrija a duração para pré-visualizar.
            </Alert>
          )}
          {plan && (
            <p className="stage__caption">
              Pré-visualização reduzida · o MP4 sai em {plan.spec.width} × {plan.spec.height} px com o mesmo desenho
            </p>
          )}

          {problems.length > 0 && (
            <div className={cx('issues', errorCount ? 'issues--error' : 'issues--warning')}>
              <p className="issues__summary">
                {errorCount ? <XCircle size={16} aria-hidden /> : <AlertTriangle size={16} aria-hidden />}
                {errorCount
                  ? `${errorCount} ${errorCount === 1 ? 'problema impede' : 'problemas impedem'} a renderização`
                  : `${problems.length} ${problems.length === 1 ? 'aviso' : 'avisos'}`}
              </p>
              <ul className="issues__list">
                {problems.map((p, i) => (
                  <li key={`${p.message}-${i}`}>
                    <button
                      type="button"
                      className={cx('issues__item', `issues__item--${p.severity}`)}
                      onClick={() => {
                        if (p.sceneIndex === null) return;
                        setSelected(p.sceneIndex);
                        if (plan) player.seek(Math.round(plan.timeline.scenes[p.sceneIndex]!.start * plan.timeline.fps));
                      }}
                    >
                      {p.message}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {plan && (
            <RenderPanel
              spec={plan.spec}
              health={render.health}
              onRefreshHealth={() => void render.refreshHealth()}
              job={render.job}
              error={render.error}
              starting={render.starting}
              blockedReason={blockedReason}
              onRender={() => void render.start(draft)}
              onCancel={() => void render.cancel()}
              onDismiss={render.dismiss}
            />
          )}
        </div>
      </div>
    </div>
  );
}
