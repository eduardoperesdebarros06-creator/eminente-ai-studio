import { useId, type KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '../../lib/cx';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

/**
 * Controle segmentado (radiogroup). Setas esquerda/direita trocam a opção.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'md',
  fullWidth = false,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
}) {
  const id = useId();
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length];
    if (next) {
      onChange(next.value);
      document.getElementById(`${id}-${next.value}`)?.focus();
    }
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('segmented', `segmented--${size}`, fullWidth && 'segmented--full')}
      onKeyDown={onKeyDown}
    >
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            id={`${id}-${o.value}`}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={cx('segmented__item', active && 'segmented__item--active')}
            onClick={() => onChange(o.value)}
          >
            {Icon && <Icon size={14} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
