import type { NextConfig } from 'next';

/**
 * Static security headers applied to every response.
 *
 * The Content-Security-Policy is intentionally NOT here — it carries a
 * per-request nonce, so it's built in `src/proxy.ts` (a static header
 * can't hold a nonce). The browser only ever talks to THIS origin (the BFF
 * under `/api/*`); credentials live server-side (env var + httpOnly cookie)
 * and never reach the browser.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
