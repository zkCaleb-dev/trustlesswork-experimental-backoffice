import { NextRequest, NextResponse } from 'next/server';

import { coreFetch } from '@/server/core/client';
import { getSessionToken } from '@/server/core/session';

/**
 * Authenticated BFF proxy to the core.
 *
 * The browser calls same-origin `/api/core/<path>`; this handler forwards the
 * request to the deployed core with the wallet-session bearer attached
 * server-side — so the token never reaches browser JS. It is the single door
 * the dashboard uses for read-model + (later) escrow-action calls.
 *
 * Safety:
 *  - **No SSRF.** The host is always the fixed `CORE_API_URL`; only the path +
 *    query are caller-influenced, and the path is validated (no traversal, no
 *    embedded slashes/backslashes, non-empty segments).
 *  - **CSRF.** State-changing methods (anything but GET/HEAD) are cookie-
 *    authenticated, so they require a same-origin `Origin` before the cookie is
 *    forwarded. Reads are exempt (they don't mutate). This is in place now so
 *    the future escrow-action proxy (F3) is safe by construction.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD']);

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await ctx.params;

  const corePath = buildCorePath(path, req.nextUrl.search);
  if (!corePath) {
    return NextResponse.json(
      { code: 'BAD_PATH', detail: 'Invalid core path.' },
      { status: 400 },
    );
  }

  // CSRF defense for cookie-authenticated mutations.
  if (!SAFE_METHODS.has(req.method) && !isSameOrigin(req)) {
    return NextResponse.json(
      { code: 'CSRF_BLOCKED', detail: 'Cross-origin request blocked.' },
      { status: 403 },
    );
  }

  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json(
      { code: 'UNAUTHENTICATED', detail: 'Sign in first.' },
      { status: 401 },
    );
  }

  let body: unknown;
  if (!SAFE_METHODS.has(req.method)) {
    const raw = await req.text();
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        return NextResponse.json(
          { code: 'BAD_JSON', detail: 'Body is not valid JSON.' },
          { status: 400 },
        );
      }
    }
  }

  const result = await coreFetch(corePath, {
    method: req.method,
    bearer: token,
    body,
  });

  return NextResponse.json(result.ok ? result.data : result.problem, {
    status: result.status,
  });
}

/** Rebuilds a safe core path from the catch-all segments + the query string. */
function buildCorePath(segments: string[], search: string): string | null {
  if (!segments.length) return null;
  for (const s of segments) {
    if (!s || s === '.' || s === '..' || s.includes('/') || s.includes('\\')) {
      return null;
    }
  }
  return `/${segments.join('/')}${search}`;
}

/** True if the request's Origin matches the host it was sent to. */
function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
