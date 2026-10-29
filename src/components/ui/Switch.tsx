import { useId } from 'react';
import { cx } from '../../lib/cx';

export function Switch({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="switch-row">
      <div className="switch-row__text">
        <label htmlFor={id} className="switch-row__label">
          {label}
        </label>
        {hint && <p className="switch-row__hint">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={cx('switch', checked && 'switch--on')}
        onClick={() => onChange(!checked)}
      >
        <span className="switch__thumb" aria-hidden />
      </button>
    </div>
  );
}
