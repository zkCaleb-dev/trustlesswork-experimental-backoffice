'use client';

import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Shell } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deriveEscrowKind } from '@/lib/escrow-action-registry';
import { useEscrowAction } from '@/lib/escrow-actions';
import { useEscrow } from '@/lib/escrows';
import { truncateMiddle } from '@/lib/format';
import { useHasMounted } from '@/lib/use-has-mounted';

interface NewMilestone {
  description: string;
  amount: string;
  receiver: string;
  status: string;
  approvalsTarget: string;
}

interface MilestoneUpdate {
  index: string;
  newDescription: string;
  newAmount: string;
}

const emptyNew = (): NewMilestone => ({
  description: '',
  amount: '',
  receiver: '',
  status: '',
  approvalsTarget: '',
});

const emptyUpdate = (): MilestoneUpdate => ({
  index: '',
  newDescription: '',
  newAmount: '',
});

function countMilestones(snapshot: Record<string, unknown> | null): number {
  const ms = snapshot?.milestones;
  return Array.isArray(ms) ? ms.length : 0;
}

export default function ManageMilestonesPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const mounted = useHasMounted();
  const query = useEscrow(id);
  const action = useEscrowAction(id);

  const escrow = query.data?.escrow;
  const kind = deriveEscrowKind(
    escrow?.contractType ?? null,
    escrow?.snapshot ?? null,
  );
  const multi = kind === 'multi-release-v2';
  const flavor = multi ? 'multi-release' : 'single-release';
  const existing = countMilestones(escrow?.snapshot ?? null);

  const [news, setNews] = useState<NewMilestone[]>([]);
  const [updates, setUpdates] = useState<MilestoneUpdate[]>([]);

  const busy = action.isSubmitting || action.isConfirming;
  const cleanNews = news.filter((m) => m.description.trim() !== '');
  const cleanUpdates = updates.filter((u) => u.index.trim() !== '');
  const ready = cleanNews.length > 0 || cleanUpdates.length > 0;

  const submit = () => {
    if (!escrow) return;
    action.run({
      buildPath: `/escrow/${flavor}/v2/manage-milestones`,
      bodyFor: (signer) => ({
        contractId: escrow.contractId,
        admin: signer,
        newMilestones: cleanNews.map((m) => ({
          description: m.description.trim(),
          ...(multi
            ? { amount: Number(m.amount), receiver: m.receiver.trim() }
            : {}),
          ...(m.status.trim() ? { status: m.status.trim() } : {}),
          ...(m.approvalsTarget.trim()
            ? { approvalsTarget: Number(m.approvalsTarget) }
            : {}),
        })),
        milestoneUpdates: cleanUpdates.map((u) => ({
          index: Number(u.index),
          ...(u.newDescription.trim()
            ? { newDescription: u.newDescription.trim() }
            : {}),
          ...(multi && u.newAmount.trim()
            ? { newAmount: Number(u.newAmount) }
            : {}),
        })),
      }),
    });
  };

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2 w-fit text-muted-foreground"
        >
          <Link href={`/escrows/${id}`}>
            <ArrowLeft className="size-4" />
            Back to escrow
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Manage milestones
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Append new milestones or edit existing ones. Signed by the admin
            wallet. Edits are rejected on-chain while the escrow holds funds.
          </p>
        </div>

        {!mounted || query.isLoading ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Loading…
            </CardContent>
          </Card>
        ) : !escrow || !kind ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              This escrow isn&apos;t available, or its state hasn&apos;t been
              indexed yet.
            </CardContent>
          </Card>
        ) : kind.endsWith('-v1') ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Managing milestones is only supported for v2 escrows.
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {escrow.engagementId ?? 'Escrow'} ·{' '}
              <span className="font-mono">
                {truncateMiddle(escrow.contractId, 8, 6)}
              </span>{' '}
              · {existing} existing milestone{existing === 1 ? '' : 's'} (indexes
              0–{Math.max(existing - 1, 0)})
            </p>

            <Section title="Add milestones">
              {news.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No new milestones to add.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {news.map((m, i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-3 rounded-lg border p-3"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <Label className="mb-1.5 text-xs text-muted-foreground">
                            Description
                          </Label>
                          <Input
                            value={m.description}
                            placeholder={`Milestone ${existing + i}`}
                            onChange={(e) =>
                              setNews((xs) =>
                                xs.map((x, j) =>
                                  j === i
                                    ? { ...x, description: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove milestone"
                          className="mt-6"
                          onClick={() =>
                            setNews((xs) => xs.filter((_, j) => j !== i))
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {multi && (
                          <div>
                            <Label className="mb-1.5 text-xs text-muted-foreground">
                              Amount
                            </Label>
                            <Input
                              value={m.amount}
                              inputMode="decimal"
                              placeholder="100"
                              onChange={(e) =>
                                setNews((xs) =>
                                  xs.map((x, j) =>
                                    j === i
                                      ? { ...x, amount: e.target.value }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </div>
                        )}
                        {multi && (
                          <div>
                            <Label className="mb-1.5 text-xs text-muted-foreground">
                              Receiver (G…)
                            </Label>
                            <Input
                              value={m.receiver}
                              placeholder="G…"
                              className="font-mono text-xs"
                              onChange={(e) =>
                                setNews((xs) =>
                                  xs.map((x, j) =>
                                    j === i
                                      ? { ...x, receiver: e.target.value }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </div>
                        )}
                        <div>
                          <Label className="mb-1.5 text-xs text-muted-foreground">
                            Status (optional)
                          </Label>
                          <Input
                            value={m.status}
                            placeholder="pending"
                            onChange={(e) =>
                              setNews((xs) =>
                                xs.map((x, j) =>
                                  j === i ? { ...x, status: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label className="mb-1.5 text-xs text-muted-foreground">
                            Approvals target (optional)
                          </Label>
                          <Input
                            value={m.approvalsTarget}
                            inputMode="numeric"
                            placeholder="1"
                            onChange={(e) =>
                              setNews((xs) =>
                                xs.map((x, j) =>
                                  j === i
                                    ? { ...x, approvalsTarget: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit text-muted-foreground"
                onClick={() => setNews((xs) => [...xs, emptyNew()])}
              >
                <Plus className="size-4" />
                Add milestone
              </Button>
            </Section>

            <Section title="Edit existing milestones">
              {updates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No edits queued.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {updates.map((u, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-end gap-3 rounded-lg border p-3"
                    >
                      <div className="w-20">
                        <Label className="mb-1.5 text-xs text-muted-foreground">
                          Index
                        </Label>
                        <Input
                          value={u.index}
                          inputMode="numeric"
                          placeholder="0"
                          onChange={(e) =>
                            setUpdates((xs) =>
                              xs.map((x, j) =>
                                j === i ? { ...x, index: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Label className="mb-1.5 text-xs text-muted-foreground">
                          New description (optional)
                        </Label>
                        <Input
                          value={u.newDescription}
                          placeholder="Leave blank to keep current"
                          onChange={(e) =>
                            setUpdates((xs) =>
                              xs.map((x, j) =>
                                j === i
                                  ? { ...x, newDescription: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      </div>
                      {multi && (
                        <div className="w-32">
                          <Label className="mb-1.5 text-xs text-muted-foreground">
                            New amount (opt.)
                          </Label>
                          <Input
                            value={u.newAmount}
                            inputMode="decimal"
                            placeholder="—"
                            onChange={(e) =>
                              setUpdates((xs) =>
                                xs.map((x, j) =>
                                  j === i
                                    ? { ...x, newAmount: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove edit"
                        onClick={() =>
                          setUpdates((xs) => xs.filter((_, j) => j !== i))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit text-muted-foreground"
                onClick={() => setUpdates((xs) => [...xs, emptyUpdate()])}
              >
                <Plus className="size-4" />
                Add edit
              </Button>
            </Section>

            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={busy || !ready} onClick={submit}>
                {busy ? 'Submitting…' : 'Submit changes'}
              </Button>
              {action.isSubmitting && (
                <span className="text-xs text-muted-foreground">
                  Approve the transaction in your wallet…
                </span>
              )}
              {action.isConfirming && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Waiting for the network to reflect it…
                </span>
              )}
              {action.confirm === 'confirmed' && (
                <span className="text-xs text-success">
                  Done ✓ — milestones updated.
                </span>
              )}
              {action.confirm === 'timeout' && (
                <span className="text-xs text-muted-foreground">
                  Submitted — taking longer than usual to appear.
                </span>
              )}
            </div>

            {action.error && (
              <p className="text-sm text-destructive">
                {action.error instanceof Error
                  ? action.error.message
                  : 'The transaction failed.'}
              </p>
            )}
          </>
        )}
      </div>
    </Shell>
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
