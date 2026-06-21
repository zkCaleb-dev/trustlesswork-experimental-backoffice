import { randomBytes } from 'node:crypto';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Per-request Content-Security-Policy with a nonce.
 *
 * (Next 16 renamed the `middleware` convention to `proxy`; this runs on the
 * Node.js runtime, before the route renders.)
 *
 * A nonce can't live in a static header (next.config.ts), so the CSP is built
 * here per request. In PRODUCTION every script must carry the request nonce —
 * `'strict-dynamic'` drops the host allowlist, and Next.js stamps the nonce onto
 * its own <script> tags automatically once it sees it in the request CSP. In
 * DEVELOPMENT we keep `'unsafe-inline' 'unsafe-eval'` so HMR / React Refresh
 * work; the strict policy is what ships to mainnet.
 *
 * `style-src 'unsafe-inline'` stays on purpose: Next/React emit inline styles
 * and nonce-ing them is disproportionate — scripts are the XSS-critical vector.
 */
const isDev = process.env.NODE_ENV !== 'production';

export function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString('base64');

  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    scriptSrc,
    "connect-src 'self'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  // Next.js reads the nonce from the request CSP and stamps it onto its scripts.
  requestHeaders.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);
  return response;
}

export const config = {
  matcher: [
    // Everything except API routes, Next internals and static files. The
    // `missing` rules skip prefetches so a nonce isn't spent on them.
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
