import { useMemo, useState, type KeyboardEvent } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, PenLine, XCircle } from 'lucide-react';
import { getModule } from '../../app/modules';
import { Alert, Badge, Button, ButtonLink, Card, CardHeader, EmptyState, PageHeader, Spinner, TextArea } from '../../components/ui';
import type { DraftAction } from '../../domain/content/draft';
import { LIMITS } from '../../domain/content/limits';
import { FORMAT_LABELS, ROLE_LABELS, type ContentDraft } from '../../domain/content/types';
import type { Scene } from '../../domain/design/layout';
import { cx } from '../../lib/cx';
import { useContentDraft } from '../content/useContentDraft';
import { DesignControls } from './DesignControls';
import { ExportPanel } from './ExportPanel';
import { SlideCanvas } from './SlideCanvas';
import { useExport } from './useExport';
import { useScenes } from './useScenes';

type Kind = 'post' | 'carousel';

interface Problem {
  severity: 'error' | 'warning';
  pageIndex: number | null;
  message: string;
}

const STUDIO_FOR = { post: '/design', carousel: '/carousel', motion: '/motion' } as const;

function collectProblems(draft: ContentDraft, scenes: readonly Scene[], errors: { pageId?: string; message: string }[], warnings: { pageId?: string; message: string }[]): Problem[] {
  const indexOf = (id?: string) => (id ? draft.pages.findIndex((p) => p.id === id) : -1);
  const unit = draft.brief.format === 'carousel' ? 'Slide' : 'Post';
  const out: Problem[] = [];
  for (const e of errors) out.push({ severity: 'error', pageIndex: indexOf(e.pageId) >= 0 ? indexOf(e.pageId) : null, message: e.message });
  scenes.forEach((s, i) => {
    for (const issue of s.issues) {
      // Título vazio já é apontado pela validação do conteúdo.
      if (issue.message.includes('vazio')) continue;
      out.push({ severity: 'error', pageIndex: i, message: `${unit}${draft.pages.length > 1 ? ` ${i + 1}` : ''}: ${issue.message}` });
    }
  });
  for (const w of warnings) out.push({ severity: 'warning', pageIndex: indexOf(w.pageId) >= 0 ? indexOf(w.pageId) : null, message: w.message });
  return out;
}

