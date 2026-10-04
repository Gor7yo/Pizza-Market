'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/feedback';

/** Route-level error boundary: friendly message, no stack traces, retry. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errorPage');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container" style={{ paddingTop: 'var(--space-12)' }}>
      <ErrorState
        title={t('title')}
        text={error.digest ? t('textWithId', { id: error.digest }) : t('text')}
        action={
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button variant="primary" onClick={reset}>
              {t('retry')}
            </Button>
            <Button href="/">{t('home')}</Button>
          </div>
        }
      />
    </div>
  );
}
