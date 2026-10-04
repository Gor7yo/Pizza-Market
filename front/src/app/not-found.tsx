import { SearchX } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { StoreShell } from '@/components/layout/store-shell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <StoreShell>
      <div className="container">
        <EmptyState
          icon={SearchX}
          title={t('title')}
          text={t('text')}
          action={
            <Button href="/menu" variant="primary">
              {t('action')}
            </Button>
          }
        />
      </div>
    </StoreShell>
  );
}
