import { NextResponse } from 'next/server';

import { exportJobStore } from '@/lib/server/exportJobStore';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  const job = await exportJobStore.get(jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: { code: 'not_found', message: 'Export job was not found.' } }, { status: 404 });
  }
  if (job.status !== 'completed' || !job.artifact) {
    return NextResponse.json({ ok: false, error: { code: 'not_ready', message: 'Export artifact is not ready yet.' } }, { status: 409 });
  }

  const bytes = await exportJobStore.readArtifact(jobId);
  return new Response(bytes, {
    headers: {
      'content-type': job.artifact.contentType,
      'content-length': String(job.artifact.bytes),
      'content-disposition': `attachment; filename="${job.artifact.fileName.replace(/"/g, '')}"`,
    },
  });
}
