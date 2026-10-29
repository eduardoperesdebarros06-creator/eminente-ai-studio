import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { DraftValidation, DraftIssue } from '../../domain/content/validate';
import { cx } from '../../lib/cx';

function focusIssue(issue: DraftIssue) {
  const target = issue.pageId ? document.getElementById(`page-${issue.pageId}`) : document.querySelector('.meta-editor');
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.querySelector<HTMLElement>('input, textarea')?.focus({ preventScroll: true });
}

export function IssuesSummary({ validation }: { validation: DraftValidation }) {
  const { errors, warnings } = validation;
  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div className="issues issues--ok" role="status">
        <CheckCircle2 size={16} aria-hidden />
        Conteúdo completo e pronto para exportar.
      </div>
    );
  }
  const all = [...errors, ...warnings];
  return (
    <details className={cx('issues', errors.length ? 'issues--error' : 'issues--warning')} open={errors.length > 0}>
      <summary className="issues__summary">
        {errors.length > 0 ? <XCircle size={16} aria-hidden /> : <AlertTriangle size={16} aria-hidden />}
        <span>
          {errors.length > 0 && `${errors.length} ${errors.length === 1 ? 'erro impede' : 'erros impedem'} a exportação`}
          {errors.length > 0 && warnings.length > 0 && ' · '}
          {warnings.length > 0 && `${warnings.length} ${warnings.length === 1 ? 'aviso' : 'avisos'}`}
        </span>
      </summary>
      <ul className="issues__list">
        {all.map((issue, i) => (
          <li key={`${issue.message}-${i}`}>
            <button type="button" className={cx('issues__item', `issues__item--${issue.severity}`)} onClick={() => focusIssue(issue)}>
              {issue.message}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
