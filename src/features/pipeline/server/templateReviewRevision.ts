import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { TCGCardTemplate } from '@/domain/templates';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { templatePayloadSchema } from '@/infrastructure/http/apiValidation';
import { isRepositoryTemplate } from '../lib/registryContentValidation';
import { hydratePipelineTemplateAssetReferences, PIPELINE_TEMPLATE_ASSET_REFERENCE_PREFIX } from '../lib/pipelineTemplateAssets';
import { PipelineRegistryCommandError } from '../lib/pipelineRegistryCommandsError';
import { templateReviewBaseSchema, templateReviewReceiptSchema, templateReviewPayload, templateReviewRequestText } from '../lib/templateReview';

function fail(message: string, status = 503): never { throw new PipelineRegistryCommandError(message, status); }
const client = () => getSupabaseServerClient() ?? fail('Pipeline is unavailable. Your browser draft is unchanged.');
const assetSchema = z.string().trim().min(1).max(200);
const keySchema = z.string().regex(/^[A-Za-z0-9_-]{16,160}$/u);
const baseSchema = z.object({ expectedBase: templateReviewBaseSchema, template: templatePayloadSchema });

function rpcFailure(message: string | undefined): never {
  if (message?.includes('not_found')) fail('The published Template no longer exists.', 404);
  if (message?.includes('not_permitted')) fail('Choose a published native Template with an intact revision lineage.', 400);
  if (message?.includes('conflict')) fail('The published source, review history or attempt changed. Your local work is preserved; compare with the current published revision.', 409);
  if (message?.includes('invalid')) fail('The Template review request is invalid.', 400);
  fail('The revision outcome could not be confirmed. Retry this exact attempt; do not discard your draft.');
}

async function rawBase(assetId: string) {
  const { data, error } = await client().rpc('cardforge_read_template_review_base', { p_asset_id: assetId });
  if (error) rpcFailure(error.message);
  const parsed = baseSchema.safeParse(data);
  if (!parsed.success || !isRepositoryTemplate(parsed.data.template)) fail('The canonical published Template could not be verified.');
  return { ...parsed.data, template: parsed.data.template as TCGCardTemplate };
}

export async function readTemplateReviewBase(assetId: string) {
  if (!assetSchema.safeParse(assetId).success) fail('Choose a published Template.', 400);
  const base = await rawBase(assetId);
  return {
    expectedBase: base.expectedBase,
    template: { ...hydratePipelineTemplateAssetReferences(base.template),
      templateSource: 'default' as const, templateLibrarySource: 'pipeline' as const, templateRegistryStatus: 'published' as const,
      templateRevision: base.expectedBase.baseRevisionNumber, templateRevisionId: base.expectedBase.parentSubmissionId },
  };
}

export async function readTemplateReviewReceipt(assetId: string, key: string, actorId: string) {
  if (!assetSchema.safeParse(assetId).success || !keySchema.safeParse(key).success) fail('Provide the exact Template attempt.', 400);
  const { data, error } = await client().rpc('cardforge_read_template_review_receipt', {
    p_asset_id: assetId, p_submission_key: key, p_actor_id: actorId,
  });
  if (error) rpcFailure(error.message);
  if (data === null) return null;
  const parsed = templateReviewReceiptSchema.safeParse(data);
  return parsed.success ? parsed.data : fail('The saved revision receipt could not be verified. Retry the same attempt.');
}

