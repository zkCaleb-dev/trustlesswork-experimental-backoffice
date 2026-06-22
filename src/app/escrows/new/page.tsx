'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { CopyId } from '@/components/copy-id';
import { EscrowForm, escrowDeployPath, type EscrowFormSubmit } from '@/components/escrow-form';
import { Shell } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  runEscrowAction,
  waitForEscrowByContract,
  type ConfirmStatus,
  type SendResult,
} from '@/lib/escrow-actions';
import { useSession } from '@/lib/session';
import { useHasMounted } from '@/lib/use-has-mounted';

export default function NewEscrowPage() {
  const mounted = useHasMounted();
  const session = useSession();
  const qc = useQueryClient();

  const [confirm, setConfirm] = useState<ConfirmStatus>('idle');
  const [createdId, setCreatedId] = useState<string | null>(null);

  const deploy = useMutation({
    mutationFn: (payload: EscrowFormSubmit) =>
      runEscrowAction(escrowDeployPath(payload.type), (signer) => ({
        signer,
        ...payload.fields,
      })),
    onSuccess: async (result) => {
      void qc.invalidateQueries({ queryKey: ['escrows'] });
      const target = Number(result.ledger);
      if (!result.contractId || !Number.isFinite(target) || target <= 0) {
        setConfirm('timeout');
        return;
      }
      setConfirm('confirming');
      const found = await waitForEscrowByContract(qc, result.contractId, target);
      if (found) {
        setCreatedId(found.id);
        setConfirm('confirmed');
      } else {
        setConfirm('timeout');
      }
    },
  });

  const authed = session.data?.authenticated ?? false;
  const deployError = deploy.error
    ? deploy.error instanceof Error
      ? deploy.error.message
      : 'Could not create the escrow.'
    : null;

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2 w-fit text-muted-foreground"
        >
          <Link href="/escrows">
            <ArrowLeft className="size-4" />
            All escrows
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New escrow</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a type, then fill its parameters. You sign the deploy with your
            wallet.
          </p>
        </div>

        {!mounted ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Loading…
            </CardContent>
          </Card>
        ) : !authed && !session.isLoading ? (
          <SignInPrompt />
        ) : deploy.data ? (
          <SuccessState result={deploy.data} confirm={confirm} escrowId={createdId} />
        ) : (
          <EscrowForm
            mode="create"
            submitting={deploy.isPending}
            submitLabel="Create escrow"
            submittingLabel="Creating…"
            error={deployError}
            onSubmit={(payload) => deploy.mutate(payload)}
          />
        )}
      </div>
    </Shell>
  );
}

function SuccessState({
  result,
  confirm,
  escrowId,
}: {
  result: SendResult;
  confirm: ConfirmStatus;
  escrowId: string | null;
}) {
  const indexing = confirm === 'idle' || confirm === 'confirming';
  return (
    <Card className="border-success/30 bg-success/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-success">
          <CheckCircle2 className="size-5" />
          Escrow created
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="flex flex-col gap-2 text-sm">
          {result.contractId && (
            <div className="flex items-center gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Contract</dt>
              <dd className="min-w-0">
                <CopyId value={result.contractId} head={8} tail={6} />
              </dd>
            </div>
          )}
          {result.txHash && (
            <div className="flex items-center gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Tx</dt>
              <dd className="min-w-0">
                <CopyId value={result.txHash} head={8} tail={6} />
              </dd>
            </div>
          )}
        </dl>

        {indexing && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Waiting for the indexer to pick it up…
          </p>
        )}
        {confirm === 'confirmed' && (
          <p className="text-xs text-success">Indexed and ready.</p>
        )}
        {confirm === 'timeout' && (
          <p className="text-xs text-muted-foreground">
            It&apos;ll appear in your list shortly — the read-model is fed by the
            indexer.
          </p>
        )}

        {confirm === 'confirmed' && escrowId ? (
          <Button asChild className="w-fit">
            <Link href={`/escrows/${escrowId}`}>
              Open escrow
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button
            asChild
            variant={indexing ? 'outline' : 'default'}
            className="w-fit"
          >
            <Link href="/escrows">
              View escrows
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SignInPrompt() {
  return (
    <div className="rounded-xl border bg-card p-10 text-center shadow-sm">
      <p className="text-sm text-muted-foreground">
        Sign in with your wallet to create an escrow.
      </p>
      <Button asChild className="mt-4">
        <Link href="/login">Sign in</Link>
      </Button>
    </div>
  );
}
