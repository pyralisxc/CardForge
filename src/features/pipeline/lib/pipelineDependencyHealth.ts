import { z } from 'zod';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { PipelineStoreError } from './pipelineStoreError';
import type { PipelineDependencyImpactFinding } from './pipelineContentHealth';
const findings = z.array(z.object({ objectId: z.string().min(1), objectName: z.string(), sourceAssetId: z.string(), sourceAssetName: z.string(), submissionId: z.string().uuid().nullable() }).strict());
export async function readPipelineDependencyHealth(): Promise<PipelineDependencyImpactFinding[]> {
  const db = getSupabaseServerClient();
  if (!db) throw new PipelineStoreError('Dependency health is unavailable.', 503);
  const { data, error } = await db.rpc('cardforge_pipeline_dependency_health');
  const parsed = findings.safeParse(data);
  if (error || !parsed.success) throw new PipelineStoreError('Dependency health is unavailable; existing findings were not cleared.', 503);
  return parsed.data.map(row => ({ ...row, submissionId: row.submissionId ?? undefined }));
}
