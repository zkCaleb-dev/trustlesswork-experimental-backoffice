import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bff } from '@/lib/api';

export interface SessionUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface SessionState {
  authenticated: boolean;
  user?: SessionUser;
  /** The account's primary wallet address, for display. */
  wallet?: string | null;
}

/** Reactive auth state, resolved server-side from the httpOnly cookie. */
export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => bff<SessionState>('/auth/session'),
  });
}

/** Logs out (clears the cookie) and refreshes session-derived queries. */
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => bff<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries(),
  });
}
