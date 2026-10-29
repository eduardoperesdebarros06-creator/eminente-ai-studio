import { Clapperboard, GalleryHorizontalEnd, Square } from 'lucide-react';
import { Card, CardHeader, Segmented, Select, TextArea, TextInput } from '../../components/ui';
import type { BriefErrors } from '../../domain/content/brief';
import { LIMITS } from '../../domain/content/limits';
import {
  OBJECTIVE_LABELS,
  TONE_LABELS,
  type Brief,
  type ContentFormat,
  type Objective,
  type Tone,
} from '../../domain/content/types';

const FORMAT_OPTIONS = [
  { value: 'post', label: 'Post', icon: Square },
  { value: 'carousel', label: 'Carrossel', icon: GalleryHorizontalEnd },
  { value: 'motion', label: 'Motion', icon: Clapperboard },
] as const;

const toOptions = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as Array<[T, string]>).map(([value, label]) => ({ value, label }));

export function BriefPanel({
  brief,
  errors,
  onChange,
  onFormatChange,
}: {
  brief: Brief;
  /** Erros só são passados depois que o usuário tenta gerar algo. */
  errors: BriefErrors;
  onChange: (brief: Brief) => void;
  onFormatChange: (format: ContentFormat) => void;
}) {
  const set = <K extends keyof Brief>(key: K, value: Brief[K]) => onChange({ ...brief, [key]: value });

  return (
    <Card className="studio-panel">
      <CardHeader title="Briefing" description="O ponto de partida de todo o conteúdo." />
      <div className="form studio-panel__body">
        <TextInput
          label="Assunto"
          placeholder="Ex.: Como a IA muda a gestão de marketing"
          value={brief.subject}
          onChange={(e) => set('subject', e.target.value)}
          error={errors.subject}
          counter={{ current: brief.subject.trim().length, max: LIMITS.subject.max }}
          maxLength={LIMITS.subject.max + 20}
        />
        <div className="field">
          <span className="field__label" aria-hidden>
            Formato
          </span>
          <Segmented<ContentFormat>
            label="Formato"
            value={brief.format}
            options={FORMAT_OPTIONS}
            onChange={onFormatChange}
            fullWidth
          />
        </div>
        <div className="form__row">
          <Select
            label="Objetivo"
            value={brief.objective}
            onChange={(e) => set('objective', e.target.value as Objective)}
            options={toOptions(OBJECTIVE_LABELS)}
          />
          <Select
            label="Tom de voz"
            value={brief.tone}
            onChange={(e) => set('tone', e.target.value as Tone)}
            options={toOptions(TONE_LABELS)}
          />
        </div>
        <TextInput
          label="Público"
          placeholder="Ex.: gestores de pequenas e médias empresas"
          value={brief.audience}
          onChange={(e) => set('audience', e.target.value)}
          error={errors.audience}
          counter={{ current: brief.audience.trim().length, max: LIMITS.audience.max }}
        />
        <TextArea
          label="Observações"
          placeholder="Contexto, pontos obrigatórios, o que evitar…"
          rows={3}
          value={brief.notes}
          onChange={(e) => set('notes', e.target.value)}
          error={errors.notes}
          counter={{ current: brief.notes.trim().length, max: LIMITS.notes.max }}
        />
      </div>
    </Card>
  );
}
