import { NextResponse } from 'next/server';

import { processNextExportJob } from '@/lib/server/exportWorkerEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const job = await processNextExportJob();
  return NextResponse.json({ ok: true, job });
}
