'use client';

import {
  type AdminProductDto,
  INGREDIENT_ROLES,
  PRODUCT_TAGS,
  type ProductData,
  type ProductInput,
  productInputSchema,
} from '@market/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ProductImage } from '@/components/common/product-image';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Checkbox, Field, Input, Select, useValidationMessage } from '@/components/ui/field';
import { adminApi } from '@/lib/api/endpoints';
import { applyServerFieldErrors, useErrorMessage } from '@/lib/errors';
import { useLocalize } from '@/lib/i18n-utils';
import { qk } from '@/lib/query/keys';
import styles from './admin.module.css';
import { Card, LocalizedInputs, MoneyInput, PageHeader } from './ui';

function toInput(p: AdminProductDto): ProductInput {
  return {
    slug: p.slug,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    basePrice: p.basePrice,
    isConfigurable: p.isConfigurable,
    isAvailable: p.isAvailable,
    tags: p.tags,
    sortOrder: p.sortOrder,
    imageKey: p.imageKey,
    sizes: p.sizes.map((s) => ({
      id: s.id,
      sizeCm: s.sizeCm,
      weightGrams: s.weightGrams,
      priceModifier: s.priceModifier,
      isDefault: s.isDefault,
    })),
    ingredients: p.ingredients.map((i) => ({
      ingredientId: i.ingredient.id,
      role: i.role,
      isRemovable: i.isRemovable,
    })),
    crustIds: p.crusts.map((c) => c.id),
  };
}

const EMPTY: ProductInput = {
  slug: '',
  name: {},
  description: {},
  categoryId: '',
  basePrice: 0,
  isConfigurable: true,
  isAvailable: true,
  tags: [],
  sortOrder: 0,
  imageKey: null,
  sizes: [
    { sizeCm: 25, weightGrams: 450, priceModifier: 0, isDefault: false },
    { sizeCm: 30, weightGrams: 620, priceModifier: 1000, isDefault: true },
    { sizeCm: 35, weightGrams: 850, priceModifier: 2000, isDefault: false },
  ],
  ingredients: [],
  crustIds: [],
};

const optionalNumber = (v: unknown) =>
  v === '' || v === null || v === undefined ? null : Number(v);

