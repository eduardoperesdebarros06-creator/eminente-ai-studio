import { useEffect, useState } from 'react';
import { CheckCircle2, PlugZap, Save, Sparkles, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Segmented, Select, Spinner, Switch, TextInput } from '../../components/ui';
import { DEFAULT_OLLAMA_URL, normalizeOllamaUrl, type AiSettings, type AiStatus } from '../../domain/ai/ai';
import { aiClient } from './aiClient';

const GB = (n: number) => `${(n / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`;

const CREATIVITY = [
  { value: '0.3', label: 'Previsível' },
  { value: '0.7', label: 'Equilibrada' },
  { value: '0.9', label: 'Criativa' },
] as const;
type Creativity = (typeof CREATIVITY)[number]['value'];
const toCreativity = (t: number): Creativity => (t <= 0.45 ? '0.3' : t >= 0.85 ? '0.9' : '0.7');

function StatusLine({ status }: { status: AiStatus }) {
  switch (status.state) {
    case 'disabled':
      return null;
    case 'offline':
      return (
        <Alert tone="warning" title="Ollama não encontrado">
          {status.message}
        </Alert>
      );
    case 'no-models':
      return (
        <Alert tone="warning" title={`Ollama ${status.version} sem modelos`}>
          Baixe um modelo no terminal, por exemplo <code>ollama pull llama3.2</code> (cerca de 2 GB), e clique em “Testar conexão”.
        </Alert>
      );
    case 'ready':
      return (
        <ul className="tools" aria-label="Ollama">
          <li className="tools__item">
            <CheckCircle2 size={14} aria-hidden />
            <span className="tools__name">Ollama</span>
            <span className="tools__detail">
              versão {status.version} · {status.url} · {status.models.length} {status.models.length === 1 ? 'modelo' : 'modelos'}
            </span>
          </li>
        </ul>
      );
  }
}

/** Configurações da IA local (Ollama). */
export function AiSettingsCard({ saved, saving, onSave }: { saved: AiSettings; saving: boolean; onSave: (ai: AiSettings) => void }) {
  const [form, setForm] = useState<AiSettings>(saved);
  const [urlInput, setUrlInput] = useState(saved.url);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setForm(saved);
    setUrlInput(saved.url);
  }, [saved]);

  const url = normalizeOllamaUrl(urlInput);
  const urlError = urlInput.trim() && !url ? 'Use um endereço desta máquina, ex.: http://127.0.0.1:11434. Nada é enviado para fora do computador.' : undefined;
  const next: AiSettings = { ...form, url: url ?? form.url };
  const changed = JSON.stringify(next) !== JSON.stringify(saved);

  async function test(settings = next) {
    setTesting(true);
    try {
      setStatus(await aiClient.check(settings));
    } catch (e) {
      setStatus({ state: 'offline', url: settings.url, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setTesting(false);
    }
  }

  // Verifica ao abrir (mostra os modelos instalados mesmo antes de ligar).
  useEffect(() => {
    void test(saved);
    // Só na montagem / quando as configurações salvas mudam.
  }, [saved]);

  const models = status?.state === 'ready' ? status.models : [];
  const modelValue = status?.state === 'ready' ? (form.model && models.some((m) => m.name === form.model) ? form.model : status.model) : (form.model ?? '');

  return (
    <Card>
      <CardHeader
        title={
          <span className="planned__aside-title">
            <Sparkles size={16} aria-hidden /> IA local (Ollama)
          </span>
        }
        description="Gera a estrutura do conteúdo com um modelo rodando nesta máquina. Opcional: sem ela, use Template ou IA externa."
        actions={
          saved.enabled ? (
            <Badge tone="success" dot>
              Ligada
            </Badge>
          ) : (
            <Badge tone="neutral">Desligada</Badge>
          )
        }
      />
      <div className="settings__body">
        <Switch
          label="Usar a IA local no Content Studio"
          checked={form.enabled}
          onChange={(v) => setForm({ ...form, enabled: v })}
          hint="Aparece como “IA local” na escolha da estrutura."
        />
        <TextInput
          label="Endereço do Ollama"
          value={urlInput}
          placeholder={DEFAULT_OLLAMA_URL}
          onChange={(e) => setUrlInput(e.target.value)}
          error={urlError}
          hint={urlError ? undefined : 'O padrão do Ollama é http://127.0.0.1:11434.'}
        />
        {models.length > 0 ? (
          <Select
            label="Modelo"
            value={modelValue}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            options={models.map((m) => ({ value: m.name, label: `${m.name}${m.parameters ? ` · ${m.parameters}` : ''} · ${GB(m.size)}` }))}
            hint="Modelos maiores escrevem melhor, mas são mais lentos. Com 3 B, espere de 10 s a 1 min por resposta."
          />
        ) : null}
        <Segmented<Creativity>
          label="Criatividade"
          value={toCreativity(form.temperature)}
          onChange={(v) => setForm({ ...form, temperature: Number(v) })}
          options={CREATIVITY}
        />
        {testing && !status ? (
          <p className="stage__loading">
            <Spinner size={16} /> Procurando o Ollama…
          </p>
        ) : (
          status && <StatusLine status={status} />
        )}
        {status?.state === 'offline' && form.enabled && (
          <p className="source__note">
            <XCircle size={13} aria-hidden /> Você pode salvar ligada mesmo assim: o Content Studio avisa enquanto o Ollama não responder.
          </p>
        )}
        <div className="settings__actions">
          <Button icon={PlugZap} loading={testing} disabled={!url} onClick={() => void test()}>
            Testar conexão
          </Button>
          <Button
            variant="primary"
            icon={Save}
            loading={saving}
            disabled={!changed || !url}
            onClick={() => onSave({ ...next, model: status?.state === 'ready' ? modelValue : next.model })}
          >
            Salvar IA local
          </Button>
        </div>
      </div>
    </Card>
  );
}
