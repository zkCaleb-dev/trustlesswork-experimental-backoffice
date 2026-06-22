'use client';

import { LayoutGrid, LogOut, Plus, Settings, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { truncateMiddle } from '@/lib/format';
import { publicEnv } from '@/lib/public-env';
import { useLogout, useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

const NAV: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
}[] = [
  {
    href: '/escrows',
    label: 'Escrows',
    icon: LayoutGrid,
    match: (p) =>
      p === '/escrows' || (p.startsWith('/escrows/') && p !== '/escrows/new'),
  },
  {
    href: '/escrows/new',
    label: 'New escrow',
    icon: Plus,
    match: (p) => p === '/escrows/new',
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    match: (p) => p === '/settings',
  },
];

/** App chrome for the signed-in area: a sticky top nav bar + a centered container. */
export function Shell({ children }: { children: ReactNode }) {
  const session = useSession();
  const logout = useLogout();
  const pathname = usePathname();
  const authed = session.data?.authenticated ?? false;
  const wallet = session.data?.wallet;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-1">
            <Link
              href="/"
              className="mr-3 flex items-center gap-2 font-semibold tracking-tight"
            >
              <span className="grid size-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                TW
              </span>
              <span className="hidden sm:inline">Trustless Work</span>
            </Link>
            <nav className="flex items-center gap-1">
              {NAV.map(({ href, label, icon: Icon, match }) => {
                const active = match(pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3',
                      active
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="hidden font-normal text-muted-foreground capitalize sm:inline-flex"
            >
              {publicEnv.stellarNetwork}
            </Badge>
            {authed ? (
              <>
                {wallet && (
                  <span
                    className="hidden items-center gap-1.5 rounded-md bg-accent px-2 py-1 font-mono text-xs text-accent-foreground md:inline-flex"
                    title={wallet}
                  >
                    <Wallet className="size-3.5" />
                    {truncateMiddle(wallet)}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                >
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </>
            ) : (
              <Button size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
