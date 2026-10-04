'use client';

import type { AddressInput, Locale } from '@market/shared';
import { Crosshair, MapPin } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { Field, Input, Textarea } from '@/components/ui/field';
import { geoApi } from '@/lib/api/endpoints';
import styles from './checkout.module.css';
import type { LatLng } from './map/leaflet-map';

const LeafletMap = dynamic(() => import('./map/leaflet-map'), {
  ssr: false,
  loading: () => <Skeleton height="100%" radius={0} />,
});

type WithAddress = { address?: AddressInput };

/**
 * Address fields + map. Used inside parent forms (checkout, account) under the `address` key,
 * so validation stays in one schema (shared addressSchema).
 */
export function AddressFields<T extends WithAddress>({
  register,
  errors,
  setValue,
  watch,
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  setValue: UseFormSetValue<T>;
  watch: UseFormWatch<T>;
}) {
  const t = useTranslations('address');
  const locale = useLocale() as Locale;
  const [locating, setLocating] = useState(false);
  // react-hook-form generics are path-typed; the parent guarantees an `address` object
  const reg = register as unknown as UseFormRegister<WithAddress>;
  const set = setValue as unknown as UseFormSetValue<WithAddress>;
  const w = watch as unknown as UseFormWatch<WithAddress>;
  const e = (errors as FieldErrors<WithAddress>).address;

  const lat = w('address.latitude');
  const lng = w('address.longitude');
  const point: LatLng | null =
    typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;

  const onPick = async (p: LatLng) => {
    set('address.latitude', p.lat, { shouldDirty: true });
    set('address.longitude', p.lng, { shouldDirty: true });
    try {
      const result = await geoApi.reverse(p.lat, p.lng, locale);
      if (result?.city)
        set('address.city', result.city, { shouldValidate: true, shouldDirty: true });
      if (result?.street)
        set('address.street', result.street, { shouldValidate: true, shouldDirty: true });
    } catch {
      // geocoding is a convenience: the user can still type the address
    }
  };

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        void onPick({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        toast.error(t('locateError'));
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <div className={styles.addressGrid}>
      <div className={styles.map}>
        <LeafletMap value={point} onChange={(p) => void onPick(p)} label={t('mapLabel')} />
      </div>
      <div className={styles.mapActions}>
        <span className={styles.hint}>
          <MapPin size={16} aria-hidden /> {t('mapHint')}
        </span>
        <Button size="sm" onClick={locate} loading={locating}>
          <Crosshair size={16} aria-hidden /> {t('locate')}
        </Button>
      </div>
      <input type="hidden" {...reg('address.country')} />
      <div className={styles.twoCols}>
        <Field label={t('city')} error={e?.city?.message}>
          {(a11y) => <Input {...a11y} autoComplete="address-level2" {...reg('address.city')} />}
        </Field>
        <Field label={t('street')} error={e?.street?.message}>
          {(a11y) => <Input {...a11y} autoComplete="street-address" {...reg('address.street')} />}
        </Field>
      </div>
      <div className={styles.fourCols}>
        <Field label={t('apartment')} optional error={e?.apartment?.message}>
          {(a11y) => <Input {...a11y} {...reg('address.apartment')} />}
        </Field>
        <Field label={t('entrance')} optional error={e?.entrance?.message}>
          {(a11y) => <Input {...a11y} {...reg('address.entrance')} />}
        </Field>
        <Field label={t('floor')} optional error={e?.floor?.message}>
          {(a11y) => <Input {...a11y} {...reg('address.floor')} />}
        </Field>
        <Field label={t('intercom')} optional error={e?.intercom?.message}>
          {(a11y) => <Input {...a11y} {...reg('address.intercom')} />}
        </Field>
      </div>
      <Field label={t('instructions')} optional error={e?.instructions?.message}>
        {(a11y) => <Textarea {...a11y} rows={2} {...reg('address.instructions')} />}
      </Field>
    </div>
  );
}

export const EMPTY_ADDRESS: AddressInput = {
  label: '',
  country: 'AM',
  city: 'Yerevan',
  street: '',
  apartment: '',
  entrance: '',
  floor: '',
  intercom: '',
  instructions: '',
  latitude: null,
  longitude: null,
};
