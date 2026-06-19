import { useEffect, useState } from 'react';

/**
 * `false` during SSR and the first client render, `true` afterwards.
 *
 * Use to gate UI that depends on client-only state (TanStack Query
 * `isFetching`/`isLoading`, the wallet session, etc.) so the server HTML and the
 * first client render are identical — avoiding hydration mismatches. The real
 * state renders right after mount.
 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
