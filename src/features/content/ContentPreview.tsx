import { totalDuration } from '../../domain/content/draft';
import { ROLE_LABELS, type ContentDraft } from '../../domain/content/types';
import { unitNames } from './PagesEditor';

/**
 * Pré-visualização TEXTUAL: confere hierarquia e sequência. O layout visual
 * final (templates gráficos, formatos, PNG) é responsabilidade do Design Studio.
 */
export function ContentPreview({ draft }: { draft: ContentDraft }) {
  const format = draft.brief.format;
  const unit = unitNames(format);
  const total = totalDuration(draft.pages);

  return (
    <div className="preview">
      <p className="preview__note">
        Prévia de texto e sequência. O layout gráfico e a exportação de imagens chegam no Design Studio (Fase 3).
      </p>

      {format === 'motion' ? (
        <div className="preview-motion">
          <div className="preview-motion__bar" aria-hidden>
            {draft.pages.map((p) => (
              <span key={p.id} style={{ flexGrow: p.durationSec }} className="preview-motion__seg" />
            ))}
          </div>
          <ol className="preview-motion__list">
            {draft.pages.map((p, i) => (
              <li key={p.id} className="preview-motion__scene">
                <span className="preview-motion__time mono">
                  {draft.pages.slice(0, i).reduce((s, x) => s + x.durationSec, 0)}s
                </span>
                <div>
                  <p className="preview-motion__heading">{p.heading || <em>Sem título</em>}</p>
                  {p.body && <p className="preview-motion__body">{p.body}</p>}
                </div>
                <span className="preview-motion__dur mono">{p.durationSec}s</span>
              </li>
            ))}
          </ol>
          <p className="preview-motion__total">Duração total: {total} s</p>
        </div>
      ) : (
        <ol className="preview-slides">
          {draft.pages.map((p, i) => (
            <li key={p.id} className={`preview-slide preview-slide--${p.role}`} aria-label={`${unit.title} ${i + 1}`}>
              <span className="preview-slide__meta">
                <span>{String(i + 1).padStart(2, '0')}</span>
                <span>{ROLE_LABELS[p.role]}</span>
              </span>
              <span className="preview-slide__heading">{p.heading || 'Sem título'}</span>
              {p.body && <span className="preview-slide__body">{p.body}</span>}
              <span className="preview-slide__brand">EMINENTE</span>
            </li>
          ))}
        </ol>
      )}

      {(draft.caption || draft.cta || draft.hashtags.length > 0) && (
        <div className="preview-caption">
          <p className="eyebrow">Legenda</p>
          {draft.caption && <p className="preview-caption__text">{draft.caption}</p>}
          {draft.cta && <p className="preview-caption__cta">{draft.cta}</p>}
          {draft.hashtags.length > 0 && <p className="preview-caption__tags">{draft.hashtags.join(' ')}</p>}
        </div>
      )}
    </div>
  );
}
