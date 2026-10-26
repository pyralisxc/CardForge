/**
 * Whole-catalog Trash eligibility is lineage-scoped, not revision-scoped.
 * These checks are shared by the Owner/API/MCP preflight projections.
 * Database commands must recheck under locks; this is not mutation authority.
 */
export type CatalogTrashIdentity = {
  lineageId: string;
  submissionId: string;
  registrySubmissionId: string | null;
  revisionHighWater: number;
};
export type CatalogTrashObserved = CatalogTrashIdentity & {
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
  if (expected.lineageId !== observed.lineageId ||
      expected.submissionId !== observed.submissionId ||
      expected.registrySubmissionId !== observed.registrySubmissionId ||
      expected.revisionHighWater !== observed.revisionHighWater ||
      observed.hasNewerRevision) reasons.push('exact_catalog_identity_changed');
  if (observed.claimToken) reasons.push('catalog_cleanup_already_claimed');
  if (action === 'trash') {
    if (observed.trashDeadline) reasons.push('catalog_already_trashed');
    if (observed.invalidatedManagedReferences.length)
      reasons.push(...observed.invalidatedManagedReferences.map(id => 'managed_consumer_would_break:' + id));
  } else {
    if (!observed.trashDeadline) reasons.push('catalog_not_in_trash');
    if (action === 'expire') {
      if (observed.held) reasons.push('catalog_retention_hold');
      if (observed.trashDeadline && new Date(observed.trashDeadline).getTime() > now.getTime())
        reasons.push('catalog_recovery_window_open');
      if (observed.liveManagedReferences.length)
        reasons.push(...observed.liveManagedReferences.map(id => 'live_managed_dependency:' + id));
    }
    if (action === 'restore' && observed.trashDeadline &&
      new Date(observed.trashDeadline).getTime() <= now.getTime())
      reasons.push('recovery_deadline_elapsed_recheck_native_claim');
  }
  return { eligible: reasons.length === 0, reasons };
}
