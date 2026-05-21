import { NextResponse } from 'next/server';

import { exportJobStore } from '@/lib/server/exportJobStore';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  const job = await exportJobStore.requestCancel(jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: { code: 'not_found', message: 'Export job was not found.' } }, { status: 404 });
  }

  return NextResponse.json({ ok: true, job });
}
