'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { bff } from '@/lib/api';
import { publicEnv } from '@/lib/public-env';

interface Health {
  bff: string;
  adminEnabled: boolean;
  core: { reachable: boolean; status: string; httpStatus: number };
}

export default function HomePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['health'],
    queryFn: () => bff<Health>('/health'),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold">{publicEnv.appName}</h1>
        <p className="text-sm text-neutral-500">
          Network: {publicEnv.stellarNetwork} · talks to the core through a
          server-side BFF.
        </p>
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-neutral-700">
          Core connection
        </h2>
        {isLoading && <p className="text-sm text-neutral-500">Checking…</p>}
        {error && (
          <p className="text-sm text-red-600">
            BFF error: {(error as Error).message}
          </p>
        )}
        {data && (
          <ul className="space-y-1 text-sm">
            <li>
              BFF: <Badge ok={data.bff === 'ok'}>{data.bff}</Badge>
            </li>
            <li>
              Core: <Badge ok={data.core.reachable}>{data.core.status}</Badge>{' '}
              <span className="text-neutral-400">(HTTP {data.core.httpStatus})</span>
            </li>
            <li>
              Admin panel:{' '}
              <Badge ok={data.adminEnabled}>
                {data.adminEnabled ? 'enabled' : 'disabled'}
              </Badge>
            </li>
          </ul>
        )}
      </section>

      <p className="text-xs text-neutral-400">
        F0 scaffold — auth, escrows and the admin panel come next.
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
