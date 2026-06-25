import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bff, bffPost } from '@/lib/api';

export interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  emailVerified: boolean;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

/** The account-level roles an operator can grant. */
export const ALL_ROLES = ['ADMIN', 'BACKOFFICE_ADMIN', 'ESCROW_MANAGER'] as const;

export function useUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: () => bff<AdminUser[]>('/core/admin/users'),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      bffPost<AdminUser>('/core/admin/users', {
        email: email.trim() || undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export function useSetUserRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: string[] }) =>
      bff<AdminUser>(`/core/admin/users/${userId}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      bff<AdminUser>(`/core/admin/users/${userId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}
