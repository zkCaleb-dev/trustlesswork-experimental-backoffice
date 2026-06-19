/**
 * Public (browser-safe) configuration. NEXT_PUBLIC_* values are inlined at build
 * time and visible in the browser — NEVER put a secret here.
 */
const stellarNetwork =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';

const NETWORK_PASSPHRASE = {
  mainnet: 'Public Global Stellar Network ; September 2015',
  testnet: 'Test SDF Network ; September 2015',
} as const;

export const publicEnv = {
  stellarNetwork,
  /** Passphrase the wallet must sign escrow transactions with. */
  networkPassphrase: NETWORK_PASSPHRASE[stellarNetwork],
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Trustless Work Backoffice',
} as const;
