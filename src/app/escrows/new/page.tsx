'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { CopyId } from '@/components/copy-id';
import { Shell } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { runEscrowAction, type SendResult } from '@/lib/escrow-actions';
import { useSession } from '@/lib/session';
import { useHasMounted } from '@/lib/use-has-mounted';
import { cn } from '@/lib/utils';

const G_RE = /^G[A-Z2-7]{55}$/;
const C_RE = /^C[A-Z2-7]{55}$/;
const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
const EXAMPLE_USDC_SAC =
  'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

type EscrowType = 'sr-v1' | 'sr-v2' | 'mr-v1' | 'mr-v2';

const TYPES: {
  value: EscrowType;
  label: string;
  sub: string;
  desc: string;
  path: string;
}[] = [
  {
    value: 'sr-v1',
    label: 'Single-release',
    sub: 'v1',
    desc: 'One payout · single roles',
    path: '/escrow/single-release/v1/deploy',
  },
  {
    value: 'sr-v2',
    label: 'Single-release',
    sub: 'v2',
    desc: 'One payout · role lists + admin',
    path: '/escrow/single-release/v2/deploy',
  },
  {
    value: 'mr-v1',
    label: 'Multi-release',
    sub: 'v1',
    desc: 'Per-milestone payouts · single roles',
    path: '/escrow/multi-release/v1/deploy',
  },
  {
    value: 'mr-v2',
    label: 'Multi-release',
    sub: 'v2',
    desc: 'Per-milestone payouts · role lists + admin',
    path: '/escrow/multi-release/v2/deploy',
  },
];

interface MilestoneInput {
  description: string;
  amount: string;
  receiver: string;
  status: string;
  approvalsTarget: string;
  evidence: string;
}

const emptyMilestone = (): MilestoneInput => ({
  description: '',
  amount: '',
  receiver: '',
  status: 'pending',
  approvalsTarget: '1',
  evidence: '',
});

