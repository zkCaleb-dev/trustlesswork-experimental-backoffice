/**
 * Public (browser-safe) configuration. NEXT_PUBLIC_* values are inlined at build
 * time and visible in the browser — NEVER put a secret here.
 */
export const publicEnv = {
  stellarNetwork:
    process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
      ? 'mainnet'
      : 'testnet',
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Trustless Work Backoffice',
} as const;
