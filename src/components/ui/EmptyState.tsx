import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '../../lib/cx';

export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  children,
  compact = false,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx('empty', compact && 'empty--compact')}>
      <div className="empty__icon" aria-hidden>
        <Icon size={compact ? 20 : 24} strokeWidth={1.6} />
      </div>
      <h3 className="empty__title">{title}</h3>
      {description && <p className="empty__description">{description}</p>}
      {children}
      {actions && <div className="empty__actions">{actions}</div>}
    </div>
  );
}
