import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { stylePresetPayloadSchema } from '@/infrastructure/http/apiValidation';
import { isRepositoryStyle } from '../lib/registryContentValidation';
import { PipelineRegistryCommandError } from '../lib/pipelineRegistryCommandsError';
import { templateReviewBaseSchema, templateReviewReceiptSchema } from '../lib/templateReview';

const assetSchema = z.string().trim().min(1).max(200);
const keySchema = z.string().regex(/^[A-Za-z0-9_-]{16,160}$/u);
const baseSchema = z.object({ expectedBase: templateReviewBaseSchema, style: stylePresetPayloadSchema });
function fail(message: string, status = 503): never { throw new PipelineRegistryCommandError(message, status); }
const client = () => getSupabaseServerClient() ?? fail('Pipeline is unavailable. Your style draft is unchanged.');
function rpcFailure(message: string | undefined): never {
  if (message?.includes('not_found')) fail('The published style no longer exists.', 404);
  if (message?.includes('not_permitted')) fail('Choose a published style with an intact revision lineage.', 400);
  if (message?.includes('conflict')) fail('The published style, review history or attempt changed. Compare with the current published revision; your draft is preserved.', 409);
  if (message?.includes('invalid')) fail('The style review request is invalid.', 400);
  fail('The revision outcome could not be confirmed. Retry the exact saved snapshot and attempt key.');
}
export async function readStyleReviewBase(assetId: string) {
  if (!assetSchema.safeParse(assetId).success) fail('Choose a published style.', 400);
  const { data, error } = await client().rpc('cardforge_read_style_review_base', { p_asset_id: assetId });
  if (error) rpcFailure(error.message);
  const parsed = baseSchema.safeParse(data);
  if (!parsed.success || !isRepositoryStyle(parsed.data.style)) fail('The canonical published style could not be verified.');
  return parsed.data;
}
export async function readStyleReviewReceipt(assetId: string, key: string, actorId: string) {
  if (!assetSchema.safeParse(assetId).success || !keySchema.safeParse(key).success) fail('Provide the exact style attempt.', 400);
  const { data, error } = await client().rpc('cardforge_read_style_review_receipt', {
    p_asset_id: assetId, p_submission_key: key, p_actor_id: actorId,
  });
  if (error) rpcFailure(error.message);
  if (data === null) return null;
  const parsed = templateReviewReceiptSchema.safeParse(data);
  return parsed.success ? parsed.data : fail('The saved revision receipt could not be verified. Retry the same attempt.');
}
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => [key, canonical(entry)]))
    : value;
export async function createStyleReviewRevision(input: unknown, actorId: string) {
  const parsed = z.object({ style: stylePresetPayloadSchema, expectedBase: templateReviewBaseSchema,
    submissionKey: keySchema }).strict().safeParse(input);
  if (!parsed.success || !isRepositoryStyle(parsed.data.style)) fail('Provide a valid complete style and exact review base.', 400);
  const { style, expectedBase, submissionKey } = parsed.data;
  if (style.id !== expectedBase.assetId) fail('The style and published base do not match.', 400);
  const requestFingerprint = createHash('sha256').update(JSON.stringify(canonical({ style, expectedBase }))).digest('hex');
  const prior = await readStyleReviewReceipt(expectedBase.assetId, submissionKey, actorId);
  if (prior) {
    if (prior.requestFingerprint !== requestFingerprint) fail('This attempt key belongs to a different saved snapshot.', 409);
    return prior;
  }
  const base = await readStyleReviewBase(expectedBase.assetId);
  if (JSON.stringify(base.expectedBase) !== JSON.stringify(expectedBase)) fail('The published review base changed. Your style draft is preserved.', 409);
  // These are inherited provenance/access facts, not appearance edits.
  for (const key of ['librarySource', 'accessTier', 'registryStatus', 'contributorName'] as const) {
    if (style[key] !== base.style[key]) fail('A correction cannot change published provenance or access.', 400);
  }
  const { data, error } = await client().rpc('cardforge_create_style_review_revision', {
    p_asset_id: expectedBase.assetId, p_expected_base: expectedBase, p_style_payload: style,
    p_actor_id: actorId, p_submission_key: submissionKey, p_request_fingerprint: requestFingerprint,
  });
  if (error || !data) rpcFailure(error?.message);
  return await readStyleReviewReceipt(expectedBase.assetId, submissionKey, actorId)
    ?? fail('The submission may have succeeded but its receipt is unavailable. Retry the same saved snapshot and key.');
}
