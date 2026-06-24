import 'server-only';

import { serverEnv } from '@/server/env';

/** RFC-7807 Problem Details the core returns on errors. */
export interface CoreProblem {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  detail?: string;
  traceId?: string;
  extensions?: Record<string, unknown>;
}

export interface CoreResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  problem: CoreProblem | null;
}

export interface CoreFetchOptions {
  method?: string;
  /** Serialized and sent as JSON. */
  body?: unknown;
  /** Sent as `x-api-key` — the server-only admin key (env), for admin calls. */
  apiKey?: string;
  /** Sent as `Authorization: Bearer` — the user's wallet-session token (cookie). */
  bearer?: string;
  headers?: Record<string, string>;
  cache?: RequestCache;
}

/**
 * The ONLY place the app talks to the deployed core. Runs server-side (BFF), so
 * credentials never reach the browser. Returns a discriminated result instead
 * of throwing, so route handlers map core problems to HTTP cleanly.
 */
export async function coreFetch<T = unknown>(
  path: string,
  options: CoreFetchOptions = {},
): Promise<CoreResult<T>> {
  const {
    method = 'GET',
    body,
    apiKey,
    bearer,
    headers = {},
    cache = 'no-store',
  } = options;

  const res = await fetch(`${serverEnv.CORE_API_URL}${path}`, {
    method,
    cache,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const json = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      data: null,
      problem:
        (json as CoreProblem | null) ??
        ({ status: res.status, detail: res.statusText } satisfies CoreProblem),
    };
  }

  return { ok: true, status: res.status, data: json as T, problem: null };
}

/**
 * Call the core as the PLATFORM. The core now mediates register / login /
 * recover behind a `BACKOFFICE_ADMIN`-roled credential, so these flows are no
 * longer public: the BFF must present the server-only admin key. Centralised
 * here so every mediated route injects the same credential and fails the same
 * (clear) way when it isn't configured — never a confusing bare 401 from core.
 */
export async function platformFetch<T = unknown>(
  path: string,
  options: Omit<CoreFetchOptions, 'apiKey'> = {},
): Promise<CoreResult<T>> {
  if (!serverEnv.BACKOFFICE_ADMIN_API_KEY) {
    return {
      ok: false,
      status: 503,
      data: null,
      problem: {
        status: 503,
        code: 'PLATFORM_CREDENTIAL_MISSING',
        detail:
          'BACKOFFICE_ADMIN_API_KEY is not configured; platform-mediated auth is unavailable.',
      },
    };
  }

  return coreFetch<T>(path, {
    ...options,
    apiKey: serverEnv.BACKOFFICE_ADMIN_API_KEY,
  });
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
