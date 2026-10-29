import { useMemo, useState } from 'react';
import { Bot, ClipboardPaste, Copy, FilePlus2, LayoutTemplate, Wand2 } from 'lucide-react';
import { Alert, Button, Card, CardHeader, Segmented, Select, TextArea, useToast } from '../../components/ui';
import type { ImportedContent } from '../../domain/content/draft';
import { importWarnings, parseExternalResponse } from '../../domain/content/parse';
import { buildExternalPrompt } from '../../domain/content/prompt';
import { templatesFor } from '../../domain/content/templates';
import type { Brief } from '../../domain/content/types';
import { copyText } from '../../lib/files';
import { cx } from '../../lib/cx';
import { unitNames } from './PagesEditor';

type Tab = 'template' | 'ai';
type ImportFeedback = { tone: 'danger' | 'warning' | 'success'; title: string; items: string[] } | null;

const NO_TEMPLATE = '__none__';

export function SourcePanel({
  brief,
  briefValid,
  onRequireBrief,
  onApplyTemplate,
  onStartManual,
  onImport,
}: {
  brief: Brief;
  briefValid: boolean;
  /** Chamado quando uma ação exige briefing válido; exibe os erros do formulário. */
  onRequireBrief: () => void;
  onApplyTemplate: (templateId: string) => Promise<boolean>;
  onStartManual: () => Promise<boolean>;
  onImport: (content: ImportedContent) => Promise<boolean>;
}) {
  const toast = useToast();
  const templates = useMemo(() => templatesFor(brief.format), [brief.format]);
  const unit = unitNames(brief.format);
  const [tab, setTab] = useState<Tab>('template');
  const [selected, setSelected] = useState<string>(templates[0]?.id ?? NO_TEMPLATE);
  const [response, setResponse] = useState('');
  const [feedback, setFeedback] = useState<ImportFeedback>(null);

  // Ao trocar de formato, a seleção anterior deixa de valer e volta ao primeiro template.
  const effectiveSelected =
    selected === NO_TEMPLATE || templates.some((t) => t.id === selected) ? selected : (templates[0]?.id ?? NO_TEMPLATE);

  const prompt = useMemo(
    () => (briefValid ? buildExternalPrompt(brief, effectiveSelected === NO_TEMPLATE ? null : effectiveSelected) : ''),
    [brief, briefValid, effectiveSelected],
  );

  async function generate() {
    if (!briefValid) return onRequireBrief();
    if (effectiveSelected === NO_TEMPLATE) return;
    const applied = await onApplyTemplate(effectiveSelected);
    if (applied) toast({ tone: 'success', title: 'Estrutura gerada a partir do template.', description: 'Substitua os trechos entre [colchetes].' });
  }

  async function copyPrompt() {
    try {
      await copyText(prompt);
      toast({ tone: 'success', title: 'Prompt copiado.', description: 'Cole no assistente de IA de sua preferência.' });
    } catch (e) {
      toast({ tone: 'danger', title: 'Não foi possível copiar.', description: e instanceof Error ? e.message : String(e) });
    }
  }

  async function importResponse() {
    const result = parseExternalResponse(response);
    if (!result.ok) {
      setFeedback({ tone: 'danger', title: 'Não foi possível importar a resposta.', items: [result.error] });
      return;
    }
    const applied = await onImport(result.content);
    if (!applied) return;
    const warnings = [...result.warnings, ...importWarnings(result.content, brief.format)];
    const n = result.content.pages.length;
    setFeedback({
      tone: warnings.length ? 'warning' : 'success',
      title: `Resposta importada (${result.mode === 'json' ? 'JSON' : 'texto livre'}): ${n} ${n === 1 ? unit.one : unit.many}.`,
      items: warnings,
    });
    setResponse('');
  }

  return (
    <Card className="studio-panel">
      <CardHeader title="Estrutura" description="Comece por um template ou traga texto de uma IA externa." />
      <div className="studio-panel__body">
        <Segmented<Tab>
          label="Origem do conteúdo"
          value={tab}
          onChange={setTab}
          fullWidth
          options={[
            { value: 'template', label: 'Template', icon: LayoutTemplate },
            { value: 'ai', label: 'IA externa', icon: Bot },
          ]}
        />

        {tab === 'template' ? (
          <div className="source">
            <div className="template-list" role="radiogroup" aria-label="Templates">
              {templates.map((t) => {
                const active = t.id === effectiveSelected;
                const count = t.build(brief).length;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={cx('template-option', active && 'template-option--active')}
                    onClick={() => setSelected(t.id)}
                  >
                    <span className="template-option__radio" aria-hidden />
                    <span className="template-option__text">
                      <span className="template-option__name">
                        {t.name}
                        <span className="template-option__count">
                          {count} {count === 1 ? unit.one : unit.many}
                        </span>
                      </span>
                      <span className="template-option__desc">{t.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="source__actions">
              <Button variant="primary" icon={Wand2} onClick={generate}>
                Gerar estrutura
              </Button>
              <Button variant="ghost" icon={FilePlus2} onClick={() => void onStartManual()}>
                Começar em branco
              </Button>
            </div>
            <p className="source__note">
              Templates montam a estrutura com base no briefing. Não usam IA: os textos são pontos de partida para editar.
            </p>
          </div>
        ) : (
          <div className="source">
            <ol className="steps">
              <li className="steps__item">
                <p className="steps__title">
                  <span className="steps__num">1</span> Copie o prompt
                </p>
                <Select
                  label="Estrutura sugerida"
                  value={effectiveSelected}
                  onChange={(e) => setSelected(e.target.value)}
                  options={[...templates.map((t) => ({ value: t.id, label: t.name })), { value: NO_TEMPLATE, label: 'Livre (só os limites do formato)' }]}
                />
                {briefValid ? (
                  <>
                    <textarea className="input input--textarea prompt-box mono" readOnly value={prompt} rows={8} aria-label="Prompt gerado" />
                    <Button icon={Copy} onClick={copyPrompt}>
                      Copiar prompt
                    </Button>
                  </>
                ) : (
                  <Alert tone="info" title="Preencha o assunto para gerar o prompt." />
                )}
              </li>
              <li className="steps__item">
                <p className="steps__title">
                  <span className="steps__num">2</span> Cole no assistente de IA
                </p>
                <p className="source__note">
                  Use qualquer assistente (versões gratuitas incluídas). O estúdio não envia nada pela internet.
                </p>
              </li>
              <li className="steps__item">
                <p className="steps__title">
                  <span className="steps__num">3</span> Cole a resposta aqui
                </p>
                <TextArea
                  label="Resposta da IA"
                  placeholder='{"paginas": [...]} ou texto com "Slide 1", "Título:", "Legenda:"…'
                  rows={6}
                  value={response}
                  onChange={(e) => {
                    setResponse(e.target.value);
                    setFeedback(null);
                  }}
                  hint="Aceita JSON ou texto livre."
                />
                <Button variant="primary" icon={ClipboardPaste} onClick={importResponse} disabled={!response.trim()}>
                  Importar resposta
                </Button>
              </li>
            </ol>
          </div>
        )}

        {feedback && (
          <Alert tone={feedback.tone} title={feedback.title}>
            {feedback.items.length > 0 && (
              <ul className="alert__list">
                {feedback.items.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}
      </div>
    </Card>
  );
}
