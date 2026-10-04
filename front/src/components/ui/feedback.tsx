import { AlertTriangle, type LucideIcon, ShoppingBag } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import styles from './feedback.module.css';

export function Skeleton({
  width,
  height = 16,
  radius,
  className,
}: {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  radius?: CSSProperties['borderRadius'];
  className?: string;
}) {
  return (
    <span
      className={cn(styles.skeleton, className)}
      style={{ width, height, borderRadius: radius }}
      aria-hidden
    />
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

export function EmptyState({
  icon: Icon = ShoppingBag,
  title,
  text,
  action,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.state}>
      <span className={styles.stateIcon} aria-hidden>
        <Icon size={32} />
      </span>
      <h2 className={styles.stateTitle}>{title}</h2>
      {text ? <p className={styles.stateText}>{text}</p> : null}
      {action ? <div className={styles.stateAction}>{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  text,
  action,
}: {
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.state} role="alert">
      <span className={cn(styles.stateIcon, styles.stateIconError)} aria-hidden>
        <AlertTriangle size={32} />
      </span>
      <h2 className={styles.stateTitle}>{title}</h2>
      {text ? <p className={styles.stateText}>{text}</p> : null}
      {action ? <div className={styles.stateAction}>{action}</div> : null}
    </div>
  );
}
