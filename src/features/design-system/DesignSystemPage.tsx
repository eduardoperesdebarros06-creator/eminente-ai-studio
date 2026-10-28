import { useState, type FormEvent } from 'react';
import { ArrowRight, Download, ImageIcon, Plus, Sparkles, Trash2 } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  ProgressBar,
  SectionHeader,
  Select,
  TextArea,
  TextInput,
} from '../../components/ui';
import { validateBrief, type BriefErrors, BRIEF_LIMITS } from '../../domain/brief';

const COLORS = [
  { name: 'Background', token: '--color-bg', hex: '#0B0B0C' },
  { name: 'Surface', token: '--color-surface', hex: '#161618' },
  { name: 'Surface 2', token: '--color-surface-2', hex: '#1C1C1F' },
  { name: 'Border', token: '--color-border', hex: '#26262A' },
  { name: 'Text', token: '--color-text', hex: '#FFFFFF' },
  { name: 'Text secondary', token: '--color-text-secondary', hex: '#B4B4BB' },
  { name: 'Accent', token: '--color-accent', hex: '#FF6A13' },
  { name: 'Accent hover', token: '--color-accent-hover', hex: '#FF7F33' },
];

const TYPE_SCALE = [
  { label: 'Display', token: '--text-display', sample: 'Eminente AI Studio', weight: 'var(--weight-bold)' },
  { label: '3XL · 36', token: '--text-3xl', sample: 'Conteúdo que posiciona', weight: 'var(--weight-semibold)' },
  { label: '2XL · 28', token: '--text-2xl', sample: 'Título de seção', weight: 'var(--weight-semibold)' },
  { label: 'XL · 22', token: '--text-xl', sample: 'Título de card', weight: 'var(--weight-semibold)' },
  { label: 'Base · 15', token: '--text-base', sample: 'Texto corrido para descrições e conteúdo editorial.', weight: 'var(--weight-regular)' },
  { label: 'SM · 13', token: '--text-sm', sample: 'Texto auxiliar, metadados e legendas.', weight: 'var(--weight-regular)' },
];

