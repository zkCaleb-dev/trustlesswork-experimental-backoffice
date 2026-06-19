import { NextResponse } from 'next/server';

import { clearSession } from '@/server/core/session';

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