// Restore only the exact known hydration of parent-owned references. Never
// turn an arbitrary URL into a managed asset or silently import new artwork.
function restoreOwnedReferences(template: TCGCardTemplate, parent: TCGCardTemplate): TCGCardTemplate {
  const replacements = new Map<string, string>();
  const remember = (value: unknown): void => {
    if (typeof value === 'string' && value.startsWith(PIPELINE_TEMPLATE_ASSET_REFERENCE_PREFIX)) {
      replacements.set(hydratePipelineTemplateAssetReferences(value), value);
    } else if (Array.isArray(value)) value.forEach(remember);
    else if (value && typeof value === 'object') Object.values(value).forEach(remember);
  };
  remember(parent);
  const restore = (value: unknown): unknown => typeof value === 'string' ? replacements.get(value) ?? value
    : Array.isArray(value) ? value.map(restore)
      : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restore(v)])) : value;
  const restored = restore(template) as TCGCardTemplate;
  const imageFields = new Set([parent, restored].flatMap((value) => value.fieldContracts?.filter((field) => field.type === 'image').map((field) => field.key) ?? []));
  const sources = (value: TCGCardTemplate): string[] => {
    const found: string[] = [];
    const visit = (entry: unknown, key = ''): void => {
      if (typeof entry === 'string') {
        const sourceField = /(?:url|src|imageSource|assetSource|dividerAsset|imageFieldKey)$/iu.test(key) || imageFields.has(key);
        const gradient = /^\s*(?:linear|radial)-gradient\(/u.test(entry) && !/url\s*\(|[a-z][a-z0-9+.-]*:\/\//iu.test(entry);
        if (entry && ((sourceField && !gradient) || /^(?:cardforge-pipeline-asset:\/\/|data:image\/|[a-z][a-z0-9+.-]*:\/\/|data:|blob:|\/|\.\.?\/)/iu.test(entry) || /url\s*\(/iu.test(entry))) found.push(entry);
      } else if (Array.isArray(entry)) entry.forEach((v) => visit(v, key));
      else if (entry && typeof entry === 'object') Object.entries(entry).forEach(([k, v]) => {
        if (((k === 'example' || k === 'defaultValue') && 'type' in entry && entry.type === 'image' || k === 'content' && 'type' in entry && (entry.type === 'image' || entry.type === 'icon')) && typeof v === 'string' && v) found.push(v);
        else visit(v, k);
      });
    };
    visit(value);
    // Native reconstruction may add an alias of the same published image.
    // Preserve the exact source identities, not the count of renderer aliases.
    return [...new Set(found)].sort();
  };
  if (JSON.stringify(sources(restored)) !== JSON.stringify(sources(parent))) {
    fail('This review path preserves existing artwork and source references. Use the normal governed source workflow for new artwork.', 400);
  }
  // Browser-local identities and author labels cannot rewrite source claims.
  const inherited = ['id', 'templateContributorName', 'templateLineageId', 'templateOriginLineageId',
    'templateOriginRevisionId', 'templateParentRevisionId', 'templateRevisionId', 'templateRevision',
    'templateAccessTier', 'templateCategory', 'templateUsage', 'templateDescription', 'templateLibrarySource',
    'templateSource', 'templateRegistryStatus'] as const;
  const output = { ...restored } as Record<string, unknown>;
  for (const key of inherited) {
    if (parent[key] === undefined) delete output[key];
    else output[key] = parent[key];
  }
  return output as unknown as TCGCardTemplate;
}

export async function createTemplateReviewRevision(input: unknown, actorId: string) {
  const parsed = z.object({ template: templatePayloadSchema, expectedBase: templateReviewBaseSchema,
    submissionKey: keySchema }).strict().safeParse(input);
  if (!parsed.success || !isRepositoryTemplate(parsed.data.template)) fail('Provide a valid saved Template and exact review base.', 400);
  const { expectedBase, submissionKey } = parsed.data;
  const template = parsed.data.template as TCGCardTemplate;
  if (template.id !== expectedBase.assetId) fail('The Template and published base do not match.', 400);
  const requestFingerprint = createHash('sha256').update(templateReviewRequestText({ ...template,
    templatePipelineContext: { schemaVersion: 1, expectedBase } })).digest('hex');
  const prior = await readTemplateReviewReceipt(expectedBase.assetId, submissionKey, actorId);
  if (prior) {
    if (prior.requestFingerprint !== requestFingerprint) fail('This attempt key belongs to a different saved snapshot.', 409);
    return prior;
  }
  const base = await rawBase(expectedBase.assetId);
  if (JSON.stringify(base.expectedBase) !== JSON.stringify(expectedBase)) fail('The published review base changed. Your browser draft is preserved.', 409);
  const payload = restoreOwnedReferences(templateReviewPayload(template), base.template);
  const { data, error } = await client().rpc('cardforge_create_template_review_revision', {
    p_asset_id: expectedBase.assetId, p_expected_base: expectedBase, p_template_payload: payload,
    p_actor_id: actorId, p_submission_key: submissionKey, p_request_fingerprint: requestFingerprint,
  });
  if (error || !data) rpcFailure(error?.message);
  const receipt = await readTemplateReviewReceipt(expectedBase.assetId, submissionKey, actorId);
  return receipt ?? fail('The submission may have succeeded but its receipt is unavailable. Retry the same saved snapshot and key.');
}
