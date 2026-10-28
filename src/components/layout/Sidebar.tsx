import { BookOpen, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { GROUP_LABELS, modulesByGroup, type ModuleGroup, type StudioModule } from '../../app/modules';
import { useLinkProps, type RouteId } from '../../app/router';
import { cx } from '../../lib/cx';
import { Logo } from '../brand/Logo';

const GROUPS: ModuleGroup[] = ['overview', 'create', 'manage'];

function NavItem({ module, active, collapsed }: { module: StudioModule; active: boolean; collapsed: boolean }) {
  const link = useLinkProps(module.path);
  const Icon = module.icon;
  return (
    <li>
      <a
        {...link}
        className={cx('nav-item', active && 'nav-item--active')}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? module.label : undefined}
      >
        <Icon size={18} strokeWidth={1.8} aria-hidden />
        <span className="nav-item__label">{module.label}</span>
        {module.status === 'planned' && (
          <span className="nav-item__phase" aria-label={`Previsto para a fase ${module.phase}`}>
            F{module.phase}
          </span>
        )}
      </a>
    </li>
  );
}

export function Sidebar({
  activeRoute,
  collapsed,
  onToggle,
}: {
  activeRoute: RouteId;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const homeLink = useLinkProps('/');
  const dsLink = useLinkProps('/design-system');
  return (
    <aside className={cx('sidebar', collapsed && 'sidebar--collapsed')} aria-label="Navegação principal">
      <div className="sidebar__brand">
        <a {...homeLink} aria-label="Eminente AI Studio — Dashboard">
          <Logo compact={collapsed} />
        </a>
      </div>

      <nav className="sidebar__nav">
        {GROUPS.map((group) => (
          <div key={group} className="sidebar__group">
            <p className="sidebar__group-label eyebrow">{GROUP_LABELS[group]}</p>
            <ul>
              {modulesByGroup(group).map((m) => (
                <NavItem key={m.id} module={m} active={activeRoute === m.id} collapsed={collapsed} />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <a
          {...dsLink}
          className={cx('nav-item', activeRoute === 'design-system' && 'nav-item--active')}
          aria-current={activeRoute === 'design-system' ? 'page' : undefined}
          title={collapsed ? 'Design system' : undefined}
        >
          <BookOpen size={18} strokeWidth={1.8} aria-hidden />
          <span className="nav-item__label">Design system</span>
        </a>
        <button
          type="button"
          className="nav-item nav-item--button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir menu' : undefined}
        >
          {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.8} aria-hidden /> : <PanelLeftClose size={18} strokeWidth={1.8} aria-hidden />}
          <span className="nav-item__label">Recolher menu</span>
        </button>
      </div>
    </aside>
  );
}
