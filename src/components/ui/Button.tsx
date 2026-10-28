import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useLinkProps } from '../../app/router';
import { cx } from '../../lib/cx';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  children?: ReactNode;
  className?: string;
}

function buttonClass(variant: ButtonVariant, size: ButtonSize, iconOnly: boolean, className?: string) {
  return cx('btn', `btn--${variant}`, `btn--${size}`, iconOnly && 'btn--icon', className);
}

const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

export interface ButtonProps extends CommonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  loading?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  disabled,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const iconOnly = !children;
  return (
    <button
      type={type}
      className={buttonClass(variant, size, iconOnly, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={ICON_SIZE[size]} /> : Icon && <Icon size={ICON_SIZE[size]} aria-hidden />}
      {children && <span>{children}</span>}
      {IconRight && !loading && <IconRight size={ICON_SIZE[size]} aria-hidden />}
    </button>
  );
}

export interface ButtonLinkProps extends CommonProps {
  to: string;
  'aria-label'?: string;
}

/** Link interno com aparência de botão. */
export function ButtonLink({
  to,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  children,
  className,
  ...rest
}: ButtonLinkProps) {
  const link = useLinkProps(to);
  return (
    <a {...link} className={buttonClass(variant, size, !children, className)} {...rest}>
      {Icon && <Icon size={ICON_SIZE[size]} aria-hidden />}
      {children && <span>{children}</span>}
      {IconRight && <IconRight size={ICON_SIZE[size]} aria-hidden />}
    </a>
  );
}
