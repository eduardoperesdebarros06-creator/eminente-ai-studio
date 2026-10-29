import { totalDuration } from './draft';
import { FORMAT_LABELS, OBJECTIVE_LABELS, ROLE_LABELS, TONE_LABELS, type ContentDraft } from './types';

const unitLabel = (d: ContentDraft) => (d.brief.format === 'motion' ? 'Cena' : d.brief.format === 'carousel' ? 'Slide' : 'Página');

/** Documento Markdown completo do conteúdo, para revisão e arquivo. */
export function draftToMarkdown(d: ContentDraft): string {
  const out: string[] = [
    `# ${d.brief.subject || 'Conteúdo sem assunto'}`,
    '',
    `- **Formato:** ${FORMAT_LABELS[d.brief.format]}`,
    `- **Objetivo:** ${OBJECTIVE_LABELS[d.brief.objective]}`,
    `- **Tom:** ${TONE_LABELS[d.brief.tone]}`,
  ];
  if (d.brief.audience) out.push(`- **Público:** ${d.brief.audience}`);
  if (d.brief.format === 'motion') out.push(`- **Duração total:** ${totalDuration(d.pages)} s`);
  out.push('');

  d.pages.forEach((p, i) => {
    const dur = d.brief.format === 'motion' ? ` · ${p.durationSec} s` : '';
    out.push(`## ${unitLabel(d)} ${i + 1} — ${ROLE_LABELS[p.role]}${dur}`, '', `**${p.heading}**`);
    if (p.body.trim()) out.push('', p.body.trim());
    out.push('');
  });

  if (d.caption.trim()) out.push('## Legenda', '', d.caption.trim(), '');
  if (d.cta.trim()) out.push('## CTA', '', d.cta.trim(), '');
  if (d.hashtags.length) out.push('## Hashtags', '', d.hashtags.join(' '), '');
  return out.join('\n');
}

/** Texto pronto para colar na publicação: legenda + CTA + hashtags. */
export function draftToCaptionText(d: ContentDraft): string {
  return [d.caption.trim(), d.cta.trim(), d.hashtags.join(' ')].filter(Boolean).join('\n\n');
}

export function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'conteudo'
  );
}

export function exportFileName(d: ContentDraft, ext: 'md' | 'json', now = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  return `eminente-${d.brief.format}-${slugify(d.brief.subject)}-${date}.${ext}`;
}
