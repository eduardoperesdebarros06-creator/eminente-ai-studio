import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * Diálogo de confirmação acessível com <dialog> nativo (foco preso, Esc cancela).
 * Uso: `if (!(await confirm({ title: '…' }))) return;`
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const confirm = useCallback<Confirm>(
    (options) => new Promise<boolean>((resolve) => setState({ ...options, resolve })),
    [],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (state && dialog && !dialog.open) dialog.showModal();
  }, [state]);

  const close = (result: boolean) => {
    dialogRef.current?.close();
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <dialog
          ref={dialogRef}
          className="dialog"
          aria-labelledby="confirm-title"
          onCancel={(e) => {
            e.preventDefault();
            close(false);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) close(false);
          }}
        >
          <div className="dialog__body">
            <h2 id="confirm-title" className="dialog__title">
              {state.title}
            </h2>
            {state.description && <div className="dialog__text">{state.description}</div>}
          </div>
          <div className="dialog__actions">
            <Button variant="ghost" onClick={() => close(false)}>
              {state.cancelLabel ?? 'Cancelar'}
            </Button>
            <Button variant={state.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
              {state.confirmLabel ?? 'Confirmar'}
            </Button>
          </div>
        </dialog>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>.');
  return ctx;
}
