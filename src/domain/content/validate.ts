import { totalDuration } from './draft';
import { LIMITS, PAGE_LIMITS } from './limits';
import { FORMAT_LABELS, type ContentDraft } from './types';

export type IssueSeverity = 'error' | 'warning';

export interface DraftIssue {
  severity: IssueSeverity;
  /** Página afetada (id), quando aplicável. */
  pageId?: string;
  field: 'pages' | 'heading' | 'body' | 'durationSec' | 'caption' | 'cta' | 'hashtags' | 'duration';
  message: string;
}

export interface DraftValidation {
  ok: boolean;
  errors: DraftIssue[];
  warnings: DraftIssue[];
}

const PLACEHOLDER = /\[[^\]\n]{1,120}\]/;

export function hasPlaceholder(text: string): boolean {
  return PLACEHOLDER.test(text);
}

/**
 * Valida o rascunho. Erros impedem a exportação; avisos apenas orientam.
 */
export function validateDraft(draft: ContentDraft): DraftValidation {
  const issues: DraftIssue[] = [];
  const format = draft.brief.format;
  const { min, max } = PAGE_LIMITS[format];
  const unit = format === 'motion' ? 'cena' : 'página';
  const units = format === 'motion' ? 'cenas' : 'páginas';

  if (draft.pages.length < min || draft.pages.length > max) {
    issues.push({
      severity: 'error',
      field: 'pages',
      message:
        min === max
          ? `${FORMAT_LABELS[format]} deve ter exatamente ${min} ${unit}.`
          : `${FORMAT_LABELS[format]} deve ter entre ${min} e ${max} ${units} (atual: ${draft.pages.length}).`,
    });
  }

  draft.pages.forEach((p, i) => {
    const n = `${unit[0]!.toUpperCase()}${unit.slice(1)} ${i + 1}`;
    const heading = p.heading.trim();
    if (!heading) {
      issues.push({ severity: 'error', pageId: p.id, field: 'heading', message: `${n}: o título é obrigatório.` });
    } else if (heading.length > LIMITS.heading.max) {
      issues.push({ severity: 'error', pageId: p.id, field: 'heading', message: `${n}: título com ${heading.length} caracteres (máx. ${LIMITS.heading.max}).` });
    } else if (heading.length > LIMITS.heading.recommended) {
      issues.push({ severity: 'warning', pageId: p.id, field: 'heading', message: `${n}: títulos acima de ${LIMITS.heading.recommended} caracteres tendem a ficar pequenos no layout.` });
    }
    if (p.body.trim().length > LIMITS.body.max) {
      issues.push({ severity: 'error', pageId: p.id, field: 'body', message: `${n}: texto com ${p.body.trim().length} caracteres (máx. ${LIMITS.body.max}).` });
    }
    if (format === 'carousel' && p.role === 'content' && !p.body.trim()) {
      issues.push({ severity: 'warning', pageId: p.id, field: 'body', message: `${n}: página de conteúdo sem texto de apoio.` });
    }
    if (format === 'motion' && (p.durationSec < LIMITS.sceneDuration.min || p.durationSec > LIMITS.sceneDuration.max)) {
      issues.push({ severity: 'error', pageId: p.id, field: 'durationSec', message: `${n}: duração deve ficar entre ${LIMITS.sceneDuration.min} e ${LIMITS.sceneDuration.max} s.` });
    }
    if (hasPlaceholder(p.heading) || hasPlaceholder(p.body)) {
      issues.push({ severity: 'warning', pageId: p.id, field: 'heading', message: `${n}: ainda há marcadores [entre colchetes] para substituir.` });
    }
  });

  if (format === 'motion') {
    const total = totalDuration(draft.pages);
    if (total > LIMITS.motionTotalMax) {
      issues.push({ severity: 'error', field: 'duration', message: `Duração total de ${total} s excede o máximo de ${LIMITS.motionTotalMax} s.` });
    }
  }

  if (draft.caption.length > LIMITS.caption.max) {
    issues.push({ severity: 'error', field: 'caption', message: `Legenda com ${draft.caption.length} caracteres (máx. ${LIMITS.caption.max}).` });
  } else if (!draft.caption.trim()) {
    issues.push({ severity: 'warning', field: 'caption', message: 'A legenda está vazia.' });
  }
  if (draft.cta.trim().length > LIMITS.cta.max) {
    issues.push({ severity: 'error', field: 'cta', message: `CTA com mais de ${LIMITS.cta.max} caracteres.` });
  }
  if (hasPlaceholder(draft.caption) || hasPlaceholder(draft.cta)) {
    issues.push({ severity: 'warning', field: 'caption', message: 'Legenda ou CTA ainda têm marcadores [entre colchetes].' });
  }
  if (draft.hashtags.length > LIMITS.hashtags.max) {
    issues.push({ severity: 'error', field: 'hashtags', message: `Máximo de ${LIMITS.hashtags.max} hashtags (atual: ${draft.hashtags.length}).` });
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  return { ok: errors.length === 0, errors, warnings };
}
