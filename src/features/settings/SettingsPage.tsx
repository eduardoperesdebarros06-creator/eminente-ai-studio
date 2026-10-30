import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FolderOutput, RefreshCw, RotateCcw, Save, Sparkles, Wrench, XCircle } from 'lucide-react';
import { getModule } from '../../app/modules';
import { Alert, Badge, Button, Card, CardHeader, PageHeader, Segmented, Select, Spinner, Switch, TextInput, useToast } from '../../components/ui';
import { FORMAT_LABELS, type ContentFormat } from '../../domain/content/types';
import { OUTPUT_FORMATS, type FormatId } from '../../domain/design/formats';
import { HANDLE_MAX, MOTION_FPS, MOTION_TRANSITIONS, TRANSITION_LABELS, type MotionFps, type MotionTransition } from '../../domain/design/settings';
import { THEMES, type ThemeId } from '../../domain/design/themes';
import type { AppSettings, LibraryHealth, SettingsView } from '../../domain/library/library';
import type { RenderHealth, ToolCheck } from '../../domain/motion/api';
import { api } from '../../lib/api';
import { libraryClient } from '../library/libraryClient';
import { setSettingsView } from '../library/librarySync';

function Tool({ name, check }: { name: string; check: ToolCheck }) {
  return (
    <li className={check.ok ? 'tools__item' : 'tools__item tools__item--missing'}>
      {check.ok ? <CheckCircle2 size={14} aria-hidden /> : <XCircle size={14} aria-hidden />}
      <span className="tools__name">{name}</span>
      <span className="tools__detail">{check.detail}</span>
    </li>
  );
}

const same = (a: AppSettings, b: AppSettings) => JSON.stringify(a) === JSON.stringify(b);

