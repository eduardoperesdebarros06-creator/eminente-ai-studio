import { useEffect, useState } from 'react';
import { ArrowRight, FolderOpen, History, PenLine } from 'lucide-react';
import { navigate } from '../../app/router';
import { totalDuration } from '../../domain/content/draft';
import { FORMAT_LABELS } from '../../domain/content/types';
import type { ProjectSummary } from '../../domain/library/library';
import { Badge, Button, ButtonLink, Card, EmptyState, useToast } from '../../components/ui';
import { useContentDraft } from '../content/useContentDraft';
import { unitNames } from '../content/PagesEditor';
import { libraryClient } from '../library/libraryClient';
import { openProject } from '../library/librarySync';
import { useLibrarySync } from '../library/useLibrarySync';

const time = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * Rascunho em andamento. Se ele estiver vazio mas a Biblioteca tiver
 * projetos (ex.: dados do navegador apagados), oferece reabrir o último.
 */
export function DraftCard() {
  const { draft } = useContentDraft();
  const sync = useLibrarySync();
  const toast = useToast();
  const empty = draft.pages.length === 0 && !draft.brief.subject.trim();
  const [last, setLast] = useState<ProjectSummary | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!empty) return;
    libraryClient
      .list()
      .then((list) => setLast(list.find((p) => p.id !== draft.id) ?? null))
      .catch(() => setLast(null));
  }, [empty, draft.id]);

  async function reopen(p: ProjectSummary) {
    setOpening(true);
    try {
      await openProject(p.id);
      navigate('/content');
    } catch (e) {
      toast({ tone: 'danger', title: 'Não foi possível abrir o projeto.', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setOpening(false);
    }
  }

  if (empty) {
    return (
      <Card padding="none">
        <EmptyState
          icon={last ? History : FolderOpen}
          title={last ? 'Continuar de onde parou?' : 'Nenhum projeto ainda'}
          description={
            last
              ? `Seu último projeto na Biblioteca: “${last.title}” (${FORMAT_LABELS[last.format]}), atualizado em ${new Date(last.updatedAt).toLocaleDateString('pt-BR')} às ${time(new Date(last.updatedAt))}.`
              : 'Comece no Content Studio. Tudo o que você criar é salvo automaticamente na Biblioteca, com histórico de versões.'
          }
          actions={
            last ? (
              <>
                <Button variant="primary" iconRight={ArrowRight} loading={opening} onClick={() => void reopen(last)}>
                  Reabrir
                </Button>
                <ButtonLink to="/library">Ver a Biblioteca</ButtonLink>
              </>
            ) : undefined
          }
          compact
        />
      </Card>
    );
  }

  const unit = unitNames(draft.brief.format);
  const n = draft.pages.length;
  const updated = new Date(draft.updatedAt);
  const saved = sync.status === 'saved';
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
        {' · '}atualizado em {updated.toLocaleDateString('pt-BR')} às {time(updated)}
      </p>
      <p className="draft-card__note">
        {saved
          ? `Salvo na Biblioteca${sync.version ? ` (versão ${sync.version.number})` : ''} e neste navegador.`
          : sync.status === 'offline' || sync.status === 'error'
            ? 'Salvo neste navegador. A Biblioteca está indisponível agora: o projeto é enviado assim que ela voltar.'
            : 'Salvo neste navegador; enviando para a Biblioteca…'}
      </p>
      <div className="draft-card__actions">
        <ButtonLink to="/content" variant="primary" iconRight={ArrowRight}>
          Continuar
        </ButtonLink>
        <ButtonLink to="/library">Biblioteca</ButtonLink>
      </div>
    </Card>
  );
}
