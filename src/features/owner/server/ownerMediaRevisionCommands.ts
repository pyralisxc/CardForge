import { AccountToolAccessError, getAccountToolAccessForUserId } from '@/features/account/server';
import { readMediaPresentationRevision, readMediaPresentationReceipt, createMediaPresentationRevision, PipelineRegistryCommandError, mediaRevisionBaseInput, mediaRevisionAttemptInput, mediaRevisionBaseOutput, mediaRevisionReceiptOutput, mediaRevisionCommandResult } from '@/features/pipeline/server';
import { recordOwnerActivity } from './ownerActivityStore';

async function owner(actorUserId: string) {
  const access = await getAccountToolAccessForUserId(actorUserId);
  if (!access.isOwner) throw new AccountToolAccessError('Owner access is required for managed texture presentation reviews.', 403);
  return access;
}
const invalid = () => new PipelineRegistryCommandError('Provide the exact managed texture identity, UUID key and saved presentation.', 400, 'pipeline_media_invalid');
export async function getOwnerMediaRevisionBase(actorUserId: string, input: unknown) {
  await owner(actorUserId); const parsed = mediaRevisionBaseInput.safeParse(input); if (!parsed.success) throw invalid();
  const result = mediaRevisionBaseOutput.parse(await readMediaPresentationRevision(parsed.data.assetId));
  if (result.assetId !== parsed.data.assetId) throw new PipelineRegistryCommandError('The exact managed texture base could not be verified.', 503, 'pipeline_media_unavailable');
  return result;
}
export async function getOwnerMediaRevisionReceipt(actorUserId: string, input: unknown) {
  await owner(actorUserId); const parsed = mediaRevisionAttemptInput.safeParse(input); if (!parsed.success) throw invalid();
  return mediaRevisionReceiptOutput.parse(await readMediaPresentationReceipt(parsed.data));
}
export async function createOwnerMediaRevision(actorUserId: string, input: unknown) {
  const access = await owner(actorUserId); const parsed = mediaRevisionAttemptInput.safeParse(input); if (!parsed.success) throw invalid();
  const { assetId, submissionKey } = parsed.data; let saved;
  try { saved = await createMediaPresentationRevision(parsed.data); }
  catch (error) {
    if (error instanceof PipelineRegistryCommandError && error.status < 500) throw error;
    return mediaRevisionCommandResult.parse({ assetId, submissionKey, receipt: null, outcome: 'uncertain', committed: null, activityRecorded: null, reused: null, cleanupPending: null, retryable: false, nextAction: 'read', warnings: ['The media revision outcome is unconfirmed. Read the exact receipt with the retained asset ID, UUID key and presentation. Do not copy or replay automatically. Copy cleanup state is unavailable. The native service retains any copy whose commit is uncertain.'] });
  }
  const receipt = { id: saved.id, assetId, revisionNumber: saved.revisionNumber, status: saved.status, editorialReviewStatus: saved.editorialReviewStatus };
  let activityRecorded = false;
  try { activityRecorded = Boolean(await recordOwnerActivity({ actorUserId: access.user.id, actorEmail: access.email, action: 'library.asset.presentation_revision', targetType: 'contributor_asset_revision', targetId: receipt.id, summary: 'Created or recovered a pending media presentation revision. Published content is unchanged.' })); } catch { /* Confirmed native receipt remains authoritative. */ }
  const warnings = [...(activityRecorded ? [] : ['Media revision receipt is confirmed; Owner activity recording is incomplete. Read the receipt rather than repeating creation.']), ...(saved.cleanupPending ? ['An unused copy from this invocation needs cleanup. This flag does not describe earlier orphan copies.'] : [])];
  return mediaRevisionCommandResult.parse({ assetId, submissionKey, receipt, outcome: 'committed', committed: true, activityRecorded, reused: saved.reused, cleanupPending: saved.cleanupPending, warnings, retryable: false, nextAction: warnings.length ? 'read' : 'none' });
}
