import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ArrowRight, Eye, FilePlus2, FolderOpen, PencilLine, PenLine } from 'lucide-react';
import { clearHashQuery, readHashQuery } from '../../app/router';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  Segmented,
  useConfirm,
  useToast,
} from '../../components/ui';
import { validateBrief } from '../../domain/content/brief';
import { pagesLostOnFormatChange, sourceLabel, type ImportedContent } from '../../domain/content/draft';
import { LIMITS } from '../../domain/content/limits';
import { deserializeDraft } from '../../domain/content/serialize';
import { getTemplate } from '../../domain/content/templates';
import { FORMAT_LABELS, type Brief, type ContentFormat } from '../../domain/content/types';
import { readTextFile } from '../../lib/files';
import { BriefPanel } from './BriefPanel';
import { ContentPreview } from './ContentPreview';
import { ExportActions } from './ExportActions';
import { IssuesSummary } from './IssuesSummary';
import { MetaEditor } from './MetaEditor';
import { PagesEditor, unitNames } from './PagesEditor';
import { SourcePanel } from './SourcePanel';
import { acknowledgeRecovery, consumeRecoveryNotice } from './draftStore';
import { useContentDraft, type SaveState } from './useContentDraft';

type View = 'edit' | 'preview';

const time = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function SaveBadge({ state }: { state: SaveState }) {
  switch (state.status) {
    case 'idle':
      return null;
    case 'pending':
      return <Badge>Salvando rascunho…</Badge>;
    case 'saved':
      return (
        <Badge tone="success" dot>
          Rascunho salvo neste navegador às {time(state.at)}
        </Badge>
      );
    case 'error':
      return (
        <Badge tone="danger" dot>
          Não foi possível salvar o rascunho
        </Badge>
      );
  }
}

