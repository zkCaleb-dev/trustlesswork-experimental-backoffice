import { NextResponse } from 'next/server';

import { coreFetch } from '@/server/core/client';
import { isAdminEnabled } from '@/server/env';

/**
 * BFF health proof: server-side calls the core's `/health` and reports it. Proves
 * the browser → BFF → core path works without exposing the core URL or any key.
 */
export async function GET() {
  const core = await coreFetch<{ status?: string }>('/health');

  return NextResponse.json({
    bff: 'ok',
    adminEnabled: isAdminEnabled,
    core: {
      reachable: core.ok,
      status: core.ok ? (core.data?.status ?? 'unknown') : 'unreachable',
      httpStatus: core.status,
    },
  });
}
