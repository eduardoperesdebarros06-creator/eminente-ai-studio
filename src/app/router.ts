import { useCallback, useSyncExternalStore, type MouseEvent } from 'react';
import { MODULES, type ModuleId } from './modules';

/**
 * Roteamento por hash (#/rota): funciona no `vite dev`, no `vite preview`
 * e em arquivos estáticos locais, sem dependências extras.
 */
export type RouteId = ModuleId | 'design-system' | 'not-found';

export interface Route {
  id: RouteId;
  path: string;
}

export const EXTRA_ROUTES: Record<string, RouteId> = {
  '/design-system': 'design-system',
};

export function normalizePath(raw: string): string {
  let path = raw.replace(/^#/, '').split('?')[0] ?? '';
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path.toLowerCase();
}

export function resolveRoute(hash: string): Route {
  const path = normalizePath(hash);
  const mod = MODULES.find((m) => m.path === path);
  if (mod) return { id: mod.id, path };
  const extra = EXTRA_ROUTES[path];
  if (extra) return { id: extra, path };
  return { id: 'not-found', path };
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

const getHash = () => window.location.hash;

export function navigate(path: string): void {
  const target = `#${normalizePath(path)}`;
  if (window.location.hash !== target) window.location.hash = target;
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');
  return resolveRoute(hash);
}

/** Props para um <a> interno: mantém href real (abrir em nova aba, acessibilidade). */
export function useLinkProps(path: string) {
  const onClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      navigate(path);
    },
    [path],
  );
  return { href: `#${normalizePath(path)}`, onClick };
}
