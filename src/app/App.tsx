import { useEffect, type ReactNode } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { ErrorBoundary } from '../components/layout/ErrorBoundary';
import { ConfirmProvider, ToastProvider } from '../components/ui';
import { CarouselStudioPage } from '../features/carousel/CarouselStudioPage';
import { ContentStudioPage } from '../features/content/ContentStudioPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { DesignStudioPage } from '../features/design/DesignStudioPage';
import { DesignSystemPage } from '../features/design-system/DesignSystemPage';
import { LibraryPage } from '../features/library/LibraryPage';
import { MotionStudioPage } from '../features/motion/MotionStudioPage';
import { NotFoundPage } from '../features/NotFoundPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { MODULES } from './modules';
import { useRoute, type Route, type RouteId } from './router';

const PAGES: Record<Exclude<RouteId, 'not-found'>, () => ReactNode> = {
  dashboard: DashboardPage,
  content: ContentStudioPage,
  design: DesignStudioPage,
  carousel: CarouselStudioPage,
  motion: MotionStudioPage,
  library: LibraryPage,
  settings: SettingsPage,
  'design-system': DesignSystemPage,
};

export function sectionLabel(route: Route): string {
  if (route.id === 'design-system') return 'Design system';
  if (route.id === 'not-found') return 'Não encontrado';
  return MODULES.find((m) => m.id === route.id)?.label ?? '';
}

export function App() {
  const route = useRoute();
  const label = sectionLabel(route);
  const Page = route.id === 'not-found' ? null : PAGES[route.id];

  useEffect(() => {
    document.title = route.id === 'dashboard' ? 'Eminente AI Studio' : `${label} · Eminente AI Studio`;
  }, [route.id, label]);

  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppShell activeRoute={route.id} section={label}>
          <ErrorBoundary resetKey={route.path}>
            {Page ? <Page /> : <NotFoundPage path={route.path} />}
          </ErrorBoundary>
        </AppShell>
      </ConfirmProvider>
    </ToastProvider>
  );
}
