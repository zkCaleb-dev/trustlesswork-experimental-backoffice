import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { publicEnv } from '@/lib/public-env';

import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: publicEnv.appName,
  description: 'Backoffice for Trustless Work escrows.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
