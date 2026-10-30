import { useEffect, useRef, useState } from 'react';
import { CircleSlash, ClipboardPaste, RefreshCw, Settings2, Sparkles } from 'lucide-react';
import { Alert, Button, ButtonLink, ProgressBar, Select, Spinner, TextArea } from '../../components/ui';
import type { AiStatus } from '../../domain/ai/ai';
import type { ImportedContent } from '../../domain/content/draft';
import { importWarnings, parseExternalResponse } from '../../domain/content/parse';
import { buildExternalPrompt } from '../../domain/content/prompt';
import type { ContentTemplate } from '../../domain/content/templates';
import type { Brief } from '../../domain/content/types';
import { aiClient } from './aiClient';

type Feedback = { tone: 'danger' | 'warning' | 'success'; title: string; items: string[] } | null;

const NO_TEMPLATE = '__none__';

/**
 * "IA local": gera a estrutura com o Ollama desta máquina. Usa o mesmo prompt
 * e o mesmo leitor de respostas da "IA externa", sem copiar e colar.
 */
export function LocalAiPanel({
  brief,
  briefValid,
  templates,
  unit,
  onRequireBrief,
  onImport,
}: {
  brief: Brief;
  briefValid: boolean;
  templates: readonly ContentTemplate[];
  unit: { one: string; many: string };
  onRequireBrief: () => void;
  onImport: (content: ImportedContent, source?: 'external-ai' | 'local-ai') => Promise<boolean>;
}) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [selected, setSelected] = useState<string>(templates[0]?.id ?? NO_TEMPLATE);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [failedText, setFailedText] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const effective = selected === NO_TEMPLATE || templates.some((t) => t.id === selected) ? selected : (templates[0]?.id ?? NO_TEMPLATE);

  const refresh = async () => {
    setStatus(null);
    try {
      setStatus(await aiClient.status());
    } catch (e) {
      setStatus({ state: 'offline', url: '', message: e instanceof Error ? e.message : String(e) });
    }
  };

  useEffect(() => {
    void refresh();
    return () => abort.current?.abort();
  }, []);

  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [running]);

  async function importText(text: string, model: string | null) {
    const result = parseExternalResponse(text);
    if (!result.ok) {
      setFailedText(text);
      setFeedback({
        tone: 'danger',
        title: 'O modelo respondeu, mas fora do formato esperado.',
        items: [result.error, 'Tente gerar de novo (modelos locais variam a cada tentativa), ajuste o texto abaixo e importe, ou use um modelo maior.'],
      });
      return;
    }
    const applied = await onImport(result.content, 'local-ai');
    if (!applied) {
      setFailedText(text);
      return;
    }
    setFailedText(null);
    const warnings = [...result.warnings, ...importWarnings(result.content, brief.format)];
    const n = result.content.pages.length;
    setFeedback({
      tone: warnings.length ? 'warning' : 'success',
      title: `Gerado com a IA local${model ? ` (${model})` : ''}: ${n} ${n === 1 ? unit.one : unit.many}. Revise antes de publicar.`,
      items: warnings,
    });
  }

  async function run() {
    if (!briefValid) return onRequireBrief();
    setFeedback(null);
    setFailedText(null);
    setOutput('');
    setElapsed(0);
    const ctl = new AbortController();
    abort.current = ctl;
    setRunning(true);
    const prompt = buildExternalPrompt(brief, effective === NO_TEMPLATE ? null : effective);
    try {
      const { text, model } = await aiClient.generate(prompt, { onText: setOutput, signal: ctl.signal });
      setRunning(false);
      await importText(text, model);
    } catch (e) {
      setRunning(false);
      if (ctl.signal.aborted) {
        setFeedback({ tone: 'warning', title: 'Geração cancelada.', items: [] });
      } else {
        setFeedback({ tone: 'danger', title: 'A IA local não conseguiu gerar.', items: [e instanceof Error ? e.message : String(e)] });
        void refresh();
      }
    } finally {
      abort.current = null;
    }
  }

  if (!status) {
    return (
      <p className="stage__loading">
        <Spinner size={16} /> Procurando a IA local…
      </p>
    );
  }

  if (status.state !== 'ready') {
    const title =
      status.state === 'disabled' ? 'A IA local está desligada' : status.state === 'no-models' ? 'O Ollama não tem modelos instalados' : 'Ollama não encontrado';
    const text =
      status.state === 'disabled'
        ? 'Ligue em Configurações para gerar a estrutura com um modelo rodando nesta máquina (Ollama). Sem ela, use Template ou IA externa.'
        : status.state === 'no-models'
          ? 'No terminal, rode: ollama pull llama3.2 (cerca de 2 GB). Depois clique em "Verificar de novo".'
          : status.message;
    return (
      <div className="source">
        <Alert tone={status.state === 'disabled' ? 'info' : 'warning'} title={title}>
          {text}
        </Alert>
        <div className="source__actions">
          <ButtonLink to="/settings" icon={Settings2}>
            Configurações
          </ButtonLink>
          {status.state !== 'disabled' && (
            <Button variant="ghost" icon={RefreshCw} onClick={() => void refresh()}>
              Verificar de novo
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="source">
      <Select
        label="Estrutura sugerida"
        value={effective}
        disabled={running}
        onChange={(e) => setSelected(e.target.value)}
        options={[...templates.map((t) => ({ value: t.id, label: t.name })), { value: NO_TEMPLATE, label: 'Livre (só os limites do formato)' }]}
      />
      <p className="source__note">
        Modelo: <span className="mono">{status.model}</span> no Ollama {status.version}. Tudo roda nesta máquina; nada vai para a internet.
      </p>
      {!briefValid && <Alert tone="info" title="Preencha o assunto para gerar." />}

      <div className="source__actions">
        {running ? (
          <Button icon={CircleSlash} onClick={() => abort.current?.abort()}>
            Cancelar
          </Button>
        ) : (
          <Button variant="primary" icon={Sparkles} onClick={() => void run()}>
            Gerar com IA local
          </Button>
        )}
      </div>

      {running && (
        <>
          <ProgressBar
            label={output ? 'Escrevendo…' : 'Carregando o modelo e pensando… (a primeira vez demora mais)'}
            detail={`${elapsed} s${output ? ` · ${output.length.toLocaleString('pt-BR')} caracteres` : ''}`}
          />
          {output && <textarea className="input input--textarea prompt-box mono" readOnly value={output} rows={8} aria-label="Texto sendo gerado" />}
        </>
      )}

      {failedText !== null && !running && (
        <>
          <TextArea label="Resposta do modelo (pode editar)" rows={8} value={failedText} onChange={(e) => setFailedText(e.target.value)} />
          <div className="source__actions">
            <Button icon={ClipboardPaste} onClick={() => void importText(failedText, null)}>
              Importar este texto
            </Button>
            <Button variant="ghost" icon={RefreshCw} onClick={() => void run()}>
              Gerar de novo
            </Button>
          </div>
        </>
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
  );
}
