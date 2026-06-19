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
  /** Sent as `x-api-key` — the user key (from cookie) or the admin key (env). */
  apiKey?: string;
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

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
