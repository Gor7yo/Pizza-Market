'use client';

import { createReviewSchema } from '@market/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Star } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Textarea, useValidationMessage } from '@/components/ui/field';
import { useSession } from '@/features/auth/use-session';
import { catalogApi, reviewsApi } from '@/lib/api/endpoints';
import { useErrorMessage } from '@/lib/errors';
import { qk } from '@/lib/query/keys';
import styles from './reviews.module.css';

function Stars({ value }: { value: number }) {
  return (
    <span className={styles.stars} aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={16} fill={i < value ? 'currentColor' : 'none'} />
      ))}
    </span>
  );
}

function ReviewForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const t = useTranslations('reviews');
  const errorMessage = useErrorMessage();
  const translate = useValidationMessage();
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(createReviewSchema),
    defaultValues: { productId, rating: 5, comment: '' },
  });

  const mutation = useMutation({
    mutationFn: reviewsApi.create,
    onSuccess: () => {
      toast.success(t('sent'));
      void queryClient.invalidateQueries({ queryKey: qk.reviews(productId) });
      onDone();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <form
      className={styles.form}
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
      <Controller
        control={form.control}
        name="rating"
        render={({ field, fieldState }) => (
          <fieldset className={styles.starPicker}>
            <legend className="visually-hidden">{t('rating')}</legend>
            {[1, 2, 3, 4, 5].map((value) => (
              <label key={value} className={styles.starOption}>
                <input
                  type="radio"
                  name={field.name}
                  value={value}
                  checked={field.value === value}
                  onChange={() => field.onChange(value)}
                  aria-label={t('stars', { count: value })}
                />
                <span className={value <= field.value ? styles.starActive : undefined}>
                  <Star size={28} fill="currentColor" aria-hidden />
                </span>
              </label>
            ))}
            {fieldState.error ? (
              <span role="alert">{translate(fieldState.error.message)}</span>
            ) : null}
          </fieldset>
        )}
      />
      <Field label={t('comment')} optional error={form.formState.errors.comment?.message}>
        {(a11y) => <Textarea {...a11y} {...form.register('comment')} maxLength={2000} />}
      </Field>
      <p className={styles.date}>{t('moderationNote')}</p>
      <div>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}

export function ProductReviews({ productId }: { productId: string }) {
  const t = useTranslations('reviews');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const { isAuthenticated } = useSession();
  const [writing, setWriting] = useState(false);

  const reviews = useInfiniteQuery({
    queryKey: qk.reviews(productId),
    queryFn: ({ pageParam }) => catalogApi.reviews(productId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
  const items = reviews.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section className={styles.section} aria-labelledby="reviews-title">
      <div className={styles.header}>
        <h2 id="reviews-title" className={styles.title}>
          {t('title')}
        </h2>
        {isAuthenticated && !writing ? (
          <Button variant="secondary" onClick={() => setWriting(true)}>
            {t('write')}
          </Button>
        ) : null}
        {!isAuthenticated ? <span className={styles.date}>{t('loginToWrite')}</span> : null}
      </div>

      {writing ? <ReviewForm productId={productId} onDone={() => setWriting(false)} /> : null}

      {reviews.isPending ? (
        <div className={styles.list} aria-busy>
          <Skeleton height={110} radius="var(--radius-lg)" />
          <Skeleton height={110} radius="var(--radius-lg)" />
        </div>
      ) : reviews.isError ? (
        <ErrorState
          title={t('loadError')}
          action={<Button onClick={() => void reviews.refetch()}>{tCommon('retry')}</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState icon={MessageSquare} title={t('emptyTitle')} text={t('emptyText')} />
      ) : (
        <>
          <ul className={styles.list}>
            {items.map((r) => (
              <li key={r.id} className={styles.review}>
                <div className={styles.reviewHead}>
                  <span className={styles.author}>{r.authorName}</span>
                  <time className={styles.date} dateTime={r.createdAt}>
                    {format.dateTime(new Date(r.createdAt), { dateStyle: 'medium' })}
                  </time>
                </div>
                <span className="visually-hidden">{t('stars', { count: r.rating })}</span>
                <Stars value={r.rating} />
                {r.comment ? <p>{r.comment}</p> : null}
              </li>
            ))}
          </ul>
          {reviews.hasNextPage ? (
            <div>
              <Button
                onClick={() => void reviews.fetchNextPage()}
                loading={reviews.isFetchingNextPage}
              >
                {t('more')}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
