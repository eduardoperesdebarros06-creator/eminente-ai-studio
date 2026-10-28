import { cx } from '../../lib/cx';

/**
 * Barra de progresso. Sem `value`, mostra estado indeterminado.
 * O valor é sempre limitado a 0–100 para evitar renderizações inválidas.
 */
export function ProgressBar({
  value,
  label,
  detail,
}: {
  value?: number;
  label?: string;
  detail?: string;
}) {
  const indeterminate = value === undefined || Number.isNaN(value);
  const pct = indeterminate ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div className="progress">
      {(label || detail || !indeterminate) && (
        <div className="progress__meta">
          {label && <span className="progress__label">{label}</span>}
          <span className="progress__detail">
            {detail ?? (indeterminate ? '' : `${Math.round(pct)}%`)}
          </span>
        </div>
      )}
      <div
        className={cx('progress__track', indeterminate && 'progress__track--indeterminate')}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : Math.round(pct)}
      >
        <div className="progress__bar" style={indeterminate ? undefined : { width: `${pct}%` }} />
      </div>
    </div>
  );
}
