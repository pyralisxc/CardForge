/**
 * Whole-catalog Trash eligibility is lineage-scoped, not revision-scoped.
 * Deterministic policy checks document the conservative preflight contract.
 * Database commands must recheck under locks; this is not mutation authority.
 */
export type CatalogTrashIdentity = {
  lineageId: string;
  submissionId: string;
  registrySubmissionId: string | null;
  revisionHighWater: number;
};
export type CatalogTrashObserved = CatalogTrashIdentity & {
  inventoryComplete: boolean;
  destructiveAttemptUncertain: boolean;
  liveManagedReferences: readonly string[];
  invalidatedManagedReferences: readonly string[];
  hasNewerRevision: boolean;
  held: boolean;
  claimToken: string | null;
  trashDeadline: string | null;
};
export type CatalogTrashDecision = {
  eligible: boolean;
  reasons: readonly string[];
};
export function decideCatalogTrash(
  action: 'trash' | 'restore' | 'hold' | 'expire',
  expected: CatalogTrashIdentity,
  observed: CatalogTrashObserved,
  now: Date,
): CatalogTrashDecision {
  const reasons: string[] = [];
  const nowTime = now.getTime();
  if (!Number.isFinite(nowTime)) reasons.push('invalid_current_time');
  const deadlineTime = observed.trashDeadline === null ? null : Date.parse(observed.trashDeadline);
  if (observed.trashDeadline !== null && !Number.isFinite(deadlineTime)) reasons.push('invalid_catalog_deadline');
  if (expected.lineageId !== observed.lineageId ||
      expected.submissionId !== observed.submissionId ||
      expected.registrySubmissionId !== observed.registrySubmissionId ||
      expected.revisionHighWater !== observed.revisionHighWater ||
      observed.hasNewerRevision) reasons.push('exact_catalog_identity_changed');
  if (observed.claimToken) reasons.push('catalog_cleanup_already_claimed');
  if (observed.destructiveAttemptUncertain) reasons.push('catalog_destructive_attempt_unreconciled');
  if ((action === 'trash' || action === 'expire') && !observed.inventoryComplete) reasons.push('managed_inventory_unavailable');
  if (action === 'trash') {
    if (observed.trashDeadline) reasons.push('catalog_already_trashed');
    if (observed.invalidatedManagedReferences.length)
      reasons.push(...observed.invalidatedManagedReferences.map(id => 'managed_consumer_would_break:' + id));
  } else {
    if (!observed.trashDeadline) reasons.push('catalog_not_in_trash');
    if (action === 'expire') {
      reasons.push('catalog_physical_expiry_unavailable');
      if (observed.held) reasons.push('catalog_retention_hold');
      if (observed.trashDeadline && Number.isFinite(deadlineTime) && deadlineTime! > nowTime)
        reasons.push('catalog_recovery_window_open');
      if (observed.liveManagedReferences.length)
        reasons.push(...observed.liveManagedReferences.map(id => 'live_managed_dependency:' + id));
    }

  }
  return { eligible: reasons.length === 0, reasons };
}
