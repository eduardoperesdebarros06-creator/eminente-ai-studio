import { ChevronRight, HardDrive, Plus } from 'lucide-react';
import { ButtonLink } from '../ui';

export function Topbar({ section }: { section: string }) {
  return (
    <header className="topbar">
      <nav className="topbar__crumbs" aria-label="Você está em">
        <span className="topbar__crumb-root">Studio</span>
        <ChevronRight size={14} aria-hidden className="topbar__crumb-sep" />
        <span className="topbar__crumb-current">{section}</span>
      </nav>
      <div className="topbar__actions">
        <span className="topbar__local" title="Tudo roda nesta máquina. Nenhum serviço externo é usado.">
          <HardDrive size={14} aria-hidden />
          Local
        </span>
        <ButtonLink to="/content" variant="primary" size="sm" icon={Plus}>
          Novo conteúdo
        </ButtonLink>
      </div>
    </header>
  );
}
