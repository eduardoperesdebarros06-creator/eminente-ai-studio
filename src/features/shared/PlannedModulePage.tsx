import type { ReactNode } from 'react';
import { ArrowLeft, Construction } from 'lucide-react';
import { getModule, type ModuleId } from '../../app/modules';
import { Badge, ButtonLink, Card, CardHeader, EmptyState, PageHeader } from '../../components/ui';

/**
 * Página de um módulo ainda não implementado. Mostra claramente que a
 * funcionalidade não existe ainda, em vez de simular um fluxo.
 */
export function PlannedModulePage({ id, preview }: { id: ModuleId; preview: ReactNode }) {
  const m = getModule(id);
  const Icon = m.icon;
  return (
    <div className="page">
      <PageHeader
        eyebrow={m.group === 'create' ? 'Criação' : 'Gestão'}
        title={m.label}
        description={m.description}
        meta={
          <>
            <Badge tone="neutral">Previsto para a Fase {m.phase}</Badge>
            <Badge tone="warning" dot>
              Não implementado
            </Badge>
          </>
        }
      />

      <div className="planned">
        <Card padding="none" className="planned__main">
          <EmptyState
            icon={Construction}
            title={`${m.label} ainda não está disponível`}
            description={`Este módulo será construído na Fase ${m.phase}. Nenhuma ação aqui é simulada: quando estiver pronto, os arquivos serão gerados de verdade.`}
            actions={
              <ButtonLink to="/" icon={ArrowLeft}>
                Voltar ao dashboard
              </ButtonLink>
            }
          />
          <div className="planned__preview" aria-label="Prévia ilustrativa do layout">
            <p className="eyebrow planned__preview-label">Prévia de layout</p>
            {preview}
          </div>
        </Card>

        <Card className="planned__aside">
          <CardHeader
            title={
              <span className="planned__aside-title">
                <Icon size={16} aria-hidden /> O que este módulo fará
              </span>
            }
          />
          <ul className="checklist">
            {m.capabilities.map((c) => (
              <li key={c} className="checklist__item">
                <span className="checklist__box" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
