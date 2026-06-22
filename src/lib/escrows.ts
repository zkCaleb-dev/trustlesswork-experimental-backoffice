import { useQuery } from '@tanstack/react-query';

import { bff } from '@/lib/api';

/** One row of `GET /escrows` (lean — no snapshot). */
export interface EscrowSummary {
  id: string;
  network: string;
  contractId: string;
  contractType: string | null;
  engagementId: string | null;
  status: string | null;
  totalAmount: string | null;
  asset: string | null;
  lastLedgerSeq: string;
  createdAt: string;
  updatedAt: string;
}

/** Full escrow state (detail) — summary + raw snapshot + authorship. */
export interface EscrowState extends EscrowSummary {
  snapshot: Record<string, unknown> | null;
  createdByUserId: string | null;
  creatorAddress: string | null;
}

export interface EscrowParticipant {
  address: string;
  role: string;
  milestoneIndex: number;
}

export interface EscrowEvent {
  id: string;
  kind: string;
  actor: string | null;
  ledgerSeq: string;
  txHash: string | null;
  ledgerClosedAt: string;
  data: unknown;
}

export interface EscrowDeposit {
  id: string;
  fromAddress: string;
  asset: string;
  amount: string;
  txHash: string | null;
  ledgerSeq: string;
  ledgerClosedAt: string;
}

/** Response of `GET /escrows/:escrowId`. */
export interface EscrowDetail {
  escrow: EscrowState;
  participants: EscrowParticipant[];
  events: EscrowEvent[];
  deposits: EscrowDeposit[];
}

export interface EscrowFilters {
  status?: string;
  contractType?: string;
  engagementId?: string;
  limit?: number;
  offset?: number;
}

function buildQuery(filters: EscrowFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * The escrows the signed-in account can see (participation via verified wallets
 * ∪ grants), resolved server-side by the core. The read-model is indexer-fed
 * and eventually consistent, so a freshly-created escrow appears shortly after.
 */
/** Fetches the signed-in account's escrows from the BFF. */
export function fetchEscrows(
  filters: EscrowFilters = {},
): Promise<EscrowSummary[]> {
  return bff<EscrowSummary[]>(`/core/escrows${buildQuery(filters)}`);
}

export function useEscrows(filters: EscrowFilters = {}) {
  return useQuery({
    queryKey: ['escrows', filters],
    queryFn: () => fetchEscrows(filters),
  });
}

/** Fetches one escrow in full from the BFF. Throws on 404 / non-2xx. */
export function fetchEscrowDetail(id: string): Promise<EscrowDetail> {
  return bff<EscrowDetail>(`/core/escrows/${encodeURIComponent(id)}`);
}

/** One escrow in full. 404 (thrown) means "not found or not in your access set". */
export function useEscrow(id: string) {
  return useQuery({
    queryKey: ['escrow', id],
    queryFn: () => fetchEscrowDetail(id),
    enabled: id.length > 0,
  });
}
