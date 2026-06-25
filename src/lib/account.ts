import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bff, bffPost } from '@/lib/api';
import { connectWallet, signXdr } from '@/lib/wallet/kit';

export interface ApiKey {
  id: string;
  userId: string;
  roles: string[];
  description: string | null;
  active: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedApiKey {
  apiKey: string;
  id: string;
  userId: string;
  roles: string[];
  createdAt: string;
  expiresAt: string | null;
  warning: string;
}

export interface LinkedWallet {
  address: string;
  verified: boolean;
  verifiedAt: string | null;
  createdAt: string;
}

// ── API keys ─────────────────────────────────────────────────────────────────

export function useMyApiKeys() {
  return useQuery({
    queryKey: ['my-api-keys'],
    queryFn: () => bff<ApiKey[]>('/core/users/me/api-keys'),
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { description?: string; platformId?: string }) =>
      bffPost<GeneratedApiKey>('/core/users/me/api-keys', {
        description: input.description?.trim() || undefined,
        platformId: input.platformId || undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-api-keys'] }),
  });
}

export function useRotateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) =>
      bffPost<GeneratedApiKey>(`/core/users/me/api-keys/${keyId}/rotate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-api-keys'] }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) =>
      bff(`/core/users/me/api-keys/${keyId}/revoke`, { method: 'PUT' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-api-keys'] }),
  });
}

// ── Wallets ──────────────────────────────────────────────────────────────────

export function useMyWallets() {
  return useQuery({
    queryKey: ['my-wallets'],
    queryFn: () => bff<LinkedWallet[]>('/core/users/me/wallets'),
  });
}

export function useLinkWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: linkWallet,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-wallets'] }),
  });
}

export function useUnlinkWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (address: string) =>
      bff(`/core/users/me/wallets/${encodeURIComponent(address)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-wallets'] }),
  });
}

interface LinkChallenge {
  xdr: string;
  networkPassphrase: string;
}

/** SEP-10 link: pick a wallet, prove ownership, attach it to the account. */
async function linkWallet(): Promise<void> {
  const address = await connectWallet();
  const challenge = await bffPost<LinkChallenge>('/core/wallets/link/challenge', {
    address,
  });
  const signedXdr = await signXdr(
    challenge.xdr,
    address,
    challenge.networkPassphrase,
  );
  await bffPost('/core/wallets/link/verify', { address, signedXdr });
}
