import { useMutation, useQueryClient } from '@tanstack/react-query';

import { bffPost } from '@/lib/api';
import { publicEnv } from '@/lib/public-env';
import { ensureWallet, signXdr } from '@/lib/wallet/kit';

interface UnsignedTx {
  unsignedXdr: string;
  txHash: string;
}

export interface SendResult {
  kind?: string;
  txHash?: string;
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

/** Mutation that runs an escrow action and refreshes the escrow on success. */
export function useEscrowAction(escrowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: EscrowActionVars) =>
      runEscrowAction(vars.buildPath, vars.bodyFor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['escrow', escrowId] });
      void qc.invalidateQueries({ queryKey: ['escrows'] });
    },
  });
}
