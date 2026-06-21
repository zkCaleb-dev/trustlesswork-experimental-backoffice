import type { CoreProblem } from '@/server/core/client';

/**
 * Client-side helper to call the BFF (same-origin `/api/*`). The browser never
 * calls the core directly — it always goes through the BFF, which attaches the
 * credential server-side. Tolerates empty/204 responses (e.g. DELETE).
 */
export async function bff<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
  });

  const text = await res.text();
  if (!res.ok) {
    const problem = text ? (safeParse(text) as CoreProblem | null) : null;
    throw new Error(problem?.detail ?? `Request failed (${res.status})`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Convenience for JSON POSTs to the BFF. */
export async function bffPost<T>(path: string, data?: unknown): Promise<T> {
  return bff<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
