'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { Shell } from '@/components/shell';
import { runEscrowAction, type SendResult } from '@/lib/escrow-actions';
import { truncateMiddle } from '@/lib/format';
import { useHasMounted } from '@/lib/use-has-mounted';
import { useSession } from '@/lib/session';

export default function NewEscrowPage() {
  const mounted = useHasMounted();
  const session = useSession();
  const qc = useQueryClient();
  const myWallet = session.data?.wallet ?? '';

  const [title, setTitle] = useState('');
  const [engagementId, setEngagementId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [platformFee, setPlatformFee] = useState('0');
  const [trustline, setTrustline] = useState('');
  const [receiver, setReceiver] = useState('');
  const [admin, setAdmin] = useState('');
  const [disputeResolver, setDisputeResolver] = useState('');
  const [milestones, setMilestones] = useState<string[]>(['']);

  // Prefill the receiver with the signed-in wallet (editable).
  useEffect(() => {
    if (myWallet) setReceiver((r) => r || myWallet);
  }, [myWallet]);

  const deploy = useMutation({
    mutationFn: () =>
      runEscrowAction('/escrow/single-release/v2/deploy', (signer) => ({
        signer,
        engagementId: engagementId.trim(),
        title: title.trim(),
        description: description.trim(),
        amount: Number(amount),
        platformFee: Number(platformFee),
        trustline: { contractId: trustline.trim() },
        roles: {
          approvers: [signer],
          serviceProviders: [signer],
          platform: signer,
          releaseSigners: [signer],
          disputeResolvers: [disputeResolver.trim()],
          receiver: (receiver.trim() || signer).trim(),
          admin: admin.trim(),
        },
        milestones: milestones
          .map((m) => m.trim())
          .filter(Boolean)
          .map((d) => ({ description: d })),
      })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['escrows'] }),
  });

  const canSubmit =
    title.trim() !== '' &&
    engagementId.trim() !== '' &&
    description.trim() !== '' &&
    Number(amount) > 0 &&
    trustline.trim() !== '' &&
    admin.trim() !== '' &&
    disputeResolver.trim() !== '';

  return (
    <Shell>
      <Link href="/escrows" className="text-sm text-neutral-500 hover:underline">
        ← All escrows
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">New escrow</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Single-release v2. You sign the deploy with your wallet.
      </p>

      {!mounted ? (
        <p className="mt-6 text-sm text-neutral-500">Loading…</p>
      ) : !session.data?.authenticated && !session.isLoading ? (
        <SignInPrompt />
      ) : deploy.data ? (
        <SuccessState result={deploy.data} />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) deploy.mutate();
          }}
          className="mt-6 flex flex-col gap-5"
        >
          <Section title="Basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title">
                <Input value={title} onChange={setTitle} placeholder="Website redesign" />
              </Field>
              <Field label="Engagement ID">
                <Input value={engagementId} onChange={setEngagementId} placeholder="ENG-2026-01" />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What this escrow covers"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount">
                <Input value={amount} onChange={setAmount} placeholder="1000" inputMode="decimal" />
              </Field>
              <Field label="Platform fee (%)">
                <Input value={platformFee} onChange={setPlatformFee} placeholder="0" inputMode="numeric" />
              </Field>
            </div>
          </Section>

          <Section title="Asset">
            <Field
              label="Token contract (C…)"
              hint="The Soroban asset contract used to fund the escrow (e.g. USDC SAC)."
            >
              <Input
                value={trustline}
                onChange={setTrustline}
                placeholder="CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
                mono
              />
            </Field>
          </Section>

          <Section title="Roles">
            <p className="mb-3 text-xs text-neutral-500">
              Your wallet is set as approver, service provider, release signer and
              platform. The contract requires the <strong>admin</strong> and{' '}
              <strong>dispute resolver</strong> to be different from every other
              role (and from each other).
            </p>
            <div className="flex flex-col gap-4">
              <Field label="Receiver (G…)" hint="Who receives the funds on release.">
                <Input value={receiver} onChange={setReceiver} placeholder="G…" mono />
              </Field>
              <Field label="Admin (G…)" hint="Must differ from every other role.">
                <Input value={admin} onChange={setAdmin} placeholder="G…" mono />
              </Field>
              <Field
                label="Dispute resolver (G…)"
                hint="Must differ from every other role and the admin."
              >
                <Input
                  value={disputeResolver}
                  onChange={setDisputeResolver}
                  placeholder="G…"
                  mono
                />
              </Field>
            </div>
          </Section>

          <Section title="Milestones (optional)">
            <div className="flex flex-col gap-2">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={m}
                    onChange={(v) =>
                      setMilestones((ms) => ms.map((x, j) => (j === i ? v : x)))
                    }
                    placeholder={`Milestone ${i + 1}`}
                  />
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setMilestones((ms) => ms.filter((_, j) => j !== i))
                      }
                      className="rounded-md border border-neutral-300 px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setMilestones((ms) => [...ms, ''])}
                className="w-fit text-sm text-neutral-500 hover:underline"
              >
                + Add milestone
              </button>
            </div>
          </Section>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit || deploy.isPending}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {deploy.isPending ? 'Creating…' : 'Create escrow'}
            </button>
            {deploy.isPending && (
              <span className="text-xs text-neutral-500">
                Approve the transaction in your wallet…
              </span>
            )}
          </div>

          {deploy.error && (
            <p className="text-sm text-red-600">
              {deploy.error instanceof Error
                ? deploy.error.message
                : 'Could not create the escrow.'}
            </p>
          )}
        </form>
      )}
    </Shell>
  );
}

function SuccessState({ result }: { result: SendResult }) {
  return (
    <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-6">
      <p className="text-sm font-medium text-green-800">Escrow created ✓</p>
      <dl className="mt-3 flex flex-col gap-1 text-sm text-green-900">
        {result.contractId && (
          <div className="flex gap-2">
            <dt className="text-green-700">Contract</dt>
            <dd className="font-mono" title={result.contractId}>
              {truncateMiddle(result.contractId, 8, 6)}
            </dd>
          </div>
        )}
        {result.txHash && (
          <div className="flex gap-2">
            <dt className="text-green-700">Tx</dt>
            <dd className="font-mono" title={result.txHash}>
              {truncateMiddle(result.txHash, 8, 6)}
            </dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-xs text-green-700">
        It&apos;ll appear in your list shortly — the read-model is fed by the
        indexer.
      </p>
      <Link
        href="/escrows"
        className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        View escrows
      </Link>
    </div>
  );
}

function SignInPrompt() {
  return (
    <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-10 text-center">
      <p className="text-sm text-neutral-600">
        Sign in with your wallet to create an escrow.
      </p>
      <Link
        href="/login"
        className="mt-3 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        Sign in
      </Link>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-medium text-neutral-700">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      {children}
      {hint && <span className="text-xs text-neutral-400">{hint}</span>}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  mono,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  inputMode?: 'decimal' | 'numeric';
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className={`w-full rounded-md border border-neutral-300 px-3 py-2 text-sm ${
        mono ? 'font-mono text-xs' : ''
      }`}
    />
  );
}
