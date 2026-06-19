import type { CoreProblem } from '@/server/core/client';

/**
 * Client-side helper to call the BFF (same-origin `/api/*`). The browser never
 * calls the core directly — it always goes through the BFF, which attaches the
 * credential server-side.
 */
export async function bff<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
  });

  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as CoreProblem | null;
    throw new Error(problem?.detail ?? `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}
