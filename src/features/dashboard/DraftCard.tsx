import { useState } from 'react';
import { ArrowRight, FolderOpen, PenLine } from 'lucide-react';
import { totalDuration } from '../../domain/content/draft';
import { FORMAT_LABELS } from '../../domain/content/types';
import { Badge, ButtonLink, Card, EmptyState } from '../../components/ui';
import { peekDraft } from '../content/draftStorage';
import { unitNames } from '../content/PagesEditor';

/** Mostra o rascunho em andamento (se houver). Projetos salvos chegam na Fase 5. */
export function DraftCard() {
  const [draft] = useState(peekDraft);

  if (!draft || (draft.pages.length === 0 && !draft.brief.subject.trim())) {
    return (
      <Card padding="none">
        <EmptyState
          icon={FolderOpen}
          title="Nenhum projeto ainda"
          description="O rascunho em andamento do Content Studio aparece aqui. A biblioteca de projetos com SQLite chega na Fase 5."
          compact
        />
      </Card>
    );
  }

  const unit = unitNames(draft.brief.format);
  const n = draft.pages.length;
  const updated = new Date(draft.updatedAt);
  return (
    <Card className="draft-card">
      <div className="draft-card__top">
        <span className="module-card__icon" aria-hidden>
          <PenLine size={20} strokeWidth={1.7} />
        </span>
        <Badge tone="accent" dot>
          Rascunho em andamento
        </Badge>
      </div>
      <h3 className="draft-card__title">{draft.brief.subject || 'Sem assunto'}</h3>
      <p className="draft-card__meta">
        {FORMAT_LABELS[draft.brief.format]} · {n} {n === 1 ? unit.one : unit.many}
        {draft.brief.format === 'motion' && n > 0 && ` · ${totalDuration(draft.pages)} s`}
        {' · '}atualizado em {updated.toLocaleDateString('pt-BR')} às{' '}
        {updated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </p>
      <p className="draft-card__note">Salvo apenas neste navegador. A biblioteca de projetos chega na Fase 5.</p>
      <div className="draft-card__actions">
        <ButtonLink to="/content" variant="primary" iconRight={ArrowRight}>
          Continuar
        </ButtonLink>
      </div>
    </Card>
  );
}
