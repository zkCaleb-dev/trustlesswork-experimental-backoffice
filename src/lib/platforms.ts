import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bff, bffPost } from '@/lib/api';

/** A platform (tenant): owns API keys + the subjects it serves. */
export interface Platform {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

/** A subject (the platform's end-user). */
export interface Subject {
  id: string;
  platformId: string;
  walletAddress: string | null;
  externalId: string | null;
  label: string | null;
  metadata: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

// ── Platforms ────────────────────────────────────────────────────────────────

export function useMyPlatforms() {
  return useQuery({
    queryKey: ['my-platforms'],
    queryFn: () => bff<Platform[]>('/core/users/me/platforms'),
  });
}

export function useCreatePlatform() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      bffPost<Platform>('/core/platforms', { name: name.trim() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-platforms'] }),
  });
}

// ── Subjects (nested under a platform) ────────────────────────────────────────

export function useSubjects(platformId: string) {
  return useQuery({
    queryKey: ['subjects', platformId],
    queryFn: () => bff<Subject[]>(`/core/platforms/${platformId}/subjects`),
    enabled: Boolean(platformId),
  });
}

export interface NewSubject {
  externalId?: string;
  walletAddress?: string;
  label?: string;
}

export function useCreateSubject(platformId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewSubject) =>
      bffPost<Subject>(`/core/platforms/${platformId}/subjects`, {
        externalId: input.externalId?.trim() || undefined,
        walletAddress: input.walletAddress?.trim() || undefined,
        label: input.label?.trim() || undefined,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['subjects', platformId] }),
  });
}
