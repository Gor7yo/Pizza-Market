import { notFound } from 'next/navigation';
import { OrderDetail } from '@/features/orders/order-detail';
import styles from '@/features/orders/orders.module.css';

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { placed } = await searchParams;
  return (
    <div className={`container ${styles.page}`}>
      <OrderDetail id={id} placed={placed === '1'} />
    </div>
  );
}