export function ProductForm({ product }: { product?: AdminProductDto }) {
  const t = useTranslations('admin.products');
  const tTags = useTranslations('tags');
  const tCommon = useTranslations('common');
  const translate = useValidationMessage();
  const errorMessage = useErrorMessage();
  const localize = useLocalize();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(product?.imageUrl ?? null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const categories = useQuery({ queryKey: qk.admin.categories, queryFn: adminApi.categories });
  const ingredients = useQuery({ queryKey: qk.admin.ingredients, queryFn: adminApi.ingredients });
  const crusts = useQuery({ queryKey: qk.admin.crusts, queryFn: adminApi.crusts });

  const form = useForm<ProductInput, unknown, ProductData>({
    resolver: zodResolver(productInputSchema),
    defaultValues: product ? toInput(product) : EMPTY,
  });
  const sizes = useFieldArray({ control: form.control, name: 'sizes' });
  const productIngredients = useFieldArray({ control: form.control, name: 'ingredients' });
  const errors = form.formState.errors;
  const isConfigurable = form.watch('isConfigurable');

  const save = useMutation({
    mutationFn: (values: ProductData) =>
      product ? adminApi.updateProduct(product.id, values) : adminApi.createProduct(values),
    onSuccess: (saved) => {
      toast.success(t('saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      queryClient.setQueryData(qk.admin.product(saved.id), saved);
      form.reset(toInput(saved));
      if (!product) router.replace(`/admin/products/${saved.id}`);
    },
    onError: (err) => {
      if (
        !applyServerFieldErrors(err, form.setError, [
          'slug',
          'categoryId',
          'basePrice',
          'sizes',
          'ingredients',
          'crustIds',
        ])
      ) {
        toast.error(errorMessage(err));
      }
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) => adminApi.upload('product', file),
    onSuccess: (result) => {
      form.setValue('imageKey', result.key, { shouldDirty: true });
      setImageUrl(result.url);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const archive = useMutation({
    mutationFn: () => adminApi.archiveProduct(product!.id, !product!.isArchived),
    onSuccess: (saved) => {
      queryClient.setQueryData(qk.admin.product(saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      setConfirmArchive(false);
      toast.success(saved.isArchived ? t('archived') : t('restored'));
      router.refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className={styles.form}>
      <PageHeader
        title={product ? localize(product.name) : t('create')}
        actions={
          product ? (
            <Button
              variant={product.isArchived ? 'outline' : 'danger'}
              onClick={() => setConfirmArchive(true)}
            >
              {product.isArchived ? t('restore') : t('archive')}
            </Button>
          ) : undefined
        }
      />
      <div className={styles.formGrid}>
        <div className={styles.form}>
          <Card title={t('basics')}>
            <div className={styles.form}>
              <Controller
                control={form.control}
                name="name"
                render={({ field }) => (
                  <LocalizedInputs
                    label={t('name')}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.name?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="description"
                render={({ field }) => (
                  <LocalizedInputs
                    label={t('description')}
                    value={field.value}
                    onChange={field.onChange}
                    multiline
                  />
                )}
              />
              <div className={`${styles.cols} ${styles.cols2}`}>
                <Field label={t('slug')} hint={t('slugHint')} error={errors.slug?.message}>
                  {(a11y) => <Input {...a11y} {...form.register('slug')} />}
                </Field>
                <Field label={t('category')} error={errors.categoryId?.message}>
                  {(a11y) => (
                    <Select {...a11y} {...form.register('categoryId')}>
                      <option value="">—</option>
                      {categories.data
                        ?.filter((c) => !c.isArchived)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {localize(c.name)}
                          </option>
                        ))}
                    </Select>
                  )}
                </Field>
              </div>
              <div className={`${styles.cols} ${styles.cols2}`}>
                <Controller
                  control={form.control}
                  name="basePrice"
                  render={({ field }) => (
                    <MoneyInput
                      label={t('basePrice')}
                      value={field.value}
                      onChange={(v) => field.onChange(v ?? 0)}
                      error={errors.basePrice?.message}
                    />
                  )}
                />
                <Field label={t('sortOrder')} error={errors.sortOrder?.message}>
                  {(a11y) => (
                    <Input
                      {...a11y}
                      type="number"
                      min={0}
                      {...form.register('sortOrder', { valueAsNumber: true })}
                    />
                  )}
                </Field>
              </div>
              <div className={styles.checkGrid}>
                <Checkbox label={t('isAvailable')} {...form.register('isAvailable')} />
                <Checkbox label={t('isConfigurable')} {...form.register('isConfigurable')} />
              </div>
              <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{t('tags')}</legend>
                <div className={styles.checkGrid}>
                  {PRODUCT_TAGS.map((tag) => (
                    <Checkbox key={tag} label={tTags(tag)} value={tag} {...form.register('tags')} />
                  ))}
                </div>
              </fieldset>
            </div>
          </Card>

          {isConfigurable ? (
            <Card title={t('sizes')}>
              <div className={styles.form}>
                {errors.sizes?.message || errors.sizes?.root?.message ? (
                  <p role="alert" style={{ color: 'var(--color-danger)' }}>
                    {translate(errors.sizes?.message ?? errors.sizes?.root?.message)}
                  </p>
                ) : null}
                {sizes.fields.map((field, index) => (
                  <div key={field.id} className={styles.fieldRow}>
                    <Field label={t('sizeCm')} error={errors.sizes?.[index]?.sizeCm?.message}>
                      {(a11y) => (
                        <Input
                          {...a11y}
                          type="number"
                          {...form.register(`sizes.${index}.sizeCm`, { valueAsNumber: true })}
                        />
                      )}
                    </Field>
                    <Field label={t('weight')} optional>
                      {(a11y) => (
                        <Input
                          {...a11y}
                          type="number"
                          {...form.register(`sizes.${index}.weightGrams`, {
                            setValueAs: optionalNumber,
                          })}
                        />
                      )}
                    </Field>
                    <Controller
                      control={form.control}
                      name={`sizes.${index}.priceModifier`}
                      render={({ field: f }) => (
                        <MoneyInput
                          label={t('priceModifier')}
                          value={f.value}
                          onChange={(v) => f.onChange(v ?? 0)}
                        />
                      )}
                    />
                    <Checkbox label={t('default')} {...form.register(`sizes.${index}.isDefault`)} />
                    <Button
                      variant="ghost"
                      iconOnly
                      size="sm"
                      aria-label={tCommon('remove')}
                      onClick={() => sizes.remove(index)}
                    >
                      <Trash2 size={16} aria-hidden />
                    </Button>
                  </div>
                ))}
                <div>
                  <Button
                    size="sm"
                    onClick={() =>
                      sizes.append({
                        sizeCm: 40,
                        weightGrams: null,
                        priceModifier: 0,
                        isDefault: false,
                      })
                    }
                  >
                    <Plus size={16} aria-hidden /> {t('addSize')}
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

          <Card title={t('ingredients')}>
            <div className={styles.form}>
              {productIngredients.fields.map((field, index) => (
                <div key={field.id} className={styles.fieldRow}>
                  <Field
                    label={t('ingredient')}
                    error={errors.ingredients?.[index]?.ingredientId?.message}
                  >
                    {(a11y) => (
                      <Select {...a11y} {...form.register(`ingredients.${index}.ingredientId`)}>
                        <option value="">—</option>
                        {ingredients.data
                          ?.filter((i) => !i.isArchived)
                          .map((i) => (
                            <option key={i.id} value={i.id}>
                              {localize(i.name)}
                            </option>
                          ))}
                      </Select>
                    )}
                  </Field>
                  <Field label={t('role')}>
                    {(a11y) => (
                      <Select {...a11y} {...form.register(`ingredients.${index}.role`)}>
                        {INGREDIENT_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {t(`roles.${r}`)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Checkbox
                    label={t('removable')}
                    {...form.register(`ingredients.${index}.isRemovable`)}
                  />
                  <Button
                    variant="ghost"
                    iconOnly
                    size="sm"
                    aria-label={tCommon('remove')}
                    onClick={() => productIngredients.remove(index)}
                  >
                    <Trash2 size={16} aria-hidden />
                  </Button>
                </div>
              ))}
              {errors.ingredients?.message ? (
                <p role="alert" style={{ color: 'var(--color-danger)' }}>
                  {translate(errors.ingredients.message)}
                </p>
              ) : null}
              <div>
                <Button
                  size="sm"
                  onClick={() =>
                    productIngredients.append({
                      ingredientId: '',
                      role: 'DEFAULT',
                      isRemovable: true,
                    })
                  }
                >
                  <Plus size={16} aria-hidden /> {t('addIngredient')}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className={styles.form}>
          <Card title={t('image')}>
            <div className={styles.form}>
              <div className={styles.imagePreview}>
                <ProductImage
                  src={imageUrl}
                  alt=""
                  seed={form.watch('slug') || 'new'}
                  sizes="320px"
                />
              </div>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload.mutate(file);
                  e.target.value = '';
                }}
              />
              <Button loading={upload.isPending} onClick={() => fileRef.current?.click()}>
                <ImagePlus size={16} aria-hidden /> {t('uploadImage')}
              </Button>
              {imageUrl ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    form.setValue('imageKey', null, { shouldDirty: true });
                    setImageUrl(null);
                  }}
                >
                  {t('removeImage')}
                </Button>
              ) : null}
              <p className={styles.muted} style={{ fontSize: 'var(--text-xs)' }}>
                {t('imageHint')}
              </p>
            </div>
          </Card>
          {isConfigurable ? (
            <Card title={t('crusts')}>
              <div className={styles.checkGrid} style={{ gridTemplateColumns: '1fr' }}>
                {crusts.data
                  ?.filter((c) => !c.isArchived)
                  .map((c) => (
                    <Checkbox
                      key={c.id}
                      label={localize(c.name)}
                      value={c.id}
                      {...form.register('crustIds')}
                    />
                  ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      <div className={styles.stickyActions}>
        <Button href="/admin/products">{tCommon('cancel')}</Button>
        <Button type="submit" variant="primary" loading={save.isPending}>
          {t('save')}
        </Button>
      </div>

      {product ? (
        <ConfirmDialog
          open={confirmArchive}
          title={product.isArchived ? t('restoreTitle') : t('archiveTitle')}
          description={product.isArchived ? undefined : t('archiveText')}
          confirmLabel={product.isArchived ? t('restore') : t('archive')}
          danger={!product.isArchived}
          loading={archive.isPending}
          onConfirm={() => archive.mutate()}
          onClose={() => setConfirmArchive(false)}
        />
      ) : null}
    </form>
  );
}
