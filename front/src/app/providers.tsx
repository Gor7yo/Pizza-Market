'use client';

import type { StoreSettingsDto, UserDto } from '@market/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Toaster } from 'sonner';
import { SessionSync } from '@/features/auth/session-sync';
import { ApiError } from '@/lib/api/errors';
import { qk } from '@/lib/query/keys';
import { StoreProvider } from '@/stores/root-store';

function createQueryClient(
  initialUser: UserDto | null,
  settings: StoreSettingsDto | null,
): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // client errors (4xx) are not retried - they will not fix themselves
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      },
      mutations: { retry: false },
    },
  });
  client.setQueryData(qk.me, initialUser);
  if (settings) client.setQueryData(qk.settings, settings);
  return client;
}

export function Providers({
  children,
  initialUser,
  settings,
}: {
  children: ReactNode;
  initialUser: UserDto | null;
  settings: StoreSettingsDto | null;
}) {
  const [queryClient] = useState(() => createQueryClient(initialUser, settings));

  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <SessionSync />
        {children}
        <Toaster position="top-center" richColors closeButton duration={3500} />
      </StoreProvider>
    </QueryClientProvider>
  );
}
