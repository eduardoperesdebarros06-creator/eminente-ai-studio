import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export function Card({ padding = 'md', interactive = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cx('card', `card--pad-${padding}`, interactive && 'card--interactive', className)}
      {...rest}
    />
  );
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="card__header">
      <div className="card__heading">
        <h3 className="card__title">{title}</h3>
        {description && <p className="card__description">{description}</p>}
      </div>
      {actions && <div className="card__actions">{actions}</div>}
    </div>
  );
}