export default function NewEscrowPage() {
  const mounted = useHasMounted();
  const session = useSession();
  const qc = useQueryClient();
  const myWallet = session.data?.wallet ?? '';

  const [type, setType] = useState<EscrowType>('sr-v2');
  const isV2 = type === 'sr-v2' || type === 'mr-v2';
  const isMulti = type === 'mr-v1' || type === 'mr-v2';
  const isSingle = !isMulti;
  const def = TYPES.find((t) => t.value === type)!;

  const [title, setTitle] = useState('');
  const [engagementId, setEngagementId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [platformFee, setPlatformFee] = useState('0');
  const [receiverMemo, setReceiverMemo] = useState('');

  const [trustlineContractId, setTrustlineContractId] = useState('');
  const [trustlineSymbol, setTrustlineSymbol] = useState('');
  const [trustlineIssuer, setTrustlineIssuer] = useState('');

  const [approvers, setApprovers] = useState<string[]>(['']);
  const [serviceProviders, setServiceProviders] = useState<string[]>(['']);
  const [releaseSigners, setReleaseSigners] = useState<string[]>(['']);
  const [disputeResolvers, setDisputeResolvers] = useState<string[]>(['']);
  const [observers, setObservers] = useState<string[]>([]);
  const [platform, setPlatform] = useState('');
  const [receiver, setReceiver] = useState('');
  const [admin, setAdmin] = useState('');

  const [milestones, setMilestones] = useState<MilestoneInput[]>([
    emptyMilestone(),
  ]);

  const [attempted, setAttempted] = useState(false);

  // Sensible defaults: the creator acts as approver / service provider /
  // release signer / platform (all editable).
  useEffect(() => {
    if (!myWallet) return;
    setApprovers((v) => (v.length === 1 && v[0] === '' ? [myWallet] : v));
    setServiceProviders((v) => (v.length === 1 && v[0] === '' ? [myWallet] : v));
    setReleaseSigners((v) => (v.length === 1 && v[0] === '' ? [myWallet] : v));
    setPlatform((v) => v || myWallet);
  }, [myWallet]);

  function applyTemplate() {
    const w = myWallet;
    setTitle('Prueba desde backoffice');
    setEngagementId('ENG-DEMO-01');
    setDescription('Escrow de demostración creado con el template.');
    setPlatformFee('0');
    setReceiverMemo('0');
    setTrustlineContractId(EXAMPLE_USDC_SAC);
    setTrustlineSymbol('');
    setTrustlineIssuer('');
    setApprovers([w]);
    setServiceProviders([w]);
    setReleaseSigners([w]);
    setPlatform(w);
    setReceiver(w);
    setObservers([]);
    setAdmin('');
    setDisputeResolvers(['']);
    if (isSingle) setAmount('100');
    setMilestones(
      isMulti
        ? [
            { ...emptyMilestone(), description: 'Milestone 1', amount: '60', receiver: w },
            { ...emptyMilestone(), description: 'Milestone 2', amount: '40', receiver: w },
          ]
        : [
            { ...emptyMilestone(), description: 'Milestone 1' },
            { ...emptyMilestone(), description: 'Milestone 2' },
          ],
    );
    setAttempted(false);
  }

  const errors = collectErrors();

  const deploy = useMutation({
    mutationFn: () => runEscrowAction(def.path, (signer) => buildBody(signer)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['escrows'] }),
  });

  function buildBody(signer: string): Record<string, unknown> {
    const trustline = trustlineContractId.trim()
      ? { contractId: trustlineContractId.trim() }
      : { symbol: trustlineSymbol.trim(), address: trustlineIssuer.trim() };

    const roles = isV2
      ? {
          approvers: clean(approvers),
          serviceProviders: clean(serviceProviders),
          platform: platform.trim(),
          releaseSigners: clean(releaseSigners),
          disputeResolvers: clean(disputeResolvers),
          ...(isSingle ? { receiver: receiver.trim() } : {}),
          admin: admin.trim(),
          observers: clean(observers),
        }
      : {
          approver: (approvers[0] ?? '').trim(),
          serviceProvider: (serviceProviders[0] ?? '').trim(),
          platformAddress: platform.trim(),
          releaseSigner: (releaseSigners[0] ?? '').trim(),
          disputeResolver: (disputeResolvers[0] ?? '').trim(),
          ...(isSingle ? { receiver: receiver.trim() } : {}),
        };

    const ms = milestones
      .filter((m) => m.description.trim())
      .map((m) => {
        const out: Record<string, unknown> = { description: m.description.trim() };
        if (isMulti) {
          out.amount = Number(m.amount);
          out.receiver = m.receiver.trim();
        }
        if (isV2) {
          if (m.status.trim()) out.status = m.status.trim();
          if (m.approvalsTarget.trim())
            out.approvalsTarget = Number(m.approvalsTarget);
        } else if (m.evidence.trim()) {
          out.evidence = m.evidence.trim();
        }
        return out;
      });

    return {
      signer,
      engagementId: engagementId.trim(),
      title: title.trim(),
      description: description.trim(),
      platformFee: Number(platformFee || '0'),
      ...(isSingle ? { amount: Number(amount) } : {}),
      ...(isV2 && receiverMemo.trim()
        ? { receiverMemo: Number(receiverMemo) }
        : {}),
      trustline,
      roles,
      milestones: ms,
    };
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    if (errors.length === 0) deploy.mutate();
  }

  function collectErrors(): string[] {
    const errs: string[] = [];
    if (!title.trim()) errs.push('Title is required.');
    else if (title.trim().length > 100)
      errs.push('Title must be ≤ 100 characters.');
    if (!engagementId.trim()) errs.push('Engagement ID is required.');
    else if (engagementId.trim().length > 100)
      errs.push('Engagement ID must be ≤ 100 characters.');
    if (!description.trim()) errs.push('Description is required.');
    else if (description.trim().length > 500)
      errs.push('Description must be ≤ 500 characters.');

    const fee = Number(platformFee || '0');
    if (!Number.isInteger(fee) || fee < 0 || fee > 99)
      errs.push('Platform fee must be an integer between 0 and 99 (%).');
    if (
      isV2 &&
      receiverMemo.trim() &&
      (!Number.isInteger(Number(receiverMemo)) || Number(receiverMemo) < 0)
    )
      errs.push('Receiver memo must be a non-negative integer.');

    if (isSingle) {
      const amt = Number(amount);
      if (!amount.trim() || !Number.isFinite(amt) || amt <= 0)
        errs.push('Amount must be greater than 0.');
    }

    const cId = trustlineContractId.trim();
    if (cId) {
      if (!C_RE.test(cId)) errs.push('Token contract must be a valid C… address.');
    } else if (trustlineSymbol.trim() && trustlineIssuer.trim()) {
      if (!G_RE.test(trustlineIssuer.trim()))
        errs.push('Asset issuer must be a valid G… address.');
    } else {
      errs.push('Provide a token contract (C…) or an asset code + issuer.');
    }

    // Roles
    const A = clean(approvers);
    const S = clean(serviceProviders);
    const R = clean(releaseSigners);
    const D = clean(disputeResolvers);
    const platformV = platform.trim();
    const receiverV = receiver.trim();
    const adminV = admin.trim();

    if (isV2) {
      const O = clean(observers);
      const checkArr = (name: string, xs: string[], min: number) => {
        if (xs.length < min)
          errs.push(`${name}: at least ${min} address required.`);
        if (xs.length > 5) errs.push(`${name}: at most 5 addresses.`);
        if (xs.some((x) => !G_RE.test(x)))
          errs.push(`${name}: all entries must be valid G… addresses.`);
        if (new Set(xs).size !== xs.length)
          errs.push(`${name}: duplicate addresses.`);
      };
      checkArr('Approvers', A, 1);
      checkArr('Service providers', S, 1);
      checkArr('Release signers', R, 1);
      checkArr('Dispute resolvers', D, 1);
      checkArr('Observers', O, 0);
      for (const [name, v] of [
        ['Platform', platformV],
        ['Admin', adminV],
      ] as const) {
        if (!v) errs.push(`${name} is required.`);
        else if (!G_RE.test(v)) errs.push(`${name} must be a valid G… address.`);
      }
      const workers = new Set([...A, ...S, ...R]);
      if (D.some((d) => workers.has(d)) || (receiverV && D.includes(receiverV)))
        errs.push(
          'Dispute resolver must not be an approver, service provider, release signer, or the receiver.',
        );
      if (
        adminV &&
        (workers.has(adminV) || D.includes(adminV) || adminV === receiverV)
      )
        errs.push(
          'Admin must differ from every other role and the receiver.',
        );
    } else {
      const singles: [string, string][] = [
        ['Approver', A[0] ?? ''],
        ['Service provider', S[0] ?? ''],
        ['Release signer', R[0] ?? ''],
        ['Dispute resolver', D[0] ?? ''],
        ['Platform', platformV],
      ];
      for (const [name, v] of singles) {
        if (!v) errs.push(`${name} is required.`);
        else if (!G_RE.test(v)) errs.push(`${name} must be a valid G… address.`);
      }
    }
    if (isSingle) {
      if (!receiverV) errs.push('Receiver is required.');
      else if (!G_RE.test(receiverV))
        errs.push('Receiver must be a valid G… address.');
    }

    // Milestones
    const ms = milestones.filter((m) => m.description.trim());
    if (!isV2 && ms.length < 1)
      errs.push('At least one milestone is required.');
    if (ms.length > 50) errs.push('At most 50 milestones.');
    ms.forEach((m, i) => {
      const n = i + 1;
      if (m.description.trim().length > 500)
        errs.push(`Milestone ${n}: description must be ≤ 500 characters.`);
      if (isMulti) {
        const a = Number(m.amount);
        if (!m.amount.trim() || !Number.isFinite(a) || a <= 0)
          errs.push(`Milestone ${n}: amount must be greater than 0.`);
        if (!m.receiver.trim() || !G_RE.test(m.receiver.trim()))
          errs.push(`Milestone ${n}: receiver must be a valid G… address.`);
      }
      if (isV2) {
        const t = Number(m.approvalsTarget || '1');
        if (!Number.isInteger(t) || t < 1)
          errs.push(`Milestone ${n}: approvals target must be ≥ 1.`);
        else if (t > A.length)
          errs.push(
            `Milestone ${n}: approvals target (${t}) exceeds the number of approvers (${A.length}).`,
          );
      }
    });

    return errs;
  }

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

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New escrow</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a type, then fill its parameters. You sign the deploy with
              your wallet.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={applyTemplate}>
            <Sparkles className="size-4" />
            Use template
          </Button>
        </div>

        {!mounted ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Loading…
            </CardContent>
          </Card>
        ) : !session.data?.authenticated && !session.isLoading ? (
          <SignInPrompt />
        ) : deploy.data ? (
          <SuccessState result={deploy.data} />
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-6">
            <Section title="Escrow type">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setType(t.value);
                      setAttempted(false);
                    }}
                    aria-pressed={type === t.value}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
                      type === t.value
                        ? 'border-primary bg-accent'
                        : 'hover:bg-accent/40',
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {t.label}
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                        {t.sub}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t.desc}
                    </span>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Basics">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Title" hint="Max 100 characters.">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Website redesign"
                  />
                </Field>
                <Field label="Engagement ID" hint="Max 100 characters.">
                  <Input
                    value={engagementId}
                    onChange={(e) => setEngagementId(e.target.value)}
                    placeholder="ENG-2026-01"
                  />
                </Field>
              </div>
              <Field label="Description" hint="Max 500 characters.">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="What this escrow covers"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                {isSingle && (
                  <Field label="Amount" hint="Token units (100 = 100 USDC).">
                    <Input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="100"
                      inputMode="decimal"
                    />
                  </Field>
                )}
                <Field label="Platform fee (%)" hint="Integer, 0–99.">
                  <Input
                    value={platformFee}
                    onChange={(e) => setPlatformFee(e.target.value)}
                    placeholder="0"
                    inputMode="numeric"
                  />
                </Field>
                {isV2 && (
                  <Field label="Receiver memo" hint="Optional (u32). Default 0.">
                    <Input
                      value={receiverMemo}
                      onChange={(e) => setReceiverMemo(e.target.value)}
                      placeholder="0"
                      inputMode="numeric"
                    />
                  </Field>
                )}
              </div>
              {isMulti && (
                <p className="text-xs text-muted-foreground">
                  Multi-release: there&apos;s no single amount — each milestone
                  carries its own amount and receiver below.
                </p>
              )}
            </Section>

            <Section title="Asset">
              <Field
                label="Token contract (C…)"
                hint="The Soroban asset contract (e.g. USDC SAC). Use this OR the code + issuer below."
              >
                <Input
                  value={trustlineContractId}
                  onChange={(e) => setTrustlineContractId(e.target.value)}
                  placeholder={EXAMPLE_USDC_SAC}
                  className="font-mono text-xs"
                />
              </Field>
              {!trustlineContractId.trim() && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Asset code">
                    <Input
                      value={trustlineSymbol}
                      onChange={(e) => setTrustlineSymbol(e.target.value)}
                      placeholder="USDC"
                    />
                  </Field>
                  <Field label="Issuer (G…)">
                    <Input
                      value={trustlineIssuer}
                      onChange={(e) => setTrustlineIssuer(e.target.value)}
                      placeholder="G…"
                      className="font-mono text-xs"
                    />
                  </Field>
                </div>
              )}
            </Section>

            <Section title="Roles">
              <p className="text-xs text-muted-foreground">
                {isV2
                  ? 'Each role accepts up to 5 distinct wallets. Admin and dispute resolver must differ from every other role (and each other).'
                  : 'One wallet per role. Dispute resolver should differ from the other roles.'}
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <RoleField
                  label="Approvers"
                  isV2={isV2}
                  values={approvers}
                  onChange={setApprovers}
                />
                <RoleField
                  label="Service providers"
                  isV2={isV2}
                  values={serviceProviders}
                  onChange={setServiceProviders}
                />
                <RoleField
                  label="Release signers"
                  isV2={isV2}
                  values={releaseSigners}
                  onChange={setReleaseSigners}
                />
                <RoleField
                  label="Dispute resolvers"
                  hint="≠ the other roles / receiver."
                  isV2={isV2}
                  values={disputeResolvers}
                  onChange={setDisputeResolvers}
                />
                <SingleAddress
                  label="Platform"
                  value={platform}
                  onChange={setPlatform}
                />
                {isSingle && (
                  <SingleAddress
                    label="Receiver"
                    hint="Final beneficiary of the funds."
                    value={receiver}
                    onChange={setReceiver}
                  />
                )}
                {isV2 && (
                  <SingleAddress
                    label="Admin"
                    hint="Must differ from every other role and the receiver."
                    value={admin}
                    onChange={setAdmin}
                  />
                )}
                {isV2 && (
                  <AddressList
                    label="Observers (optional)"
                    values={observers}
                    onChange={setObservers}
                    min={0}
                  />
                )}
              </div>
              {isMulti && (
                <p className="text-xs text-muted-foreground">
                  Multi-release has no escrow-level receiver — the receiver is
                  set per milestone.
                </p>
              )}
            </Section>

            <Section
              title={`Milestones${isV2 ? ' (optional)' : ''}`}
            >
              <div className="flex flex-col gap-3">
                {milestones.map((m, i) => (
                  <MilestoneRow
                    key={i}
                    index={i}
                    m={m}
                    isV2={isV2}
                    isMulti={isMulti}
                    canRemove={milestones.length > 1}
                    onChange={(patch) =>
                      setMilestones((ms) =>
                        ms.map((x, j) => (j === i ? { ...x, ...patch } : x)),
                      )
                    }
                    onRemove={() =>
                      setMilestones((ms) => ms.filter((_, j) => j !== i))
                    }
                  />
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit text-muted-foreground"
                  onClick={() =>
                    setMilestones((ms) => [...ms, emptyMilestone()])
                  }
                >
                  <Plus className="size-4" />
                  Add milestone
                </Button>
              </div>
            </Section>

            {attempted && errors.length > 0 && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <TriangleAlert className="size-4" />
                    Fix {errors.length} {errors.length === 1 ? 'issue' : 'issues'}{' '}
                    before deploying
                  </div>
                  <ul className="list-disc pl-5 text-xs text-destructive">
                    {errors.map((er, i) => (
                      <li key={i}>{er}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={deploy.isPending}>
                {deploy.isPending ? 'Creating…' : 'Create escrow'}
              </Button>
              {deploy.isPending && (
                <span className="text-xs text-muted-foreground">
                  Approve the transaction in your wallet…
                </span>
              )}
            </div>

            {deploy.error && (
              <p className="text-sm text-destructive">
                {deploy.error instanceof Error
                  ? deploy.error.message
                  : 'Could not create the escrow.'}
              </p>
            )}
          </form>
        )}
      </div>
    </Shell>
  );
}

function MilestoneRow({
  index,
  m,
  isV2,
  isMulti,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  m: MilestoneInput;
  isV2: boolean;
  isMulti: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<MilestoneInput>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Label className="mb-1.5 text-xs text-muted-foreground">
            Description
          </Label>
          <Input
            value={m.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={`Milestone ${index + 1}`}
          />
        </div>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove milestone"
            className="mt-6"
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {isMulti && (
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Amount</Label>
            <Input
              value={m.amount}
              inputMode="decimal"
              placeholder="100"
              onChange={(e) => onChange({ amount: e.target.value })}
            />
          </div>
        )}
        {isMulti && (
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">
              Receiver (G…)
            </Label>
            <Input
              value={m.receiver}
              placeholder="G…"
              className="font-mono text-xs"
              onChange={(e) => onChange({ receiver: e.target.value })}
            />
          </div>
        )}
        {isV2 && (
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Status</Label>
            <Input
              value={m.status}
              placeholder="pending"
              onChange={(e) => onChange({ status: e.target.value })}
            />
          </div>
        )}
        {isV2 && (
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">
              Approvals target
            </Label>
            <Input
              value={m.approvalsTarget}
              inputMode="numeric"
              placeholder="1"
              onChange={(e) => onChange({ approvalsTarget: e.target.value })}
            />
          </div>
        )}
        {!isV2 && (
          <div className="sm:col-span-2">
            <Label className="mb-1.5 text-xs text-muted-foreground">
              Evidence (optional)
            </Label>
            <Input
              value={m.evidence}
              placeholder="URL / IPFS hash"
              onChange={(e) => onChange({ evidence: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function RoleField({
  label,
  hint,
  isV2,
  values,
  onChange,
}: {
  label: string;
  hint?: string;
  isV2: boolean;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  if (isV2) {
    return (
      <AddressList label={label} hint={hint} values={values} onChange={onChange} />
    );
  }
  return (
    <SingleAddress
      label={label}
      hint={hint}
      value={values[0] ?? ''}
      onChange={(v) => onChange([v])}
    />
  );
}

function AddressList({
  label,
  hint,
  values,
  onChange,
  min = 1,
  max = 5,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (v: string[]) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-col gap-2">
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={v}
              onChange={(e) =>
                onChange(values.map((x, j) => (j === i ? e.target.value : x)))
              }
              placeholder="G…"
              className="font-mono text-xs"
            />
            {values.length > min && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove"
                onClick={() => onChange(values.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {values.length < max && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit text-muted-foreground"
          onClick={() => onChange([...values, ''])}
        >
          <Plus className="size-4" />
          Add
        </Button>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SingleAddress({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="G…"
        className="font-mono text-xs"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SuccessState({ result }: { result: SendResult }) {
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
        <p className="text-xs text-muted-foreground">
          It&apos;ll appear in your list shortly — the read-model is fed by the
          indexer.
        </p>
        <Button asChild className="w-fit">
          <Link href="/escrows">
            View escrows
            <ArrowRight className="size-4" />
          </Link>
        </Button>
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
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
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
