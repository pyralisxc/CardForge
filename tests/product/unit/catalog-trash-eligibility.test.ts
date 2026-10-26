import { describe, expect, it } from 'vitest';
import { decideCatalogTrash, type CatalogTrashObserved } from '@/features/pipeline/lib/catalogTrashEligibility';
const identity = { lineageId: 'lineage', submissionId: 'revision', registrySubmissionId: 'revision', revisionHighWater: 3 };
const observed: CatalogTrashObserved = { ...identity, liveManagedReferences: [], invalidatedManagedReferences: [], hasNewerRevision: false, held: false, claimToken: null, trashDeadline: null };
const now = new Date('2026-10-26T00:00:00Z');
describe('whole-catalog Trash preflight (database must recheck under lock)', () => {
  it('blocks Trash if a managed consumer would break', () => {
    expect(decideCatalogTrash('trash', identity, {...observed, invalidatedManagedReferences:['published-template']}, now)).toEqual({eligible:false,reasons:['managed_consumer_would_break:published-template']});
  });
  it('does not treat embedded hashes as catalog identities', () => {
    expect(decideCatalogTrash('trash', {...identity, lineageId:'clash-hash'}, observed, now).eligible).toBe(false);
  });
  it('allows hidden recoverable Trash even with a consumer that stays valid', () => {
    expect(decideCatalogTrash('trash', identity, {...observed,liveManagedReferences:['installed-managed-set']},now).eligible).toBe(true);
  });
  it('never expires a held or referenced catalog', () => {
    const state = {...observed, trashDeadline:'2026-10-25T00:00:00Z',held:true,liveManagedReferences:['published-set']};
    expect(decideCatalogTrash('expire',identity,state,now).reasons).toEqual(['catalog_retention_hold','live_managed_dependency:published-set']);
  });
  it('fences concurrent cleanup and newer revisions on restore', () => {
    const state = {...observed,trashDeadline:'2026-10-27T00:00:00Z',claimToken:'claimed',revisionHighWater:4,hasNewerRevision:true};
    expect(decideCatalogTrash('restore',identity,state,now).reasons).toContain('catalog_cleanup_already_claimed');
    expect(decideCatalogTrash('restore',identity,state,now).reasons).toContain('exact_catalog_identity_changed');
  });
  it('rejects a future deadline and permits past deadline only without blockers', () => {
    expect(decideCatalogTrash('expire',identity,{...observed,trashDeadline:'2026-10-27T00:00:00Z'},now).eligible).toBe(false);
    expect(decideCatalogTrash('expire',identity,{...observed,trashDeadline:'2026-10-25T00:00:00Z'},now).eligible).toBe(true);
  });
});
