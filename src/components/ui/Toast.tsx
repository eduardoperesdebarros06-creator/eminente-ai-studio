import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react';
import { cx } from '../../lib/cx';

type ToastTone = 'success' | 'info' | 'danger';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

type ShowToast = (toast: Omit<ToastItem, 'id'>) => void;

const ToastContext = createContext<ShowToast | null>(null);

const ICONS: Record<ToastTone, LucideIcon> = { success: CheckCircle2, info: Info, danger: XCircle };
const DURATION_MS = { success: 3500, info: 4500, danger: 8000 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback<ShowToast>(
    (toast) => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-3), { ...toast, id }]);
      window.setTimeout(() => dismiss(id), DURATION_MS[toast.tone]);
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite" aria-relevant="additions">
        {items.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div key={t.id} className={cx('toast', `toast--${t.tone}`)} role={t.tone === 'danger' ? 'alert' : 'status'}>
              <Icon size={18} className="toast__icon" aria-hidden />
              <div className="toast__body">
                <p className="toast__title">{t.title}</p>
                {t.description && <p className="toast__text">{t.description}</p>}
              </div>
              <button type="button" className="toast__close" onClick={() => dismiss(t.id)} aria-label="Fechar aviso">
                <X size={14} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  return ctx;
}
