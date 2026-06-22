/** `GABCDE…WXYZ` — short, readable form of a long id/address. */
export function truncateMiddle(value: string, head = 6, tail = 4): string {
  return value.length > head + tail + 1
    ? `${value.slice(0, head)}…${value.slice(-tail)}`
    : value;
}

/**
 * Human label for an asset. `USDC:GA1B…` → "USDC". A raw Soroban token contract
 * address (no `CODE:ISSUER`) → a short middle-truncated form, so it never blows
 * out the layout. Empty string for null.
 */
export function assetSymbol(asset: string | null): string {
  if (!asset) return '';
  if (asset.includes(':')) return asset.split(':')[0] || asset;
  return truncateMiddle(asset, 4, 4);
}

/**
 * Format a raw on-chain token amount (smallest unit) into human units. Stellar
 * classic assets and SACs use 7 decimals; pass `decimals` for tokens that
 * differ. Uses string math (safe for large values), trims trailing zeros, and
 * groups thousands. Non-integer input is returned unchanged.
 */
export function formatAmount(raw: string | number | null, decimals = 7): string {
  if (raw === null || raw === '') return '—';
  let digits = String(raw).trim();
  const neg = digits.startsWith('-');
  if (neg) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return String(raw);
  digits = digits.padStart(decimals + 1, '0');
  const cut = digits.length - decimals;
  const intPart = digits.slice(0, cut).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fracPart = digits.slice(cut).replace(/0+$/, '');
  const out = fracPart ? `${intPart}.${fracPart}` : intPart;
  return neg ? `-${out}` : out;
}

/** Locale date-time, falling back to the raw ISO string if unparseable. */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}
