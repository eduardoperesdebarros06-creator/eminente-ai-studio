import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, TextArea, TextInput, useConfirm } from '../../components/ui';
import { totalDuration, type DraftAction } from '../../domain/content/draft';
import { LIMITS, PAGE_LIMITS } from '../../domain/content/limits';
import { ROLE_LABELS, type ContentDraft, type ContentPage } from '../../domain/content/types';
import type { DraftIssue } from '../../domain/content/validate';

/** Mensagem sem o prefixo "Página N:", já que o campo está dentro da página. */
const local = (m: string) => m.replace(/^(Página|Cena) \d+: /, '');

export function unitNames(format: ContentDraft['brief']['format']) {
  return format === 'motion'
    ? { one: 'cena', many: 'cenas', title: 'Cena' }
    : format === 'carousel'
      ? { one: 'slide', many: 'slides', title: 'Slide' }
      : { one: 'página', many: 'páginas', title: 'Página' };
}

function PageCard({
  page,
  index,
  count,
  draft,
  issues,
  dispatch,
}: {
  page: ContentPage;
  index: number;
  count: number;
  draft: ContentDraft;
  issues: DraftIssue[];
  dispatch: (a: DraftAction) => void;
}) {
  const confirm = useConfirm();
  const format = draft.brief.format;
  const unit = unitNames(format);
  const limits = PAGE_LIMITS[format];
  const isMotion = format === 'motion';
  const fieldError = (field: DraftIssue['field']) => {
    const e = issues.find((i) => i.severity === 'error' && i.field === field);
    return e ? local(e.message) : undefined;
  };
  const warnings = issues.filter((i) => i.severity === 'warning');

  async function remove() {
    const hasText = page.heading.trim() || page.body.trim();
    if (
      hasText &&
      !(await confirm({
        title: `Remover ${unit.one} ${index + 1}?`,
        description: 'O texto desta página será descartado.',
        confirmLabel: 'Remover',
        tone: 'danger',
      }))
    ) {
      return;
    }
    dispatch({ type: 'page/remove', id: page.id });
  }

  const label = `${unit.title} ${index + 1}`;

  return (
    <article className="page-card" id={`page-${page.id}`} aria-label={label}>
      <header className="page-card__header">
        <div className="page-card__title">
          <span className="page-card__num">{String(index + 1).padStart(2, '0')}</span>
          <Badge tone={page.role === 'cover' ? 'accent' : 'neutral'}>{ROLE_LABELS[page.role]}</Badge>
        </div>
        {format !== 'post' && (
          <div className="page-card__actions">
            <Button
              size="sm"
              variant="ghost"
              icon={ArrowUp}
              aria-label={`Mover ${label} para cima`}
              disabled={index === 0}
              onClick={() => dispatch({ type: 'page/move', id: page.id, direction: -1 })}
            />
            <Button
              size="sm"
              variant="ghost"
              icon={ArrowDown}
              aria-label={`Mover ${label} para baixo`}
              disabled={index === count - 1}
              onClick={() => dispatch({ type: 'page/move', id: page.id, direction: 1 })}
            />
            <Button
              size="sm"
              variant="ghost"
              icon={Plus}
              aria-label={`Inserir ${unit.one} depois de ${label}`}
              disabled={count >= limits.max}
              onClick={() => dispatch({ type: 'page/add', afterId: page.id })}
            />
            <Button
              size="sm"
              variant="ghost"
              icon={Trash2}
              aria-label={`Remover ${label}`}
              disabled={count <= limits.min}
              onClick={remove}
            />
          </div>
        )}
      </header>

      <div className={isMotion ? 'page-card__fields page-card__fields--motion' : 'page-card__fields'}>
        <TextInput
          label="Título"
          value={page.heading}
          placeholder={index === 0 ? 'Frase de impacto da capa' : 'Título'}
          onChange={(e) => dispatch({ type: 'page/update', id: page.id, patch: { heading: e.target.value } })}
          error={fieldError('heading')}
          counter={{ current: page.heading.trim().length, max: LIMITS.heading.max }}
        />
        {isMotion && (
          <TextInput
            label="Duração (s)"
            type="number"
            inputMode="numeric"
            min={LIMITS.sceneDuration.min}
            max={LIMITS.sceneDuration.max}
            step={1}
            value={page.durationSec}
            onChange={(e) => {
              if (e.target.value === '') return;
              dispatch({ type: 'page/update', id: page.id, patch: { durationSec: Number(e.target.value) } });
            }}
            error={fieldError('durationSec')}
          />
        )}
      </div>
      <TextArea
        label={isMotion ? 'Texto de apoio (opcional)' : 'Texto'}
        value={page.body}
        rows={isMotion ? 2 : 3}
        onChange={(e) => dispatch({ type: 'page/update', id: page.id, patch: { body: e.target.value } })}
        error={fieldError('body')}
        counter={{ current: page.body.trim().length, max: LIMITS.body.max }}
      />
      {warnings.length > 0 && (
        <ul className="page-card__warnings">
          {warnings.map((w) => (
            <li key={w.message}>{local(w.message)}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function PagesEditor({
  draft,
  issues,
  dispatch,
}: {
  draft: ContentDraft;
  issues: DraftIssue[];
  dispatch: (a: DraftAction) => void;
}) {
  const format = draft.brief.format;
  const unit = unitNames(format);
  const { max } = PAGE_LIMITS[format];
  const count = draft.pages.length;

  return (
    <section className="pages-editor" aria-label={`${unit.title}s`}>
      {draft.pages.map((p, i) => (
        <PageCard
          key={p.id}
          page={p}
          index={i}
          count={count}
          draft={draft}
          issues={issues.filter((iss) => iss.pageId === p.id)}
          dispatch={dispatch}
        />
      ))}
      {format !== 'post' && (
        <div className="pages-editor__footer">
          <Button icon={Plus} onClick={() => dispatch({ type: 'page/add' })} disabled={count >= max}>
            Adicionar {unit.one}
          </Button>
          <span className="pages-editor__count">
            {count} / {max} {unit.many}
            {format === 'motion' && ` · ${totalDuration(draft.pages)} s de ${LIMITS.motionTotalMax} s`}
          </span>
        </div>
      )}
    </section>
  );
}
