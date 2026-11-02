import { AccountToolAccessError, getAccountToolAccessForUserId } from '@/features/account/server';
import { ownerStudioDependencyInput, ownerStudioDependencyAcknowledgement, ownerStudioDependencyResult, readOwnerStudioDocumentDependencies, reconcileOwnerStudioDocumentDependencies, StudioDocumentStoreError } from '@/features/studio-documents/server';
import { recordOwnerActivity } from './ownerActivityStore';
async function target(actorUserId: string, input: unknown) {
  const access = await getAccountToolAccessForUserId(actorUserId);
  if (!access.isOwner) throw new AccountToolAccessError('Owner access is required for Studio dependency metadata.', 403);
  const parsed = ownerStudioDependencyInput.safeParse(input);
  if (!parsed.success) throw new StudioDocumentStoreError('An exact document UUID and positive expectedRevision are required; no payload, owner or source list is accepted.', 400);
  return { access, ...parsed.data };
}
export async function getOwnerStudioDependencies(actorUserId: string, input: unknown) {
  const { documentId, expectedRevision } = await target(actorUserId, input);
  return readOwnerStudioDocumentDependencies(documentId, expectedRevision);
}
export async function reconcileOwnerStudioDependencies(actorUserId: string, input: unknown) {
  const { access, documentId, expectedRevision } = await target(actorUserId, input);
  let acknowledgement;
  try {
    acknowledgement = ownerStudioDependencyAcknowledgement.parse(await reconcileOwnerStudioDocumentDependencies(documentId, expectedRevision));
    if (acknowledgement.documentId !== documentId || acknowledgement.revision !== expectedRevision) throw new Error('Acknowledgement identity mismatch');
  }
  catch (error) {
    if (error instanceof StudioDocumentStoreError && error.status < 500) throw error;
    return ownerStudioDependencyResult.parse({ documentId, revision: expectedRevision, contractVersion: null, complete: null, opaqueReasons: [], snapshot: null,
      receipt: { outcome: 'uncertain', committed: null, readbackComplete: false, activityRecorded: null, warnings: ['Reconciliation is unconfirmed. Read exact persisted metadata before any further write; do not replay. Matching state does not prove this operation committed.'], retryable: false, nextAction: 'read' } });
  }
  const warnings: string[] = []; let snapshot = null;
  try { snapshot = await readOwnerStudioDocumentDependencies(documentId, expectedRevision); if (snapshot.state === 'absent' || snapshot.state === 'stale' || snapshot.complete !== acknowledgement.complete) warnings.push('Reconciliation committed; current metadata differs from its acknowledgement. Inspect current state, never replay this committed operation.'); }
  catch { warnings.push('Reconciliation committed; exact persisted readback is unavailable or its revision changed.'); }
  let activityRecorded = false;
  try { activityRecorded = (await recordOwnerActivity({ actorUserId: access.user.id, actorEmail: access.email, action: 'studio.dependencies.reconcile', targetType: 'studio_document', targetId: documentId, summary: 'Reconciled exact Studio dependency metadata.', metadata: { revision: expectedRevision, complete: acknowledgement.complete } })) === true; } catch { /* Native acknowledgement remains authoritative. */ }
  if (!activityRecorded) warnings.push('Reconciliation committed; Owner activity is incomplete. Do not repeat the committed operation.');
  return ownerStudioDependencyResult.parse({ ...acknowledgement, snapshot, receipt: { outcome: 'committed', committed: true, readbackComplete: snapshot !== null, activityRecorded, warnings, retryable: false, nextAction: warnings.length ? 'read' : 'none' } });
}
