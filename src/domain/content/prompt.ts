import { LIMITS, PAGE_LIMITS } from './limits';
import { getTemplate } from './templates';
import { FORMAT_LABELS, OBJECTIVE_LABELS, TONE_LABELS, type Brief } from './types';

/**
 * Monta um prompt para ser colado em qualquer assistente de IA externo
 * (gratuito ou não). O app não chama nenhuma API: o usuário copia o prompt,
 * cola a resposta de volta e o parser a interpreta.
 */
export function buildExternalPrompt(brief: Brief, templateId?: string | null): string {
  const tpl = templateId ? getTemplate(templateId) : undefined;
  const structure = tpl && tpl.format === brief.format ? tpl.build(brief) : null;
  const { min, max } = PAGE_LIMITS[brief.format];
  const isMotion = brief.format === 'motion';
  const unit = isMotion ? 'cena' : brief.format === 'carousel' ? 'slide' : 'página';

  const count = structure
    ? `exatamente ${structure.length} ${unit}${structure.length > 1 ? 's' : ''}`
    : min === max
      ? `exatamente ${min} ${unit}`
      : `entre ${min} e ${max} ${unit}s`;

  const lines: string[] = [
    'Você é redator sênior de marketing da marca EMINENTE: premium, corporativa, editorial e objetiva.',
    `Crie um ${FORMAT_LABELS[brief.format].toLowerCase()} para redes sociais em português do Brasil.`,
    '',
    'BRIEFING',
    `- Assunto: ${brief.subject}`,
    `- Objetivo: ${OBJECTIVE_LABELS[brief.objective]}`,
    `- Público: ${brief.audience || 'não especificado'}`,
    `- Tom de voz: ${TONE_LABELS[brief.tone]}`,
  ];
  if (brief.notes) lines.push(`- Observações: ${brief.notes}`);

  lines.push('', 'ESTRUTURA', `- Gere ${count}.`);
  if (structure) {
    structure.forEach((p, i) => {
      lines.push(`  ${i + 1}. ${p.heading}${p.body ? ` — ${p.body}` : ''}`);
    });
    lines.push('  (Substitua todo texto entre colchetes por conteúdo final.)');
  }
  if (brief.format === 'carousel') lines.push('- O primeiro slide é a capa com gancho forte; o último traz a chamada final.');

  lines.push(
    '',
    'REGRAS',
    `- "titulo": até ${LIMITS.heading.recommended} caracteres, frase de impacto.`,
    isMotion
      ? '- "texto": opcional e curto (até 60 caracteres), pois cada cena aparece por poucos segundos.'
      : `- "texto": até ${LIMITS.body.max} caracteres.`,
  );
  if (isMotion) {
    lines.push(
      `- "duracao": segundos de cada cena, entre ${LIMITS.sceneDuration.min} e ${LIMITS.sceneDuration.max}; total até ${LIMITS.motionTotalMax} s.`,
    );
  }
  lines.push(
    `- "legenda": texto para acompanhar a publicação, até ${Math.min(LIMITS.caption.max, 1200)} caracteres.`,
    `- "cta": até ${LIMITS.cta.max} caracteres.`,
    '- "hashtags": de 3 a 8 hashtags relevantes.',
    '- Não use emojis em excesso nem promessas exageradas.',
    '',
    'FORMATO DA RESPOSTA',
    'Responda SOMENTE com um JSON válido, sem comentários, neste formato:',
    '{',
    `  "paginas": [{ "titulo": "...", "texto": "..."${isMotion ? ', "duracao": 4' : ''} }],`,
    '  "legenda": "...",',
    '  "cta": "...",',
    '  "hashtags": ["#exemplo"]',
    '}',
  );

  return lines.join('\n');
}
