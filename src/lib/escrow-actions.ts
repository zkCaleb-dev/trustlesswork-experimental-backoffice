import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useState } from 'react';

import { bffPost } from '@/lib/api';
import { fetchEscrowDetail, fetchEscrows, type EscrowSummary } from '@/lib/escrows';
import { publicEnv } from '@/lib/public-env';
import { ensureWallet, signXdr } from '@/lib/wallet/kit';

interface UnsignedTx {
  unsignedXdr: string;
  txHash: string;
}

export interface SendResult {
  kind?: string;
  txHash?: string;
  /** Ledger sequence the tx landed in — always present on a submit. */
  ledger?: number;
  contractId?: string;
}

/**
 * Build → sign → send. The core builds an unsigned XDR for `buildPath`, the
 * connected wallet signs it, and the signed XDR is broadcast via
 * `/stellar/send-transaction`. `bodyFor(signer)` injects the connected wallet
 * as the signer, so the transaction is signed by the same address it names.
 * Everything flows through the same-origin BFF proxy (`/api/core/*`).
 */
export async function runEscrowAction(
  buildPath: string,
  bodyFor: (signer: string) => Record<string, unknown>,
): Promise<SendResult> {
  const signer = await ensureWallet();
  const built = await bffPost<UnsignedTx>(`/core${buildPath}`, bodyFor(signer));
  const signedXdr = await signXdr(
    built.unsignedXdr,
    signer,
    publicEnv.networkPassphrase,
  );
  return bffPost<SendResult>('/core/stellar/send-transaction', { signedXdr });
}

export interface EscrowActionVars {
  buildPath: string;
  bodyFor: (signer: string) => Record<string, unknown>;
}

/** Confirmation phase after the tx is broadcast on-chain. */
export type ConfirmStatus = 'idle' | 'confirming' | 'confirmed' | 'timeout';

const CONFIRM_TIMEOUT_MS = 60_000;
const CONFIRM_INTERVAL_MS = 2_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for the read-model to catch up to `targetLedger` — the ledger the tx
 * landed in. The read-model is indexer-fed and eventually consistent, so a read
 * taken right after a write is stale; we poll `GET /escrows/:id` until its
 * `lastLedgerSeq` reaches the tx's ledger (or we hit the timeout). Each poll
 * writes through the `['escrow', id]` cache, so an open detail page updates
 * live as the new state lands. Resolves `true` on catch-up, `false` on timeout.
 */
async function waitForEscrowLedger(
  qc: QueryClient,
  escrowId: string,
  targetLedger: number,
): Promise<boolean> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const detail = await qc.fetchQuery({
        queryKey: ['escrow', escrowId],
        queryFn: () => fetchEscrowDetail(escrowId),
      });
      if (Number(detail.escrow.lastLedgerSeq) >= targetLedger) return true;
    } catch {
      // Transient (network blip, or a brief 404 before the row exists) — the
      // deadline bounds how long we keep retrying.
    }
    await sleep(CONFIRM_INTERVAL_MS);
  }
  return false;
}

/**
 * Wait for a freshly-deployed escrow to show up in the read-model. A deploy
 * returns a `contractId` immediately, but the read-model row (with its own id)
 * only exists once the indexer projects the `tw_init`. We poll the account's
 * escrow list until a row with this `contractId` appears and has caught up to
 * the deploy ledger (so its snapshot is populated, not a bare shell). Returns
 * the summary row on success, `null` on timeout. Each poll warms the
 * `['escrows', {}]` cache the list page reads.
 */
export async function waitForEscrowByContract(
  qc: QueryClient,
  contractId: string,
  targetLedger: number,
): Promise<EscrowSummary | null> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const list = await qc.fetchQuery({
        queryKey: ['escrows', {}],
        queryFn: () => fetchEscrows(),
      });
      const found = list.find(
        (e) =>
          e.contractId === contractId &&
          Number(e.lastLedgerSeq) >= targetLedger,
      );
      if (found) return found;
    } catch {
      // Transient — the deadline bounds how long we keep retrying.
    }
    await sleep(CONFIRM_INTERVAL_MS);
  }
  return null;
}

/**
 * Runs an escrow action, then waits for the read-model to reflect it before
 * reporting success — so the UI never says "done" while the detail still shows
 * pre-action state.
 *
 * Phases: `isSubmitting` (build → sign → send) → `isConfirming` (waiting for the
 * indexer to project the new state) → `confirm` settles to `confirmed` or
 * `timeout`. The detail query stays fresh via the poll; the list is invalidated
 * once on settle.
 */
export function useEscrowAction(escrowId: string) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<ConfirmStatus>('idle');

  const mutation = useMutation({
    mutationFn: (vars: EscrowActionVars) =>
      runEscrowAction(vars.buildPath, vars.bodyFor),
    onMutate: () => setConfirm('idle'),
    onSuccess: async (result) => {
      const target = Number(result.ledger);
      if (Number.isFinite(target) && target > 0) {
        setConfirm('confirming');
        const reflected = await waitForEscrowLedger(qc, escrowId, target);
        void qc.invalidateQueries({ queryKey: ['escrows'] });
        setConfirm(reflected ? 'confirmed' : 'timeout');
        return;
      }
      // No ledger in the response — fall back to a plain refresh.
      await qc.invalidateQueries({ queryKey: ['escrow', escrowId] });
      void qc.invalidateQueries({ queryKey: ['escrows'] });
      setConfirm('confirmed');
    },
  });

  return {
    run: mutation.mutate,
    reset: () => {
      mutation.reset();
      setConfirm('idle');
    },
    isSubmitting: mutation.isPending,
    isConfirming: confirm === 'confirming',
    confirm,
    error: mutation.error,
    data: mutation.data,
  };
}
