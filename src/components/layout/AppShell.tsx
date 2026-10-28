import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { RouteId } from '../../app/router';
import { isBoolean, readPreference, writePreference } from '../../lib/storage';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell({
  activeRoute,
  section,
  children,
}: {
  activeRoute: RouteId;
  section: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() => readPreference('sidebarCollapsed', false, isBoolean));
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => writePreference('sidebarCollapsed', collapsed), [collapsed]);

  // Ao trocar de módulo, volta ao topo e move o foco para o conteúdo (leitores de tela).
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [activeRoute]);

  return (
    <div className="shell" data-collapsed={collapsed || undefined}>
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>
        Pular para o conteúdo
      </a>
      <Sidebar activeRoute={activeRoute} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="shell__main">
        <Topbar section={section} />
        <main id="main" ref={mainRef} tabIndex={-1} className="shell__content">
          <div className="shell__inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
