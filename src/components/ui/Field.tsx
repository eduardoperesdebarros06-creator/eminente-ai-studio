import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from '../../lib/cx';

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  counter?: { current: number; max: number };
  children: (ids: { id: string; describedBy?: string }) => ReactNode;
}

function FieldShell({ label, hint, error, counter, children }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const describedBy = error || hint ? hintId : undefined;
  const over = counter ? counter.current > counter.max : false;
  return (
    <div className={cx('field', error && 'field--invalid')}>
      <div className="field__top">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        {counter && (
          <span className={cx('field__counter', over && 'field__counter--over')}>
            {counter.current}/{counter.max}
          </span>
        )}
      </div>
      {children({ id, describedBy })}
      {(error || hint) && (
        <p id={hintId} className={cx('field__hint', error && 'field__hint--error')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

type Shared = Omit<FieldShellProps, 'children'>;

export function TextInput({ label, hint, error, counter, className, ...rest }: Shared & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} counter={counter}>
      {({ id, describedBy }) => (
        <input
          id={id}
          className={cx('input', className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

export function TextArea({ label, hint, error, counter, className, ...rest }: Shared & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} counter={counter}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          className={cx('input', 'input--textarea', className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

export function Select({
  label,
  hint,
  error,
  options,
  className,
  ...rest
}: Omit<Shared, 'counter'> &
  SelectHTMLAttributes<HTMLSelectElement> & { options: Array<{ value: string; label: string }> }) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ id, describedBy }) => (
        <select
          id={id}
          className={cx('input', 'input--select', className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}