export function ContentStudioPage() {
  const { draft, dispatch, validation, saveState, recovery } = useContentDraft();
  const confirm = useConfirm();
  const toast = useToast();
  const [view, setView] = useState<View>('edit');
  const [showBriefErrors, setShowBriefErrors] = useState(false);
  const recoveryNotice = recovery === 'corrupt' || recovery === 'unavailable';
  const fileInput = useRef<HTMLInputElement>(null);

  const briefCheck = useMemo(() => validateBrief(draft.brief), [draft.brief]);
  const hasContent = draft.pages.length > 0;
  const format = draft.brief.format;
  const unit = unitNames(format);

  // Assunto vindo do dashboard (#/content?assunto=…).
  const handledQuery = useRef(false);
  useEffect(() => {
    if (handledQuery.current) return;
    handledQuery.current = true;
    const subject = readHashQuery('assunto')?.slice(0, LIMITS.subject.max);
    clearHashQuery();
    if (!subject) return;
    if (hasContent || draft.brief.subject.trim()) {
      toast({
        tone: 'info',
        title: 'Há um rascunho em andamento.',
        description: `O assunto "${subject}" não substituiu o atual. Use "Novo conteúdo" para recomeçar.`,
      });
      return;
    }
    dispatch({ type: 'brief/set', brief: { ...draft.brief, subject } });
  }, [dispatch, draft.brief, hasContent, toast]);

  useEffect(() => {
    // Avisa uma única vez por sessão do app, não a cada visita ao módulo.
    if (consumeRecoveryNotice() === 'restored' && hasContent) {
      toast({ tone: 'info', title: 'Rascunho anterior recuperado.' });
    }
    // Apenas na montagem: o aviso se refere ao estado encontrado ao abrir o módulo.
  }, []);

  /** Confirma antes de substituir conteúdo existente. */
  async function confirmReplace(action: string): Promise<boolean> {
    if (!hasContent) return true;
    return confirm({
      title: 'Substituir o conteúdo atual?',
      description: `${action} substitui ${draft.pages.length === 1 ? 'a página atual' : `as ${draft.pages.length} ${unit.many} atuais`}. Se quiser guardar a versão atual, baixe o .json antes.`,
      confirmLabel: 'Substituir',
      tone: 'danger',
    });
  }

  function onBriefChange(brief: Brief) {
    dispatch({ type: 'brief/set', brief });
  }

  async function onFormatChange(next: ContentFormat) {
    if (next === format) return;
    const lost = pagesLostOnFormatChange(draft.pages, next);
    if (
      lost > 0 &&
      !(await confirm({
        title: `Mudar para ${FORMAT_LABELS[next]}?`,
        description: `${FORMAT_LABELS[next]} comporta menos páginas: ${lost} ${lost === 1 ? 'página será descartada' : 'páginas serão descartadas'}. O restante do texto é mantido.`,
        confirmLabel: 'Mudar formato',
        tone: 'danger',
      }))
    ) {
      return;
    }
    dispatch({ type: 'format/set', format: next });
  }

  async function applyTemplate(templateId: string) {
    const name = getTemplate(templateId)?.name ?? 'O template';
    if (!(await confirmReplace(`Aplicar o template "${name}"`))) return false;
    dispatch({ type: 'template/apply', templateId });
    setView('edit');
    return true;
  }

  async function startManual() {
    if (!(await confirmReplace('Começar em branco'))) return false;
    dispatch({ type: 'manual/start' });
    setView('edit');
    return true;
  }

  async function importContent(content: ImportedContent) {
    if (!(await confirmReplace('Importar a resposta'))) return false;
    dispatch({ type: 'import/apply', content });
    setView('edit');
    return true;
  }

  async function newContent() {
    if (
      (hasContent || draft.brief.subject.trim()) &&
      !(await confirm({
        title: 'Começar um novo conteúdo?',
        description: 'O rascunho atual será descartado. Se quiser guardá-lo, baixe o .json antes.',
        confirmLabel: 'Descartar e começar',
        tone: 'danger',
      }))
    ) {
      return;
    }
    dispatch({ type: 'draft/reset' });
    setShowBriefErrors(false);
    setView('edit');
  }

  async function openFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await readTextFile(file);
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('O arquivo não é um JSON válido.');
      }
      const opened = deserializeDraft(data);
      if (!opened) throw new Error('O JSON não é um conteúdo exportado pelo Eminente AI Studio (ou é de uma versão incompatível).');
      if (!(await confirmReplace(`Abrir "${file.name}"`))) return;
      dispatch({ type: 'draft/replace', draft: opened });
      toast({ tone: 'success', title: 'Conteúdo aberto.', description: file.name });
    } catch (err) {
      toast({ tone: 'danger', title: 'Não foi possível abrir o arquivo.', description: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Criação"
        title="Content Studio"
        description="Transforme um assunto em roteiro, copy e estrutura de peças — com templates ou com texto de uma IA externa."
        meta={
          <>
            <Badge tone="accent">{FORMAT_LABELS[format]}</Badge>
            {hasContent && <Badge>Origem: {sourceLabel(draft.source)}</Badge>}
            <SaveBadge state={saveState} />
          </>
        }
        actions={
          <>
            <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={openFile} />
            <Button icon={FolderOpen} onClick={() => fileInput.current?.click()}>
              Abrir .json
            </Button>
            <Button icon={FilePlus2} onClick={newContent}>
              Novo conteúdo
            </Button>
          </>
        }
      />

      {recoveryNotice && (
        <div className="studio__notice">
          <Alert
            tone={recovery === 'corrupt' ? 'danger' : 'warning'}
            title={
              recovery === 'corrupt'
                ? 'O rascunho salvo estava corrompido e não pôde ser recuperado.'
                : 'O armazenamento do navegador está indisponível.'
            }
            actions={<Button size="sm" onClick={acknowledgeRecovery}>Entendi</Button>}
          >
            {recovery === 'corrupt'
              ? 'Um novo rascunho foi iniciado. Os dados originais foram preservados no navegador sob a chave "eminente:contentDraft.corrupt".'
              : 'O rascunho não será salvo automaticamente (modo privado ou bloqueio de dados do site). Baixe o .json para não perder o trabalho.'}
          </Alert>
        </div>
      )}
      {saveState.status === 'error' && (
        <div className="studio__notice">
          <Alert tone="danger" title="O salvamento automático falhou.">
            O navegador recusou gravar o rascunho (espaço esgotado ou dados do site bloqueados). Baixe o .json para não perder o trabalho.
          </Alert>
        </div>
      )}

      <div className="studio">
        <div className="studio__side">
          <BriefPanel
            brief={draft.brief}
            errors={showBriefErrors ? briefCheck.errors : {}}
            onChange={onBriefChange}
            onFormatChange={(f) => void onFormatChange(f)}
          />
          <SourcePanel
            brief={briefCheck.value}
            briefValid={briefCheck.ok}
            onRequireBrief={() => setShowBriefErrors(true)}
            onApplyTemplate={applyTemplate}
            onStartManual={startManual}
            onImport={importContent}
          />
        </div>

        <div className="studio__main">
          {!hasContent ? (
            <Card padding="none">
              <EmptyState
                icon={PenLine}
                title="Nenhum conteúdo ainda"
                description="Preencha o briefing e gere a estrutura a partir de um template, importe a resposta de uma IA externa ou comece a escrever em branco."
                actions={
                  <Button variant="primary" icon={FilePlus2} onClick={() => void startManual()}>
                    Começar em branco
                  </Button>
                }
              />
            </Card>
          ) : (
            <>
              <div className="studio__toolbar">
                <Segmented<View>
                  label="Modo de visualização"
                  value={view}
                  onChange={setView}
                  size="sm"
                  options={[
                    { value: 'edit', label: 'Editar', icon: PencilLine },
                    { value: 'preview', label: 'Pré-visualizar', icon: Eye },
                  ]}
                />
                <ExportActions draft={draft} validation={validation} />
              </div>
              {format !== 'motion' && (
                <div className="studio__next">
                  <span>Texto pronto? Gere as imagens da peça.</span>
                  <ButtonLink to={format === 'post' ? '/design' : '/carousel'} variant="primary" size="sm" iconRight={ArrowRight}>
                    Diagramar no {format === 'post' ? 'Design Studio' : 'Carousel Studio'}
                  </ButtonLink>
                </div>
              )}
              <IssuesSummary validation={validation} />
              {view === 'edit' ? (
                <div className="stack">
                  <PagesEditor draft={draft} issues={[...validation.errors, ...validation.warnings]} dispatch={dispatch} />
                  <MetaEditor draft={draft} issues={validation.errors} dispatch={dispatch} />
                </div>
              ) : (
                <ContentPreview draft={draft} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