export function SettingsPage() {
  const module = getModule('settings');
  const toast = useToast();
  const [view, setView] = useState<SettingsView | null>(null);
  const [form, setForm] = useState<AppSettings | null>(null);
  const [dirInput, setDirInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirError, setDirError] = useState<string | null>(null);
  const [tools, setTools] = useState<RenderHealth | null>(null);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [lib, setLib] = useState<LibraryHealth | null>(null);

  const apply = (v: SettingsView) => {
    setView(v);
    setForm(v.settings);
    setDirInput(v.settings.exportsDir ?? '');
    setSettingsView(v);
  };

  const checkTools = useCallback(async () => {
    setToolsLoading(true);
    try {
      setTools(await api<RenderHealth>('/api/health'));
    } catch {
      setTools(null);
    } finally {
      setToolsLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        apply(await libraryClient.settings());
        setLib(await libraryClient.health());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    void checkTools();
  }, [checkTools]);

  async function save(next: AppSettings, okTitle: string) {
    setSaving(true);
    setDirError(null);
    try {
      apply(await libraryClient.saveSettings(next));
      toast({ tone: 'success', title: okTitle });
      void checkTools();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (next.exportsDir !== view?.settings.exportsDir) setDirError(message);
      else toast({ tone: 'danger', title: 'Não foi possível salvar.', description: message });
    } finally {
      setSaving(false);
    }
  }

  const header = (
    <PageHeader
      eyebrow="Gestão"
      title={module.label}
      description={module.description}
      meta={<Badge tone="neutral">Salvo na biblioteca local</Badge>}
    />
  );

  if (error) {
    return (
      <div className="page">
        {header}
        <Alert tone="danger" title="Configurações indisponíveis">
          {error}
        </Alert>
      </div>
    );
  }
  if (!view || !form) {
    return (
      <div className="page">
        {header}
        <div className="stage__loading">
          <Spinner size={18} /> Carregando…
        </div>
      </div>
    );
  }

  const d = form.defaults;
  const setDefaults = (patch: Partial<AppSettings['defaults']>) => setForm({ ...form, defaults: { ...form.defaults, ...patch } });
  const setDesign = (patch: Partial<AppSettings['defaults']['design']>) => setDefaults({ design: { ...d.design, ...patch } });
  const defaultsChanged = !same({ ...view.settings, defaults: form.defaults }, view.settings);

  return (
    <div className="page">
      {header}
      <div className="settings">
        <Card>
          <CardHeader
            title={
              <span className="planned__aside-title">
                <FolderOutput size={16} aria-hidden /> Pasta dos vídeos (MP4)
              </span>
            }
            description="Onde o Motion Studio grava os vídeos. PNG, .zip, .md e .json continuam indo para a pasta de downloads do navegador."
          />
          <div className="settings__body">
            <TextInput
              label="Caminho completo da pasta"
              placeholder={view.defaultExportsDir}
              value={dirInput}
              onChange={(e) => {
                setDirInput(e.target.value);
                setDirError(null);
              }}
              error={dirError ?? undefined}
              hint={`Em uso agora: ${view.exportsDir}. Deixe vazio para usar a pasta padrão. A pasta é criada se não existir.`}
            />
            <div className="settings__row">
              <Button
                variant="primary"
                icon={Save}
                loading={saving}
                disabled={(dirInput.trim() || null) === view.settings.exportsDir}
                onClick={() => void save({ ...view.settings, exportsDir: dirInput.trim() || null }, 'Pasta dos vídeos atualizada.')}
              >
                Salvar pasta
              </Button>
              {view.settings.exportsDir && (
                <Button icon={RotateCcw} disabled={saving} onClick={() => void save({ ...view.settings, exportsDir: null }, 'Voltou para a pasta padrão.')}>
                  Usar a pasta padrão
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="planned__aside-title">
                <Wrench size={16} aria-hidden /> Diagnóstico
              </span>
            }
            description="Ferramentas usadas na exportação de MP4 e a biblioteca de projetos."
            actions={
              <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => void checkTools()} disabled={toolsLoading}>
                Verificar
              </Button>
            }
          />
          <div className="settings__body">
            {toolsLoading && !tools ? (
              <p className="stage__loading">
                <Spinner size={16} /> Verificando…
              </p>
            ) : tools ? (
              <ul className="tools" aria-label="Ferramentas">
                <Tool name="FFmpeg" check={tools.ffmpeg} />
                <Tool name="ffprobe" check={tools.ffprobe} />
                <Tool name="Navegador" check={tools.browser} />
                {lib && <Tool name="SQLite" check={{ ok: true, detail: `${lib.sqlite} · ${lib.file}` }} />}
              </ul>
            ) : (
              <Alert tone="danger" title="Servidor indisponível">
                Inicie o estúdio com <code>npm run dev</code>.
              </Alert>
            )}
            {tools && (!tools.ffmpeg.ok || !tools.ffprobe.ok) && (
              <Alert tone="warning" title="FFmpeg não encontrado">
                Instale com <code>winget install Gyan.FFmpeg</code>, feche e reabra o terminal e rode <code>npm run dev</code> de novo.
              </Alert>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Padrões para novo conteúdo"
            description='Aplicados quando você clica em "Novo conteúdo". Não mudam o conteúdo aberto agora.'
          />
          <div className="settings__body">
            <Segmented
              label="Formato inicial"
              value={d.format}
              onChange={(f: ContentFormat) => setDefaults({ format: f })}
              options={(['post', 'carousel', 'motion'] as const).map((f) => ({ value: f, label: FORMAT_LABELS[f] }))}
            />
            <Select
              label="Proporção"
              value={d.design.formatId}
              onChange={(e) => setDesign({ formatId: e.target.value as FormatId })}
              options={OUTPUT_FORMATS.map((f) => ({ value: f.id, label: `${f.ratio} · ${f.label} (${f.width} × ${f.height})` }))}
              hint="Se o formato da peça não aceitar essa proporção (ex.: carrossel em 9:16), o estúdio usa a mais próxima permitida."
            />
            <Select
              label="Tema"
              value={d.design.themeId}
              onChange={(e) => setDesign({ themeId: e.target.value as ThemeId })}
              options={THEMES.map((t) => ({ value: t.id, label: t.label }))}
            />
            <TextInput
              label="Assinatura"
              value={d.design.handle}
              maxLength={HANDLE_MAX}
              onChange={(e) => setDesign({ handle: e.target.value })}
              hint="Aparece no rodapé. Deixe vazio para ocultar."
            />
            <Switch label="Numeração das páginas" checked={d.design.showPageNumbers} onChange={(v) => setDesign({ showPageNumbers: v })} />
            <Switch label='Indicação "Arraste →" nos carrosséis' checked={d.design.showSwipeHint} onChange={(v) => setDesign({ showSwipeHint: v })} />
            <Segmented
              label="Motion · quadros por segundo"
              value={String(d.design.fps) as `${MotionFps}`}
              onChange={(v) => setDesign({ fps: Number(v) as MotionFps })}
              options={MOTION_FPS.map((f) => ({ value: String(f) as `${MotionFps}`, label: `${f} fps` }))}
            />
            <Segmented
              label="Motion · transição"
              value={d.design.transition}
              onChange={(v: MotionTransition) => setDesign({ transition: v })}
              options={MOTION_TRANSITIONS.map((t) => ({ value: t, label: TRANSITION_LABELS[t] }))}
            />
            <div className="settings__actions">
              {defaultsChanged && (
                <Button variant="ghost" disabled={saving} onClick={() => setForm(view.settings)}>
                  Descartar
                </Button>
              )}
              <Button
                variant="primary"
                icon={Save}
                loading={saving}
                disabled={!defaultsChanged}
                onClick={() => void save({ ...view.settings, defaults: form.defaults }, 'Padrões salvos.')}
              >
                Salvar padrões
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="planned__aside-title">
                <Sparkles size={16} aria-hidden /> IA local (Ollama)
              </span>
            }
            description="Integração opcional com um modelo rodando nesta máquina."
            actions={
              <Badge tone="warning" dot>
                Fase 6 · não implementado
              </Badge>
            }
          />
          <div className="settings__body">
            <p className="source__note">
              Por enquanto, use o caminho “IA externa” do Content Studio: o estúdio gera o prompt, você cola em qualquer assistente e cola a
              resposta de volta. Nada é enviado pela internet pelo app.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
