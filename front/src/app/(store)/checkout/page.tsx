import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CheckoutForm } from '@/features/checkout/checkout-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkout');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** Access is enforced by proxy.ts (redirect to login) and by the API for every request. */
export default function CheckoutPage() {
  return (
    <div className="container" style={{ paddingBottom: 'var(--space-20)' }}>
      <CheckoutForm />
    </div>
  );
}
