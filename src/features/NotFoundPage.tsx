import { ArrowLeft, Compass } from 'lucide-react';
import { ButtonLink, EmptyState } from '../components/ui';

export function NotFoundPage({ path }: { path: string }) {
  return (
    <div className="page page--center">
      <EmptyState
        icon={Compass}
        title="Página não encontrada"
        description={
          <>
            Não existe nenhum módulo em <span className="mono">{path}</span>.
          </>
        }
        actions={
          <ButtonLink to="/" variant="primary" icon={ArrowLeft}>
            Ir para o dashboard
          </ButtonLink>
        }
      />
    </div>
  );
}
