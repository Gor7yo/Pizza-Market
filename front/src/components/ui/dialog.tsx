'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './button';
import styles from './dialog.module.css';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Visually hide the title (still announced by screen readers). */
  hideTitle?: boolean;
  variant?: 'center' | 'sheet' | 'drawer';
  wide?: boolean;
  flush?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Accessible modal built on the native <dialog>: focus trap, Esc to close,
 * inert background and focus restoration come from the platform.
 */
export function Dialog({
  open,
  onClose,
  title,
  hideTitle,
  variant = 'center',
  wide,
  flush,
  footer,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = useTranslations('common');

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cn(styles.dialog, styles[variant], wide && styles.wide)}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // click on the backdrop (the dialog element itself, outside the content box)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {variant === 'sheet' ? <div className={styles.handle} aria-hidden /> : null}
      <div className={styles.header}>
        <h2 id={titleId} className={cn(styles.title, hideTitle && 'visually-hidden')}>
          {title}
        </h2>
        <Button variant="ghost" iconOnly size="sm" onClick={onClose} aria-label={t('close')}>
          <X size={20} aria-hidden />
        </Button>
      </div>
      {open ? <div className={cn(styles.body, flush && styles.bodyFlush)}>{children}</div> : null}
      {open && footer ? <div className={styles.footer}>{footer}</div> : null}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  danger,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: ReactNode;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('common');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {description ? <p>{description}</p> : null}
    </Dialog>
  );
}
