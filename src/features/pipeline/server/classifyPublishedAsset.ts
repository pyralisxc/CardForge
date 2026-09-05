import { z } from 'zod';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { normalizeSpecialtyTags, normalizeUseCaseTags } from '../lib/contentTaxonomy';
import { PipelineRegistryCommandError } from '../lib/pipelineRegistryCommandsError';

const inputSchema = z.object({
  assetId: z.string().trim().min(1).max(200),
  expectedSubmissionId: z.string().uuid(),
  expectedLineageId: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative(),
  expectedSpecialtyTags: z.array(z.string()).max(12),
  expectedUseCaseTags: z.array(z.string()).max(12),
  specialtyTags: z.array(z.string()).min(1).max(12),
  useCaseTags: z.array(z.string()).max(12),
}).strict();

export async function readPublishedPipelineClassification(assetId: string) {
  if (!assetId.trim() || assetId.length > 200) throw new PipelineRegistryCommandError('Choose a published asset.', 400, 'pipeline_classification_invalid');
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new PipelineRegistryCommandError('Pipeline is unavailable.', 503, 'pipeline_classification_unavailable');
  const { data: registry, error } = await supabase.from('cardforge_asset_registry')
    .select('asset_id,name,status,metadata,contributor_submission_id').eq('asset_id', assetId).maybeSingle();
  if (error) throw new PipelineRegistryCommandError('Published content is unavailable. Try again.', 503, 'pipeline_classification_unavailable');
  if (!registry) throw new PipelineRegistryCommandError('The published asset no longer exists.', 404, 'pipeline_classification_not_found');
  const { data: submission, error: sourceError } = await supabase.from('cardforge_contributor_asset_submissions')
    .select('id,lineage_id,status,purge_state,specialty_tags,use_case_tags,asset_type').eq('id', registry.contributor_submission_id).maybeSingle();
  if (sourceError) throw new PipelineRegistryCommandError('Published classification is unavailable. Try again.', 503, 'pipeline_classification_unavailable');
  if (!submission?.lineage_id || registry.status !== 'published' || submission.status !== 'published' || submission.purge_state) {
    throw new PipelineRegistryCommandError('This asset is no longer available for published classification. Reload its current revision.', 409, 'pipeline_classification_conflict');
  }
  const revision = String(registry.metadata?.revisionNumber ?? '');
  return { assetId: registry.asset_id, name: registry.name, assetType: submission.asset_type,
    expectedSubmissionId: submission.id, expectedLineageId: submission.lineage_id,
    expectedRevision: /^[0-9]+$/.test(revision) ? Number(revision) : 0,
    expectedSpecialtyTags: submission.specialty_tags ?? [], expectedUseCaseTags: submission.use_case_tags ?? [] };
}

/** Invoked only after the request owner gate. SQL owns the locked comparison. */
export async function classifyPublishedPipelineAsset(value: unknown): Promise<void> {
  const parsed = inputSchema.safeParse(value);
  if (!parsed.success) throw new PipelineRegistryCommandError('Provide the exact published identity and supported classification.', 400, 'pipeline_classification_invalid');
  const input = parsed.data;
  if (JSON.stringify(normalizeSpecialtyTags(input.specialtyTags)) !== JSON.stringify(input.specialtyTags)
    || JSON.stringify(normalizeUseCaseTags(input.useCaseTags)) !== JSON.stringify(input.useCaseTags)) {
    throw new PipelineRegistryCommandError('Choose supported classification values without duplicates.', 400, 'pipeline_classification_invalid');
  }
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new PipelineRegistryCommandError('Pipeline is unavailable. Try again.', 503, 'pipeline_unavailable');
  const { error } = await supabase.rpc('cardforge_classify_published_pipeline_asset', {
    p_asset_id: input.assetId,
    p_expected_submission_id: input.expectedSubmissionId,
    p_expected_lineage_id: input.expectedLineageId,
    p_expected_revision: input.expectedRevision,
    p_expected_specialty_tags: input.expectedSpecialtyTags,
    p_expected_use_case_tags: input.expectedUseCaseTags,
    p_specialty_tags: input.specialtyTags,
    p_use_case_tags: input.useCaseTags,
  });
  if (!error) return;
  if (error.message.includes('pipeline_classification_conflict')) throw new PipelineRegistryCommandError('The published revision or classification changed. Reload before classifying it again.', 409, 'pipeline_classification_conflict');
  if (error.message.includes('pipeline_classification_not_found')) throw new PipelineRegistryCommandError('The published asset no longer exists.', 404, 'pipeline_classification_not_found');
  if (error.message.includes('pipeline_classification_invalid')) throw new PipelineRegistryCommandError('This asset requires a supported specialty and use case.', 400, 'pipeline_classification_invalid');
  throw new PipelineRegistryCommandError('Classification could not be saved. Retry the same request to confirm its outcome.', 503, 'pipeline_classification_unavailable');
}
