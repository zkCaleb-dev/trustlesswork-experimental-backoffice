import type { NextConfig } from 'next';

/** React + Turbopack use eval() in DEV only — React never uses it in production. */
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Security headers applied to every response.
 *
 * The browser only ever talks to THIS origin (the BFF under `/api/*`), never
 * to the core directly — so `connect-src 'self'` is enough and no API origin
 * is whitelisted here. The admin/user credentials live server-side (env var +
 * httpOnly cookie) and never reach the browser.
 *
 * NOTE: `script-src 'unsafe-inline'` is a pragmatic default for now; tighten to
 * a nonce-based policy before a real mainnet launch. `'unsafe-eval'` is added
 * ONLY in development (React/Turbopack dev tooling needs it); production stays
 * strict (no eval).
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
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      "connect-src 'self'",
    ].join('; '),
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
