import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from 'lucide-react';
import { cx } from '../../lib/cx';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const ICONS: Record<AlertTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

export function Alert({
  tone = 'info',
  title,
  children,
  actions,
}: {
  tone?: AlertTone;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const Icon = ICONS[tone];
  return (
    <div className={cx('alert', `alert--${tone}`)} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon size={18} className="alert__icon" aria-hidden />
      <div className="alert__body">
        <p className="alert__title">{title}</p>
        {children && <div className="alert__text">{children}</div>}
        {actions && <div className="alert__actions">{actions}</div>}
      </div>
    </div>
  );
}
