import { CloudOff, Database, Loader2 } from 'lucide-react';
import { cx } from '../../lib/cx';
import { useLibrarySync } from './useLibrarySync';

const time = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Indicador compacto da gravação na biblioteca (barra superior). */
export function SyncBadge() {
  const s = useLibrarySync();
  let label: string;
  let title: string;
  let tone: 'ok' | 'busy' | 'warn' = 'ok';
  switch (s.status) {
    case 'starting':
      label = 'Biblioteca';
      title = 'Conectando à biblioteca local…';
      tone = 'busy';
      break;
    case 'saving':
      label = 'Salvando…';
      title = 'Gravando o projeto na biblioteca local (SQLite).';
      tone = 'busy';
      break;
    case 'saved':
      label = s.at ? `Salvo ${time(s.at)}` : 'Salvo';
      title = `Projeto salvo na biblioteca local${s.version ? ` · versão ${s.version.number}` : ''}. Tudo fica nesta máquina.`;
      break;
    case 'empty':
      label = 'Local';
      title = 'Rascunho vazio: vira projeto na biblioteca quando tiver conteúdo. Tudo fica nesta máquina.';
      break;
    case 'offline':
    case 'error':
      label = 'Sem biblioteca';
      title = `${s.message ?? 'Biblioteca indisponível.'} O rascunho continua guardado neste navegador e será enviado assim que possível.`;
      tone = 'warn';
      break;
  }
  const Icon = tone === 'busy' ? Loader2 : tone === 'warn' ? CloudOff : Database;
  return (
    <span className={cx('topbar__local', tone === 'warn' && 'topbar__local--warn')} title={title} role="status">
      <Icon size={14} aria-hidden className={tone === 'busy' ? 'spin' : undefined} />
      {label}
    </span>
  );
}