export function DesignSystemPage() {
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [format, setFormat] = useState('square');
  const [errors, setErrors] = useState<BriefErrors>({});
  const [validated, setValidated] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = validateBrief({ subject, notes });
    setErrors(result.errors);
    setValidated(result.ok);
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Fundação"
        title="Design system"
        description="Tokens e componentes reutilizáveis da Eminente. Todos os módulos são construídos a partir desta base."
        meta={<Badge tone="success" dot>Fase 1</Badge>}
      />

      <section className="section">
        <SectionHeader title="Cores" description="Preto/carvão como base, branco para contraste e laranja como único destaque." />
        <div className="swatch-grid">
          {COLORS.map((c) => (
            <div key={c.token} className="swatch">
              <div className="swatch__chip" style={{ background: `var(${c.token})` }} />
              <p className="swatch__name">{c.name}</p>
              <p className="swatch__meta mono">{c.hex}</p>
              <p className="swatch__meta mono">{c.token}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHeader title="Tipografia" description="Inter Variable, empacotada localmente — funciona offline." />
        <Card padding="none">
          <ul className="type-scale">
            {TYPE_SCALE.map((t) => (
              <li key={t.token} className="type-scale__row">
                <span className="type-scale__meta">
                  <span>{t.label}</span>
                  <span className="mono">{t.token}</span>
                </span>
                <span
                  className="type-scale__sample"
                  style={{ fontSize: `var(${t.token})`, fontWeight: t.weight }}
                >
                  {t.sample}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="section">
        <SectionHeader title="Botões" />
        <Card>
          <div className="ds-row">
            <Button variant="primary" icon={Sparkles}>Primário</Button>
            <Button variant="secondary" icon={Plus}>Secundário</Button>
            <Button variant="ghost" iconRight={ArrowRight}>Ghost</Button>
            <Button variant="danger" icon={Trash2}>Excluir</Button>
            <Button variant="primary" loading>Processando</Button>
            <Button variant="secondary" disabled>Desabilitado</Button>
            <Button variant="secondary" icon={Download} aria-label="Baixar" />
          </div>
          <div className="ds-row">
            <Button variant="primary" size="sm">Pequeno</Button>
            <Button variant="primary" size="md">Médio</Button>
            <Button variant="primary" size="lg">Grande</Button>
          </div>
        </Card>
      </section>

      <section className="section">
        <SectionHeader title="Badges" />
        <Card>
          <div className="ds-row">
            <Badge>Neutro</Badge>
            <Badge tone="accent" dot>Em andamento</Badge>
            <Badge tone="success" dot>Concluído</Badge>
            <Badge tone="warning" dot>Pendente</Badge>
            <Badge tone="danger" dot>Falhou</Badge>
            <Badge tone="info">Info</Badge>
          </div>
        </Card>
      </section>

      <div className="ds-split">
        <section className="section">
          <SectionHeader
            title="Formulário com validação"
            description="Mesmas regras que o briefing do Content Studio usará na Fase 2."
          />
          <Card>
            <form className="form" onSubmit={handleSubmit} noValidate>
              <TextInput
                label="Assunto"
                placeholder="Ex.: Como a IA muda a gestão de marketing"
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setValidated(false); }}
                error={errors.subject}
                hint="Obrigatório. Seja específico sobre o tema central."
                counter={{ current: subject.trim().length, max: BRIEF_LIMITS.subjectMax }}
              />
              <TextArea
                label="Observações"
                placeholder="Público, tom de voz, objetivo..."
                rows={4}
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setValidated(false); }}
                error={errors.notes}
                counter={{ current: notes.trim().length, max: BRIEF_LIMITS.notesMax }}
              />
              <Select
                label="Formato"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                options={[
                  { value: 'square', label: 'Quadrado · 1080 × 1080' },
                  { value: 'portrait', label: 'Retrato · 1080 × 1350' },
                  { value: 'story', label: 'Vertical · 1080 × 1920' },
                  { value: 'landscape', label: 'Paisagem · 1920 × 1080' },
                ]}
              />
              <div className="form__actions">
                <Button type="submit" variant="primary">Validar briefing</Button>
              </div>
              {validated && (
                <Alert tone="success" title="Briefing válido.">
                  A validação passou. Nada foi salvo: a persistência chega na Fase 5.
                </Alert>
              )}
            </form>
          </Card>
        </section>

        <section className="section">
          <SectionHeader title="Feedback" description="Alertas e progresso para renderizações e exportações." />
          <div className="stack">
            <Alert tone="info" title="Renderização local">
              Quadros são gerados nesta máquina; nenhum dado sai do computador.
            </Alert>
            <Alert tone="warning" title="FFmpeg não encontrado no PATH">
              Exemplo de mensagem acionável: instale o FFmpeg e reinicie o servidor local.
            </Alert>
            <Alert tone="danger" title="Falha ao codificar o vídeo">
              Exemplo: o quadro 148 de 300 não pôde ser lido. Verifique o espaço em disco.
            </Alert>
            <Card>
              <div className="stack">
                <ProgressBar label="Exemplo · quadros renderizados" value={62} detail="186 / 300" />
                <ProgressBar label="Exemplo · etapa sem duração conhecida" />
              </div>
            </Card>
          </div>
        </section>
      </div>

      <section className="section">
        <SectionHeader title="Estado vazio" />
        <Card padding="none">
          <EmptyState
            icon={ImageIcon}
            title="Nenhuma peça neste projeto"
            description="Estados vazios explicam o que falta e qual é o próximo passo."
            actions={<Button variant="primary" icon={Plus}>Ação principal</Button>}
          />
        </Card>
      </section>

      <section className="section">
        <SectionHeader title="Cards" />
        <div className="ds-cards">
          <Card>
            <CardHeader title="Card padrão" description="Superfície para agrupar conteúdo." />
          </Card>
          <Card interactive tabIndex={0}>
            <CardHeader title="Card interativo" description="Realce de borda no hover e no foco." />
          </Card>
        </div>
      </section>
    </div>
  );
}
