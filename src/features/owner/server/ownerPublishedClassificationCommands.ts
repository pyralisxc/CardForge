import { AccountToolAccessError, getAccountToolAccessForUserId } from '@/features/account/server';
import { classifyPublishedPipelineAsset, readPublishedPipelineClassification, revalidateCardForgeCatalog, PipelineRegistryCommandError,
  publishedClassificationReadInput, publishedClassificationInput, publishedClassificationSnapshot, publishedClassificationResult } from '@/features/pipeline/server';

async function requireOwner(actorUserId: string) {
  const access = await getAccountToolAccessForUserId(actorUserId);
  if (!access.isOwner) throw new AccountToolAccessError('Owner access is required to classify published content.', 403);
}
async function readExact(assetId: string) {
  const result = publishedClassificationSnapshot.safeParse(await readPublishedPipelineClassification(assetId));
  if (!result.success || result.data.assetId !== assetId) throw new PipelineRegistryCommandError('Exact published classification could not be verified.', 503, 'pipeline_classification_unavailable');
  return result.data;
}
export async function getOwnerPublishedClassification(actorUserId: string, input: unknown) {
  await requireOwner(actorUserId);
  const parsed = publishedClassificationReadInput.safeParse(input);
  if (!parsed.success) throw new PipelineRegistryCommandError('Choose one exact published asset.', 400, 'pipeline_classification_invalid');
  return readExact(parsed.data.assetId);
}
export async function saveOwnerPublishedClassification(actorUserId: string, input: unknown) {
  await requireOwner(actorUserId);
  const parsed = publishedClassificationInput.safeParse(input);
  if (!parsed.success) throw new PipelineRegistryCommandError('Provide the exact published identity and supported classification.', 400, 'pipeline_classification_invalid');
  const value = parsed.data;
  const identity = { assetId: value.assetId, expectedSubmissionId: value.expectedSubmissionId, expectedLineageId: value.expectedLineageId, expectedRevision: value.expectedRevision };
  let committed: true | null = null;
  const warnings: string[] = [];
  try {
    await classifyPublishedPipelineAsset(value);
    // The locked native command acknowledged commit before any derived refresh/readback.
    committed = true;
  } catch (error) {
    if (error instanceof PipelineRegistryCommandError && error.status < 500) throw error;
    warnings.push('Native classification outcome is unconfirmed. Read exact current state before any further write; do not replay automatically.');
  }
  if (committed) {
    try { if (!revalidateCardForgeCatalog()) warnings.push('Classification committed; catalog refresh is incomplete.'); }
    catch { warnings.push('Classification committed; catalog refresh is incomplete.'); }
  }
  let snapshot = null;
  try {
    const observed = await readExact(value.assetId);
    if (observed.expectedSubmissionId !== value.expectedSubmissionId || observed.expectedLineageId !== value.expectedLineageId || observed.expectedRevision !== value.expectedRevision) {
      warnings.push('Current publication changed during readback. Read its exact identity before any further edit; no sibling was substituted.');
    } else snapshot = observed;
  }
  catch { warnings.push('Exact classification readback is unavailable.'); }
  // Matching current state is observation only and cannot turn a lost acknowledgement into a commit receipt.
  return publishedClassificationResult.parse({ snapshot, receipt: { ...identity, committed, outcome: committed ? 'committed' : 'uncertain',
    refreshComplete: warnings.length === 0, warnings, retryable: false, nextAction: warnings.length || !committed ? 'read' : 'none' } });
}
