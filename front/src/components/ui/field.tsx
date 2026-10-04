'use client';

import { useTranslations } from 'next-intl';
import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from 'react';
import { cn } from '@/lib/cn';
import styles from './field.module.css';

interface FieldProps {
  label: ReactNode;
  /** Validation message key (from shared Zod schemas) or already translated text */
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby'?: string;
  }) => ReactNode;
}

/** Translates shared validation keys ("required", "email"...) and passes other strings through. */
export function useValidationMessage() {
  const t = useTranslations('validation');
  return (message?: string) => (message ? (t.has(message) ? t(message) : message) : undefined);
}

/** Label + control + hint + accessible error wiring (aria-invalid / aria-describedby). */
export function Field({ label, error, hint, optional, className, children }: FieldProps) {
  const id = useId();
  const tCommon = useTranslations('common');
  const translate = useValidationMessage();
  const errorText = translate(error);
  const describedBy = [errorText ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cn(styles.field, className)}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {optional ? <span className={styles.optional}> ({tCommon('optional')})</span> : null}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(errorText),
        'aria-describedby': describedBy || undefined,
      })}
      {hint ? (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      ) : null}
      {errorText ? (
        <span id={`${id}-error`} className={styles.error} role="alert">
          {errorText}
        </span>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(styles.control, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(styles.control, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(styles.control, className)} {...props} />;
}

export function Checkbox({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn(styles.checkbox, className)}>
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
