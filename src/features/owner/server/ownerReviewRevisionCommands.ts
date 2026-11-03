import { AccountToolAccessError, getAccountToolAccessForUserId } from '@/features/account/server';
import { createTemplateReviewRevision, readTemplateReviewBase, readTemplateReviewReceipt, createStyleReviewRevision, readStyleReviewBase, readStyleReviewReceipt, PipelineRegistryCommandError } from '@/features/pipeline/server';
import { recordOwnerActivity } from './ownerActivityStore';
import { reviewRevisionReadInput, reviewRevisionReceiptInput, reviewRevisionResult, reviewRevisionNativeReceipt } from './ownerReviewRevisionSchemas';

export type ReviewRevisionKind = 'template' | 'style';
const commands = {
  template: { base: readTemplateReviewBase, receipt: readTemplateReviewReceipt, create: createTemplateReviewRevision },
  style: { base: readStyleReviewBase, receipt: readStyleReviewReceipt, create: createStyleReviewRevision },
};
async function owner(actorUserId: string) {
  const access = await getAccountToolAccessForUserId(actorUserId);
  if (!access.isOwner) throw new AccountToolAccessError('Owner access is required for same-lineage review revisions.', 403);
  return access;
}
const invalid = () => new PipelineRegistryCommandError('Provide the exact published review identity and saved attempt.', 400);
export async function getOwnerReviewRevisionBase(actorUserId: string, kind: ReviewRevisionKind, input: unknown) {
  await owner(actorUserId);
  const parsed = reviewRevisionReadInput.safeParse(input); if (!parsed.success) throw invalid();
  const base = await commands[kind].base(parsed.data.assetId);
  if (base.expectedBase.assetId !== parsed.data.assetId || (kind === 'template' ? 'template' in base && base.template.id : 'style' in base && base.style.id) !== parsed.data.assetId) throw new PipelineRegistryCommandError('The exact published review base could not be verified.', 503);
  return base;
}
export async function getOwnerReviewRevisionReceipt(actorUserId: string, kind: ReviewRevisionKind, input: unknown) {
  const access = await owner(actorUserId);
  const parsed = reviewRevisionReceiptInput.safeParse(input); if (!parsed.success) throw invalid();
  const receipt = await commands[kind].receipt(parsed.data.assetId, parsed.data.submissionKey, access.user.id);
  if (receipt && receipt.assetId !== parsed.data.assetId) throw new PipelineRegistryCommandError('The exact saved receipt could not be verified; absence was not established.', 503);
  return { receipt };
}
export async function createOwnerReviewRevision(actorUserId: string, kind: ReviewRevisionKind, input: unknown) {
  const access = await owner(actorUserId);
  // Native commands own full payload validation, provenance, fingerprint, exact-base comparison and allocation.
  const identity = reviewRevisionReceiptInput.safeParse(input && typeof input === 'object' && 'expectedBase' in input && input.expectedBase && typeof input.expectedBase === 'object' && 'assetId' in input.expectedBase && 'submissionKey' in input
    ? { assetId: input.expectedBase.assetId, submissionKey: input.submissionKey } : null);
  if (!identity.success) throw invalid();
  let receipt;
  try {
    receipt = reviewRevisionNativeReceipt.parse(await commands[kind].create(input, access.user.id));
    if (receipt.assetId !== identity.data.assetId) throw new Error('Receipt asset mismatch');
  } catch (error) {
    if (error instanceof PipelineRegistryCommandError && error.status < 500) throw error;
    return reviewRevisionResult.parse({ ...identity.data, receipt: null, outcome: 'uncertain', committed: null, activityRecorded: null, warnings: ['The review outcome is unconfirmed. Read the exact actor-bound receipt with the retained asset ID and submission key. Preserve the saved payload and key; do not replay automatically or invent a new key.'], retryable: false, nextAction: 'read' });
  }
  let activityRecorded = false;
  try { activityRecorded = Boolean(await recordOwnerActivity({ actorUserId: access.user.id, actorEmail: access.email,
    action: kind === 'template' ? 'library.template.review_revision' : 'library.style.review_revision', targetType: 'contributor_asset_revision', targetId: receipt.id,
    summary: `Created or recovered a same-lineage ${kind === 'template' ? 'Template' : 'Style'} review revision. Published content is unchanged.` })); } catch { /* Receipt is authoritative even if audit is unavailable. */ }
  return reviewRevisionResult.parse({ ...identity.data, receipt, outcome: 'committed', committed: true, activityRecorded,
    warnings: activityRecorded ? [] : ['Review revision receipt is confirmed; audit activity is incomplete. Read the retained receipt rather than repeating the creation.'], retryable: false, nextAction: activityRecorded ? 'none' : 'read' });
}
