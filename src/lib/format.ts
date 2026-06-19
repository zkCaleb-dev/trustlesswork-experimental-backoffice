/** `GABCDE…WXYZ` — short, readable form of a long id/address. */
export function truncateMiddle(value: string, head = 6, tail = 4): string {
  return value.length > head + tail + 1
    ? `${value.slice(0, head)}…${value.slice(-tail)}`
    : value;
}

/** "USDC" from "USDC:GA1B…". Empty string for null. */
export function assetSymbol(asset: string | null): string {
  if (!asset) return '';
  return asset.split(':')[0] ?? asset;
}

/** Locale date-time, falling back to the raw ISO string if unparseable. */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}
