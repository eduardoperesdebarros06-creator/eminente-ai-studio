import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArchiveRestore,
  Copy,
  Database,
  Download,
  FileStack,
  FolderOpen,
  History,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { getModule } from '../../app/modules';
import { navigate } from '../../app/router';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, Segmented, Spinner, TextInput, useConfirm, useToast } from '../../components/ui';
import { createId } from '../../domain/content/id';
import { FORMAT_LABELS, type ContentFormat } from '../../domain/content/types';
import {
  duplicateDraft,
  VERSION_KIND_LABELS,
  type ExportRecord,
  type LibraryHealth,
  type ProjectDetail,
  type ProjectSummary,
} from '../../domain/library/library';
import { SAFE_VIDEO_NAME } from '../../domain/motion/video';
import { cx } from '../../lib/cx';
import { getDraftSnapshot } from '../content/draftStore';
import { useContentDraft } from '../content/useContentDraft';
import { libraryClient } from './libraryClient';
import { openProject, pushNow, restoreVersion } from './librarySync';
import { useLibrarySync } from './useLibrarySync';

type Filter = 'all' | ContentFormat;
type Tab = 'projects' | 'trash';

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const size = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KB` : `${(n / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const STUDIO_FOR: Record<ContentFormat, string> = { post: '/design', carousel: '/carousel', motion: '/motion' };

function ExportRow({ e }: { e: ExportRecord }) {
  const canDownload = e.kind === 'mp4' && SAFE_VIDEO_NAME.test(e.name);
  return (
    <li className="lib-exports__item">
      <span className="lib-exports__kind">{e.kind.toUpperCase()}</span>
      <span className="lib-exports__main">
        <span className="mono lib-exports__name">{e.name}</span>
        <span className="lib-exports__meta">
          {dateTime(e.createdAt)} · {size(e.bytes)}
          {e.width && e.height ? ` · ${e.width} × ${e.height}` : ''}
          {e.version ? ` · versão ${e.version}` : ''}
          {e.path ? ' · gravado em disco' : ' · baixado pelo navegador'}
        </span>
        {e.path && <span className="mono lib-exports__path">{e.path}</span>}
      </span>
      {canDownload && (
        <a className="btn btn--ghost btn--sm" href={`/api/motion/files/${encodeURIComponent(e.name)}`} download={e.name}>
          <Download size={14} aria-hidden />
          <span>Baixar</span>
        </a>
      )}
    </li>
  );
}

function Detail({
  detail,
  isCurrent,
  busy,
  onClose,
  onRestore,
}: {
  detail: ProjectDetail;
  isCurrent: boolean;
  busy: boolean;
  onClose: () => void;
  onRestore: (version: number) => void;
}) {
  const latest = detail.versionList[0]?.number;
  return (
    <Card className="lib-detail" padding="none">
      <div className="lib-detail__head">
        <div>
          <p className="eyebrow">Projeto</p>
          <h2 className="lib-detail__title">{detail.title}</h2>
          <p className="lib-detail__meta">
            {FORMAT_LABELS[detail.format]} · criado em {dateTime(detail.createdAt)}
          </p>
        </div>
        <Button size="sm" variant="ghost" icon={X} onClick={onClose} aria-label="Fechar detalhes" />
      </div>

      <section className="lib-detail__section">
        <h3 className="lib-detail__heading">
          <History size={15} aria-hidden /> Versões ({detail.versionList.length})
        </h3>
        <p className="lib-detail__hint">
          Gravações automáticas próximas viram uma versão só. Restaurar cria uma versão nova com o conteúdo antigo: nada é apagado.
        </p>
        <ol className="lib-versions">
          {detail.versionList.map((v) => (
            <li key={v.number} className={cx('lib-versions__item', v.number === latest && 'lib-versions__item--latest')}>
              <span className="lib-versions__num">v{v.number}</span>
              <span className="lib-versions__main">
                <span className="lib-versions__label">{v.label}</span>
                <span className="lib-versions__meta">
                  {VERSION_KIND_LABELS[v.kind]} · {dateTime(v.savedAt)}
                </span>
              </span>
              {v.number === latest ? (
                <Badge tone="success">Atual</Badge>
              ) : (
                <Button size="sm" icon={RotateCcw} disabled={busy} onClick={() => onRestore(v.number)}>
                  Restaurar
                </Button>
              )}
            </li>
          ))}
        </ol>
        {!isCurrent && <p className="lib-detail__hint">Restaurar também abre o projeto no estúdio.</p>}
      </section>

      <section className="lib-detail__section">
        <h3 className="lib-detail__heading">
          <FileStack size={15} aria-hidden /> Arquivos exportados ({detail.exportList.length})
        </h3>
        {detail.exportList.length === 0 ? (
          <p className="lib-detail__hint">Nenhum arquivo exportado ainda. PNG, .zip, .md, .json e MP4 aparecem aqui ao exportar.</p>
        ) : (
          <ul className="lib-exports">
            {detail.exportList.map((e) => (
              <ExportRow key={e.id} e={e} />
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
}

function ProjectCard({
  p,
  selected,
  isCurrent,
  busy,
  tab,
  onOpen,
  onDetails,
  onDuplicate,
  onTrash,
  onUntrash,
  onPurge,
}: {
  p: ProjectSummary;
  selected: boolean;
  isCurrent: boolean;
  busy: boolean;
  tab: Tab;
  onOpen: () => void;
  onDetails: () => void;
  onDuplicate: () => void;
  onTrash: () => void;
  onUntrash: () => void;
  onPurge: () => void;
}) {
  return (
    <li className={cx('lib-card', selected && 'lib-card--selected')}>
      <button type="button" className="lib-card__body" onClick={onDetails} aria-pressed={selected}>
        <span className="lib-card__top">
          <Badge tone="accent">{FORMAT_LABELS[p.format]}</Badge>
          {isCurrent && <Badge tone="success" dot>Aberto agora</Badge>}
        </span>
        <span className="lib-card__title">{p.title}</span>
        <span className="lib-card__meta">
          {tab === 'trash' && p.deletedAt ? `Na lixeira desde ${dateTime(p.deletedAt)}` : `Atualizado em ${dateTime(p.updatedAt)}`}
        </span>
        <span className="lib-card__meta">
          {plural(p.versions, 'versão', 'versões')} · {plural(p.exports, 'arquivo exportado', 'arquivos exportados')}
        </span>
      </button>
      <div className="lib-card__actions">
        {tab === 'projects' ? (
          <>
            <Button size="sm" variant="primary" icon={FolderOpen} disabled={busy || isCurrent} onClick={onOpen}>
              {isCurrent ? 'Aberto' : 'Abrir'}
            </Button>
            <Button size="sm" variant="ghost" icon={Copy} disabled={busy} onClick={onDuplicate} title="Duplicar">
              Duplicar
            </Button>
            <Button size="sm" variant="ghost" icon={Trash2} disabled={busy} onClick={onTrash} title="Mover para a lixeira" aria-label="Mover para a lixeira" />
          </>
        ) : (
          <>
            <Button size="sm" icon={ArchiveRestore} disabled={busy} onClick={onUntrash}>
              Restaurar
            </Button>
            <Button size="sm" variant="danger" icon={Trash2} disabled={busy} onClick={onPurge}>
              Apagar de vez
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function LibraryPage() {
  const module = getModule('library');
  const { draft } = useContentDraft();
  const sync = useLibrarySync();
  const confirm = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('projects');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [health, setHealth] = useState<LibraryHealth | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      // O rascunho aberto entra na lista já atualizado.
      await pushNow();
      const [list, h] = await Promise.all([libraryClient.list(tab === 'trash'), libraryClient.health()]);
      setProjects(list);
      setHealth(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProjects(null);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = useCallback(async (id: string) => {
    try {
      setDetail(await libraryClient.detail(id));
    } catch (e) {
      setDetail(null);
      toast({ tone: 'danger', title: 'Não foi possível abrir os detalhes.', description: e instanceof Error ? e.message : String(e) });
    }
  }, [toast]);

  useEffect(() => {
    if (selected) void loadDetail(selected);
    else setDetail(null);
  }, [selected, loadDetail, sync.version?.number]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects ?? []).filter((p) => (filter === 'all' || p.format === filter) && (!q || p.title.toLowerCase().includes(q)));
  }, [projects, filter, query]);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast({ tone: 'danger', title: 'A operação falhou.', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  const open = (p: ProjectSummary) =>
    act(async () => {
      await openProject(p.id);
      toast({ tone: 'success', title: 'Projeto aberto.', description: p.title });
      navigate(STUDIO_FOR[p.format]);
    });

  const duplicate = (p: ProjectSummary) =>
    act(async () => {
      const { draft: original } = await libraryClient.draft(p.id);
      const copy = duplicateDraft(original, createId(), new Date());
      await libraryClient.save(copy, 'manual', `Cópia de "${p.title}"`);
      toast({ tone: 'success', title: 'Projeto duplicado.', description: copy.brief.subject || p.title });
      await load();
    });

  const trash = (p: ProjectSummary) =>
    act(async () => {
      if (p.id === getDraftSnapshot().draft.id) {
        toast({ tone: 'info', title: 'Este projeto está aberto.', description: 'Use "Novo conteúdo" antes de movê-lo para a lixeira.' });
        return;
      }
      await libraryClient.trash(p.id);
      if (selected === p.id) setSelected(null);
      toast({ tone: 'info', title: 'Movido para a lixeira.', description: `${p.title} — dá para restaurar na aba Lixeira.` });
      await load();
    });

  const untrash = (p: ProjectSummary) =>
    act(async () => {
      await libraryClient.untrash(p.id);
      toast({ tone: 'success', title: 'Projeto restaurado.', description: p.title });
      await load();
    });

  const purge = (p: ProjectSummary) =>
    act(async () => {
      const ok = await confirm({
        title: 'Apagar de vez?',
        description: `"${p.title}" e as ${plural(p.versions, 'versão', 'versões')} serão apagados do banco. Os arquivos já exportados no disco não são apagados. Não dá para desfazer (a não ser por uma cópia de segurança).`,
        confirmLabel: 'Apagar de vez',
        tone: 'danger',
      });
      if (!ok) return;
      await libraryClient.purge(p.id);
      if (selected === p.id) setSelected(null);
      await load();
    });

  const restore = (version: number) =>
    act(async () => {
      if (!detail) return;
      const ok = await confirm({
        title: `Restaurar a versão ${version}?`,
        description:
          detail.id === getDraftSnapshot().draft.id
            ? 'O conteúdo aberto agora é guardado como versão e substituído pelo da versão escolhida.'
            : 'O projeto será aberto no estúdio com o conteúdo da versão escolhida. O rascunho aberto agora fica guardado na Biblioteca.',
        confirmLabel: 'Restaurar',
      });
      if (!ok) return;
      const v = await restoreVersion(detail.id, version, true);
      toast({ tone: 'success', title: `Versão ${version} restaurada como versão ${v.number}.` });
      await load();
      await loadDetail(detail.id);
    });

  const backup = () =>
    act(async () => {
      const r = await libraryClient.backup();
      setHealth(r.health);
      toast({ tone: 'success', title: 'Cópia de segurança criada.', description: r.file });
    });

  const offline = error !== null;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Gestão"
        title={module.label}
        description={module.description}
        meta={
          <>
            {projects && <Badge>{plural(projects.length, tab === 'trash' ? 'projeto na lixeira' : 'projeto', tab === 'trash' ? 'projetos na lixeira' : 'projetos')}</Badge>}
            {health && <Badge tone="neutral">SQLite {health.sqlite}</Badge>}
          </>
        }
        actions={
          <Button icon={RefreshCw} onClick={() => void load()} disabled={busy}>
            Atualizar
          </Button>
        }
      />

      {health?.recovered && (
        <div className="studio__notice">
          <Alert tone="danger" title="A biblioteca foi recuperada ao iniciar.">
            {health.recovered}
          </Alert>
        </div>
      )}

      {offline ? (
        <Card padding="none">
          <EmptyState
            icon={Database}
            title="Biblioteca indisponível"
            description={`${error} O rascunho em andamento continua guardado neste navegador.`}
            actions={
              <Button icon={RefreshCw} onClick={() => void load()}>
                Tentar de novo
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="lib-toolbar">
            <Segmented
              label="Ver"
              value={tab}
              onChange={(t) => {
                setTab(t);
                setSelected(null);
              }}
              options={[
                { value: 'projects', label: 'Projetos' },
                { value: 'trash', label: 'Lixeira', icon: Trash2 },
              ]}
            />
            <Segmented
              label="Formato"
              value={filter}
              onChange={setFilter}
              size="sm"
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'post', label: 'Post' },
                { value: 'carousel', label: 'Carrossel' },
                { value: 'motion', label: 'Motion' },
              ]}
            />
            <div className="lib-toolbar__search">
              <Search size={15} aria-hidden className="lib-toolbar__search-icon" />
              <TextInput label="Buscar" placeholder="Buscar pelo título" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>

          <div className={cx('lib', detail && 'lib--with-detail')}>
            <div className="lib__list">
              {projects === null ? (
                <div className="stage__loading">
                  <Spinner size={18} /> Carregando a biblioteca…
                </div>
              ) : visible.length === 0 ? (
                <Card padding="none">
                  <EmptyState
                    icon={tab === 'trash' ? Trash2 : FolderOpen}
                    title={
                      projects.length === 0
                        ? tab === 'trash'
                          ? 'A lixeira está vazia'
                          : 'Nenhum projeto ainda'
                        : 'Nada encontrado com esse filtro'
                    }
                    description={
                      projects.length === 0 && tab === 'projects'
                        ? 'Todo conteúdo criado no Content Studio é salvo aqui automaticamente, com histórico de versões.'
                        : undefined
                    }
                  />
                </Card>
              ) : (
                <ul className="lib-grid">
                  {visible.map((p) => (
                    <ProjectCard
                      key={p.id}
                      p={p}
                      tab={tab}
                      busy={busy}
                      selected={selected === p.id}
                      isCurrent={p.id === draft.id}
                      onOpen={() => void open(p)}
                      onDetails={() => setSelected(selected === p.id ? null : p.id)}
                      onDuplicate={() => void duplicate(p)}
                      onTrash={() => void trash(p)}
                      onUntrash={() => void untrash(p)}
                      onPurge={() => void purge(p)}
                    />
                  ))}
                </ul>
              )}
            </div>
            {detail && (
              <Detail
                detail={detail}
                isCurrent={detail.id === draft.id}
                busy={busy}
                onClose={() => setSelected(null)}
                onRestore={(v) => void restore(v)}
              />
            )}
          </div>

          {health && (
            <Card className="lib-health">
              <CardHeader
                title="Onde ficam os dados"
                description="Tudo fica nesta máquina, num arquivo SQLite. Uma cópia de segurança é feita a cada início do estúdio (as 5 últimas ficam guardadas)."
                actions={
                  <Button size="sm" icon={Database} onClick={() => void backup()} disabled={busy}>
                    Fazer cópia agora
                  </Button>
                }
              />
              <dl className="lib-health__list">
                <div>
                  <dt>Banco</dt>
                  <dd className="mono">{health.file}</dd>
                </div>
                <div>
                  <dt>Cópias de segurança</dt>
                  <dd>
                    {health.backups.length === 0
                      ? 'Nenhuma ainda'
                      : `${health.backups.length} · a mais recente em ${dateTime(health.backups[0]!.createdAt)} (${size(health.backups[0]!.bytes)})`}
                  </dd>
                </div>
              </dl>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
