import type { Metadata } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { publicEnv } from '@/lib/public-env';

import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: publicEnv.appName,
  description: 'Backoffice for Trustless Work escrows.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Nonce-based CSP only works under dynamic rendering: Next stamps the
  // per-request nonce (from proxy.ts) onto its scripts during SSR, and a static
  // page has no request to read it from — `'strict-dynamic'` would then block
  // every script. `connection()` opts the whole app into dynamic rendering.
  await connection();

  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
