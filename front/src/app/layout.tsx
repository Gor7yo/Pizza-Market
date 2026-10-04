import type { StoreSettingsDto, UserDto } from '@market/shared';
import type { Metadata, Viewport } from 'next';
import { Manrope, Noto_Sans_Armenian, Unbounded } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { serverApiOptional } from '@/lib/api/server';
import { BRAND_NAME, SITE_URL } from '@/lib/env';
import './globals.css';
import { Providers } from './providers';

const sans = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-sans', display: 'swap' });
const display = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '700'],
  variable: '--font-display',
  display: 'swap',
});
const armenian = Noto_Sans_Armenian({
  subsets: ['armenian'],
  variable: '--font-armenian',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${BRAND_NAME} — ${t('tagline')}`, template: `%s · ${BRAND_NAME}` },
    description: t('description'),
    applicationName: BRAND_NAME,
    openGraph: {
      type: 'website',
      siteName: BRAND_NAME,
      title: BRAND_NAME,
      description: t('description'),
    },
    twitter: { card: 'summary_large_image' },
    alternates: { canonical: '/' },
  };
}

export const viewport: Viewport = {
  themeColor: '#faf7f2',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

async function loadInitialState(): Promise<{
  user: UserDto | null;
  settings: StoreSettingsDto | null;
}> {
  const hasSession = (await cookies()).has('access_token');
  const [user, settings] = await Promise.all([
    hasSession
      ? serverApiOptional<UserDto>('/auth/me', { auth: true }).catch(() => null)
      : Promise.resolve(null),
    serverApiOptional<StoreSettingsDto>('/settings', { revalidate: 60 }).catch(() => null),
  ]);
  return { user, settings };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const { user, settings } = await loadInitialState();

  return (
    <html
      lang={locale}
      className={`${sans.variable} ${display.variable} ${armenian.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        <NextIntlClientProvider>
          <Providers initialUser={user} settings={settings}>
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
