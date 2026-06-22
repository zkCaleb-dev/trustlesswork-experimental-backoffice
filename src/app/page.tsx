'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  Plus,
  Server,
  Shield,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import type { ComponentType } from 'react';

import { Shell } from '@/components/shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { bff } from '@/lib/api';
import { publicEnv } from '@/lib/public-env';
import { useSession } from '@/lib/session';
import { useHasMounted } from '@/lib/use-has-mounted';
import { cn } from '@/lib/utils';

interface Health {
  bff: string;
  adminEnabled: boolean;
  core: { reachable: boolean; status: string; httpStatus: number };
}

export default function HomePage() {
  const mounted = useHasMounted();
  const session = useSession();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => bff<Health>('/health'),
  });

  const authed = session.data?.authenticated ?? false;
  const user = session.data?.user;
  const wallet = session.data?.wallet;
  const who = wallet
    ? formatAddress(wallet)
    : (user?.email ?? (user ? `user #${user.id}` : null));

  const healthLoading = !mounted || health.isLoading;
  const sessionLoading = !mounted || session.isLoading;

  return (
    <Shell>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {publicEnv.appName} ·{' '}
            <span className="capitalize">{publicEnv.stellarNetwork}</span>{' '}
            network
          </p>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            System status
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              icon={Activity}
              tone="blue"
              label="BFF"
              loading={healthLoading}
              ok={health.data?.bff === 'ok'}
              value={health.data?.bff}
            />
            <StatCard
              icon={Server}
              tone="teal"
              label="Core"
              loading={healthLoading}
              ok={health.data?.core.reachable}
              value={health.data?.core.status}
              hint={
                health.data ? `HTTP ${health.data.core.httpStatus}` : undefined
              }
            />
            <StatCard
              icon={Shield}
              tone="amber"
              label="Admin panel"
              loading={healthLoading}
              neutral
              value={
                health.data
                  ? health.data.adminEnabled
                    ? 'enabled'
                    : 'disabled'
                  : undefined
              }
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Your account
          </h2>
          <Card>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {sessionLoading ? (
                <div className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ) : authed ? (
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-foreground">
                    <Wallet className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">Signed in</span>
                    <span
                      className="truncate font-mono text-xs text-muted-foreground"
                      title={wallet ?? undefined}
                    >
                      {who}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    You&rsquo;re not signed in
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Sign in with your Stellar wallet to manage escrows.
                  </span>
                </div>
              )}

              {!sessionLoading &&
                (authed ? (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild>
                      <Link href="/escrows">
                        View escrows
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/escrows/new">
                        <Plus className="size-4" />
                        New escrow
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <Button asChild>
                    <Link href="/login">
                      Sign in
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </Shell>
  );
}

const STAT_TONE: Record<'blue' | 'teal' | 'amber', string> = {
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  teal: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  ok,
  neutral,
  loading,
  tone = 'blue',
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  hint?: string;
  ok?: boolean;
  neutral?: boolean;
  loading?: boolean;
  tone?: 'blue' | 'teal' | 'amber';
}) {
  const badgeVariant = neutral
    ? value === 'enabled'
      ? 'warning'
      : 'secondary'
    : ok
      ? 'success'
      : 'destructive';
  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 px-4 py-4">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg',
            STAT_TONE[tone],
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          {loading ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant={badgeVariant} className="capitalize">
                {value ?? 'unknown'}
              </Badge>
              {hint && (
                <span className="text-[11px] text-muted-foreground">{hint}</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** `GABCDE…WXYZ` — short, readable form of a Stellar address. */
function formatAddress(address: string): string {
  return address.length > 12
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}
