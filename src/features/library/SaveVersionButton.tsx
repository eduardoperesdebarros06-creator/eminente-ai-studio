import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BookmarkPlus } from 'lucide-react';
import { Button, TextInput, useToast } from '../../components/ui';
import { VERSION_LABEL_MAX } from '../../domain/library/library';
import { saveNamedVersion } from './librarySync';
import { useLibrarySync } from './useLibrarySync';

/** Botão "Salvar versão" com diálogo para dar nome à versão. */
export function SaveVersionButton({ disabled }: { disabled?: boolean }) {
  const sync = useLibrarySync();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const offline = sync.status === 'offline' || sync.status === 'error';

  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) d.showModal();
  }, [open]);

  const close = () => {
    ref.current?.close();
    setOpen(false);
    setLabel('');
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const v = await saveNamedVersion(label);
      toast({ tone: 'success', title: `Versão ${v.number} salva na Biblioteca.`, description: v.label });
      close();
    } catch (err) {
      toast({ tone: 'danger', title: 'Não foi possível salvar a versão.', description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        icon={BookmarkPlus}
        disabled={disabled || offline}
        title={offline ? 'Biblioteca indisponível. Inicie o estúdio com "npm run dev".' : 'Guarda o conteúdo atual como uma versão com nome'}
        onClick={() => setOpen(true)}
      >
        Salvar versão
      </Button>
      {open && (
        <dialog
          ref={ref}
          className="dialog"
          aria-labelledby="save-version-title"
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <form onSubmit={submit}>
            <div className="dialog__body">
              <h2 id="save-version-title" className="dialog__title">
                Salvar versão
              </h2>
              <div className="dialog__text">
                As versões salvas por você nunca são apagadas automaticamente. Você pode voltar a elas pela Biblioteca.
              </div>
              <TextInput
                label="Nome da versão (opcional)"
                value={label}
                maxLength={VERSION_LABEL_MAX}
                placeholder="Ex.: Aprovada pelo cliente"
                onChange={(e) => setLabel(e.target.value)}
                autoFocus
              />
            </div>
            <div className="dialog__actions">
              <Button type="button" variant="ghost" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" loading={busy}>
                Salvar versão
              </Button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
