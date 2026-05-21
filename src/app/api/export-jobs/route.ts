import { NextResponse } from 'next/server';
import { z } from 'zod';

import { buildExportJobPreflight } from '@/lib/exportPreflight';
import type { ExportJobRequest } from '@/lib/exportJobTypes';
import { exportJobStore } from '@/lib/server/exportJobStore';
import { formatZodIssues, parseJsonBodyWithLimit } from '@/lib/apiValidation';

export const runtime = 'nodejs';

const MAX_EXPORT_JOB_BODY_BYTES = 60 * 1024 * 1024;

const exportJobRequestSchema = z.object({
  cards: z.array(z.object({
    uniqueId: z.string().min(1),
    data: z.record(z.unknown()),
    template: z.object({
      id: z.string().nullable(),
      name: z.string().min(1),
      aspectRatio: z.string().min(1),
    }).passthrough(),
    styleOverrides: z.record(z.unknown()).optional(),
  })).min(1),
  artifactType: z.enum(['zip', 'pdf']),
  exportMode: z.enum(['physical', 'virtual']),
  exportDpi: z.number().finite().min(72).max(600),
  paperSize: z.object({
    name: z.string().min(1),
    widthMm: z.number().finite().positive(),
    heightMm: z.number().finite().positive(),
  }),
  pdfMarginMm: z.number().finite().min(0),
  pdfCardSpacingMm: z.number().finite().min(0),
  pdfIncludeCutLines: z.boolean(),
  pdfDuplexLayout: z.enum(['separate-pages', 'same-page']),
});

const errorResponse = (
  status: number,
  code: string,
  message: string,
  details?: string[]
) => NextResponse.json({ ok: false, error: { code, message, details } }, { status });

export async function POST(request: Request) {
  const parsedBody = await parseJsonBodyWithLimit(request, MAX_EXPORT_JOB_BODY_BYTES);
  if (!parsedBody.ok) {
    return errorResponse(
      parsedBody.code === 'payload_too_large' ? 413 : 400,
      parsedBody.code,
      parsedBody.message
    );
  }

  const validation = exportJobRequestSchema.safeParse(parsedBody.data);
  if (!validation.success) {
    return errorResponse(400, 'invalid_export_job', 'Invalid export job payload.', formatZodIssues(validation.error.issues));
  }

  const payload = validation.data as ExportJobRequest;
  const preflight = buildExportJobPreflight(payload);
  const job = await exportJobStore.create({ ...payload, preflight });

  return NextResponse.json({ ok: true, job });
}
