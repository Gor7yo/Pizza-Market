'use client';

import type { UserDto } from '@market/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, LayoutDashboard, LogOut, Package, Settings } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { authApi } from '@/lib/api/endpoints';
import { qk } from '@/lib/query/keys';
import styles from './layout.module.css';

/** Disclosure menu: Esc and outside clicks close it, focus returns to the trigger. */
export function UserMenu({ user }: { user: UserDto }) {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const router = useRouter();
  const queryClient = useQueryClient();

  const logout = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      queryClient.setQueryData(qk.me, null);
      queryClient.removeQueries({ queryKey: ['orders'] });
      queryClient.removeQueries({ queryKey: qk.admin.all });
      router.push('/');
      router.refresh();
    },
  });

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className={styles.menu} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.menuItem}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t('account')}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.avatar} aria-hidden>
          {user.avatarUrl ? (
            <Image src={user.avatarUrl} alt="" width={32} height={32} unoptimized />
          ) : (
            user.firstName.charAt(0).toUpperCase()
          )}
        </span>
        <span>{user.firstName}</span>
      </button>
      {open ? (
        <div id={menuId} className={styles.menuList}>
          <div className={styles.menuHeader}>{user.email}</div>
          <Link href="/account" className={styles.menuItem} onClick={close}>
            <Settings size={18} aria-hidden /> {t('profile')}
          </Link>
          <Link href="/orders" className={styles.menuItem} onClick={close}>
            <Package size={18} aria-hidden /> {t('orders')}
          </Link>
          <Link href="/favorites" className={styles.menuItem} onClick={close}>
            <Heart size={18} aria-hidden /> {t('favorites')}
          </Link>
          {user.role === 'ADMIN' ? (
            <Link href="/admin" className={styles.menuItem} onClick={close}>
              <LayoutDashboard size={18} aria-hidden /> {t('admin')}
            </Link>
          ) : null}
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut size={18} aria-hidden /> {t('logout')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
