import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import styles from './button.module.css';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  /** Square icon-only button: requires `aria-label`. */
  iconOnly?: boolean;
  loading?: boolean;
  className?: string;
  children?: ReactNode;
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = CommonProps & { href: string; 'aria-label'?: string; prefetch?: boolean };

function classes({ variant = 'outline', size = 'md', block, iconOnly, className }: CommonProps) {
  return cn(
    styles.button,
    styles[variant],
    size !== 'md' && styles[size],
    block && styles.block,
    iconOnly && styles.icon,
    className,
  );
}

export function Button(props: ButtonProps | LinkProps) {
  if (props.href !== undefined) {
    const { href, children, prefetch, ...rest } = props;
    return (
      <Link
        href={href}
        prefetch={prefetch}
        className={classes(rest)}
        aria-label={rest['aria-label']}
      >
        {children}
      </Link>
    );
  }
  const { variant, size, block, iconOnly, loading, className, children, disabled, type, ...rest } =
    props;
  return (
    <button
      type={type ?? 'button'}
      className={classes({ variant, size, block, iconOnly, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden /> : null}
      {children}
    </button>
  );
}