function QuickEdit({
  draft,
  index,
  scene,
  dispatch,
}: {
  draft: ContentDraft;
  index: number;
  scene: Scene | undefined;
  dispatch: (a: DraftAction) => void;
}) {
  const page = draft.pages[index];
  if (!page) return null;
  const issue = (field: 'heading' | 'body' | 'cta') => scene?.issues.find((i) => i.field === field)?.message;
  return (
    <Card className="studio-panel">
      <CardHeader
        title={draft.pages.length > 1 ? `Texto do slide ${index + 1}` : 'Texto do post'}
        description="Ajustes rápidos. A edição completa fica no Content Studio."
      />
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
        {page.role === 'cta' && draft.brief.format === 'carousel' && (
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

export function VisualStudioPage({ kind }: { kind: Kind }) {
  const module = getModule(kind === 'post' ? 'design' : 'carousel');
  const { draft, dispatch, validation } = useContentDraft();
  const { fonts, scenes } = useScenes(draft);
  const [selected, setSelected] = useState(0);
  const exporter = useExport(draft, scenes);

  const index = Math.min(selected, Math.max(0, draft.pages.length - 1));
  const problems = useMemo(
    () => collectProblems(draft, scenes, validation.errors, validation.warnings),
    [draft, scenes, validation],
  );
  const errorCount = problems.filter((p) => p.severity === 'error').length;

  const header = (
    <PageHeader
      eyebrow="Criação"
      title={module.label}
      description={module.description}
      meta={
        <>
          <Badge tone="accent">{FORMAT_LABELS[draft.brief.format]}</Badge>
          {draft.brief.subject && <Badge>{draft.brief.subject}</Badge>}
        </>
      }
      actions={
        <ButtonLink to="/content" icon={PenLine}>
          Editar no Content Studio
        </ButtonLink>
      }
    />
  );

  if (draft.pages.length === 0) {
    return (
      <div className="page">
        {header}
        <Card padding="none">
          <EmptyState
            icon={PenLine}
            title="Nenhum conteúdo para diagramar"
            description={`Crie o texto no Content Studio com o formato "${kind === 'post' ? 'Post' : 'Carrossel'}" e volte aqui para gerar as imagens.`}
            actions={<ButtonLink to="/content" variant="primary" iconRight={ArrowRight}>Ir para o Content Studio</ButtonLink>}
          />
        </Card>
      </div>
    );
  }

  if (draft.brief.format !== kind) {
    const other = draft.brief.format;
    return (
      <div className="page">
        {header}
        <Card padding="none">
          <EmptyState
            icon={AlertTriangle}
            title={`O conteúdo atual é ${other === 'carousel' ? 'um carrossel' : other === 'motion' ? 'um motion' : 'um post'}`}
            description={`Abra o estúdio correspondente ou mude o formato para "${kind === 'post' ? 'Post' : 'Carrossel'}" no Content Studio.`}
            actions={
              <>
                <ButtonLink to={STUDIO_FOR[other]} variant="primary" iconRight={ArrowRight}>
                  Abrir no {other === 'carousel' ? 'Carousel Studio' : other === 'motion' ? 'Motion Studio' : 'Design Studio'}
                </ButtonLink>
                <ButtonLink to="/content" icon={ArrowLeft}>
                  Content Studio
                </ButtonLink>
              </>
            }
          />
        </Card>
      </div>
    );
  }

  const scene = scenes[index];
  const isCarousel = kind === 'carousel';
  const go = (delta: number) => setSelected(Math.min(draft.pages.length - 1, Math.max(0, index + delta)));
  const onStageKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  };
  const currentLabel = isCarousel ? `página ${index + 1}` : 'imagem';
  const blockedReason =
    fonts.status === 'error'
      ? fonts.message
      : errorCount > 0
        ? `Corrija ${errorCount === 1 ? 'o problema apontado' : `os ${errorCount} problemas apontados`} para exportar. Texto cortado ou faltando não é exportado.`
        : null;

  return (
    <div className="page">
      {header}
      <div className="visual">
        <div className="studio__side">
          <DesignControls draft={draft} dispatch={dispatch} />
          <QuickEdit draft={draft} index={index} scene={scene} dispatch={dispatch} />
        </div>

        <div className="studio__main">
          {fonts.status === 'error' && <Alert tone="danger" title="Falha ao carregar a fonte">{fonts.message}</Alert>}

          <div className="stage" tabIndex={0} onKeyDown={onStageKey} aria-label="Pré-visualização. Use as setas para trocar de página.">
            {fonts.status === 'loading' || !scene ? (
              <div className="stage__loading">
                <Spinner size={20} /> Carregando fontes…
              </div>
            ) : (
              <>
                {isCarousel && (
                  <Button className="stage__nav stage__nav--prev" variant="secondary" icon={ChevronLeft} aria-label="Página anterior" disabled={index === 0} onClick={() => go(-1)} />
                )}
                <SlideCanvas
                  scene={scene}
                  className="stage__canvas"
                  label={`${isCarousel ? `Slide ${index + 1} de ${draft.pages.length}` : 'Post'}: ${draft.pages[index]?.heading ?? ''}`}
                />
                {isCarousel && (
                  <Button className="stage__nav stage__nav--next" variant="secondary" icon={ChevronRight} aria-label="Próxima página" disabled={index === draft.pages.length - 1} onClick={() => go(1)} />
                )}
              </>
            )}
          </div>
          <p className="stage__caption">
            {scene && `${scene.width} × ${scene.height} px · a pré-visualização usa o mesmo desenho do PNG exportado`}
          </p>

          {isCarousel && scenes.length > 0 && (
            <ol className="thumbs" aria-label="Páginas">
              {scenes.map((s, i) => {
                const pageId = draft.pages[i]!.id;
                const hasError = s.issues.length > 0 || validation.errors.some((e) => e.pageId === pageId);
                return (
                  <li key={draft.pages[i]!.id}>
                    <button
                      type="button"
                      className={cx('thumb', i === index && 'thumb--active', hasError && 'thumb--error')}
                      aria-current={i === index ? 'true' : undefined}
                      aria-label={`Slide ${i + 1}: ${ROLE_LABELS[draft.pages[i]!.role]}${hasError ? ' (com problema)' : ''}`}
                      onClick={() => setSelected(i)}
                    >
                      <SlideCanvas scene={s} resolution={0.16} label="" />
                      <span className="thumb__num">{String(i + 1).padStart(2, '0')}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          {problems.length > 0 && (
            <div className={cx('issues', errorCount ? 'issues--error' : 'issues--warning')}>
              <p className="issues__summary">
                {errorCount ? <XCircle size={16} aria-hidden /> : <AlertTriangle size={16} aria-hidden />}
                {errorCount ? `${errorCount} ${errorCount === 1 ? 'problema impede' : 'problemas impedem'} a exportação` : `${problems.length} ${problems.length === 1 ? 'aviso' : 'avisos'}`}
              </p>
              <ul className="issues__list">
                {problems.map((p, i) => (
                  <li key={`${p.message}-${i}`}>
                    <button
                      type="button"
                      className={cx('issues__item', `issues__item--${p.severity}`)}
                      onClick={() => p.pageIndex !== null && setSelected(p.pageIndex)}
                    >
                      {p.message}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ExportPanel
            kind={kind}
            state={exporter.state}
            blockedReason={fonts.status === 'loading' ? 'Aguardando o carregamento das fontes.' : blockedReason}
            pageCount={draft.pages.length}
            currentLabel={currentLabel}
            onExport={(mode) => void exporter.run(mode, index)}
            onDismiss={exporter.reset}
          />
        </div>
      </div>
    </div>
  );
}
