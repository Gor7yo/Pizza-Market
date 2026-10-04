'use client';

import type { UserDto } from '@market/shared';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/lib/api/endpoints';
import { isApiError } from '@/lib/api/errors';
import { qk } from '@/lib/query/keys';

async function fetchMe(): Promise<UserDto | null> {
  try {
    return await authApi.me();
  } catch (err) {
    if (isApiError(err) && (err.status === 401 || err.status === 403)) return null;
    throw err;
  }
}

/** Current user as server state (TanStack Query). Seeded by the server layout to avoid flashes. */
export function useSession() {
  const query = useQuery({ queryKey: qk.me, queryFn: fetchMe, staleTime: 5 * 60_000 });
  const user = query.data ?? null;
  return {
    user,
    isAuthenticated: user !== null,
    isAdmin: user?.role === 'ADMIN',
    isLoading: query.isPending,
  };
}
