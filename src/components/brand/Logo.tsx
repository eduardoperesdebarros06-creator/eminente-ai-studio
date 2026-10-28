import { cx } from '../../lib/cx';

/** Monograma "E" com o ponto laranja da marca. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo-mark">
      <rect width="64" height="64" rx="14" fill="var(--color-surface-2)" />
      <rect x="0.5" y="0.5" width="63" height="63" rx="13.5" fill="none" stroke="var(--color-border-strong)" />
      <path d="M20 18h24v6H27v5h15v6H27v5h17v6H20z" fill="var(--color-text)" />
      <rect x="46" y="40" width="6" height="6" fill="var(--color-accent)" />
    </svg>
  );
}

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cx('logo', className)}>
      <LogoMark />
      {!compact && (
        <span className="logo__text">
          <span className="logo__brand">EMINENTE</span>
          <span className="logo__product">AI STUDIO</span>
        </span>
      )}
    </span>
  );
}
