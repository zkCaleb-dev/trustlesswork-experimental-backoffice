'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { bff } from '@/lib/api';
import { publicEnv } from '@/lib/public-env';
import { useLogout, useSession } from '@/lib/session';

interface Health {
  bff: string;
  adminEnabled: boolean;
  core: { reachable: boolean; status: string; httpStatus: number };
}

export default function HomePage() {
  const session = useSession();
  const logout = useLogout();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => bff<Health>('/health'),
  });

  const authed = session.data?.authenticated ?? false;
  const user = session.data?.user;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{publicEnv.appName}</h1>
          <p className="text-sm text-neutral-500">
            Network: {publicEnv.stellarNetwork} · server-side BFF.
          </p>
        </div>
        <div className="text-sm">
          {authed ? (
            <div className="flex items-center gap-3">
              <span className="text-neutral-600">
                {user?.email ?? `user #${user?.id}`}
              </span>
              <button
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-neutral-700">
          Core connection
        </h2>
        {health.isLoading && <p className="text-sm text-neutral-500">Checking…</p>}
        {health.data && (
          <ul className="space-y-1 text-sm">
            <li>
              BFF: <Badge ok={health.data.bff === 'ok'}>{health.data.bff}</Badge>
            </li>
            <li>
              Core:{' '}
              <Badge ok={health.data.core.reachable}>
                {health.data.core.status}
              </Badge>{' '}
              <span className="text-neutral-400">
                (HTTP {health.data.core.httpStatus})
              </span>
            </li>
            <li>
              Admin panel:{' '}
              <Badge ok={health.data.adminEnabled}>
                {health.data.adminEnabled ? 'enabled' : 'disabled'}
              </Badge>
            </li>
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-medium text-neutral-700">Your session</h2>
        {session.isLoading ? (
          <p className="text-sm text-neutral-500">Checking…</p>
        ) : authed ? (
          <p className="text-sm text-neutral-600">
            Signed in as{' '}
            <code className="rounded bg-neutral-100 px-1">
              {user?.email ?? `user #${user?.id}`}
            </code>
            . Escrows &amp; admin coming in F2–F4.
          </p>
        ) : (
          <p className="text-sm text-neutral-600">
            Not signed in.{' '}
            <Link href="/login" className="underline">
              Sign in or register
            </Link>
            .
          </p>
        )}
      </section>

      <p className="text-xs text-neutral-400">
        F1 — onboarding wired (register / recover / sign in). Escrows next.
      </p>
    </main>
  );
}

function Badge({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
        ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {children}
    </span>
  );
}
