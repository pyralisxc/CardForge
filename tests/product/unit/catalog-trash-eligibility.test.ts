import { describe, expect, it } from 'vitest';
import { decideCatalogTrash, type CatalogTrashObserved } from '@/features/pipeline/lib/catalogTrashEligibility';
const identity = { lineageId: 'lineage', submissionId: 'revision', registrySubmissionId: 'revision', revisionHighWater: 3 };
const observed: CatalogTrashObserved = { ...identity, inventoryComplete: true, destructiveAttemptUncertain: false, liveManagedReferences: [], invalidatedManagedReferences: [], hasNewerRevision: false, held: false, claimToken: null, trashDeadline: null };
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
    expect(decideCatalogTrash('expire',identity,state,now).reasons).toEqual(['catalog_physical_expiry_unavailable','catalog_retention_hold','live_managed_dependency:published-set']);
  });
  it('fences concurrent cleanup and newer revisions on restore', () => {
    const state = {...observed,trashDeadline:'2026-10-27T00:00:00Z',claimToken:'claimed',revisionHighWater:4,hasNewerRevision:true};
    expect(decideCatalogTrash('restore',identity,state,now).reasons).toContain('catalog_cleanup_already_claimed');
    expect(decideCatalogTrash('restore',identity,state,now).reasons).toContain('exact_catalog_identity_changed');
  });
  it('does not advertise physical expiry even after the deadline', () => {
    expect(decideCatalogTrash('expire',identity,{...observed,trashDeadline:'2026-10-27T00:00:00Z'},now).eligible).toBe(false);
    expect(decideCatalogTrash('expire',identity,{...observed,trashDeadline:'2026-10-25T00:00:00Z'},now).eligible).toBe(false);
  });
  it('blocks an inaccessible external JSON inventory instead of treating it as empty', () => {
    expect(decideCatalogTrash('trash',identity,{...observed,inventoryComplete:false},now).reasons).toContain('managed_inventory_unavailable');
  });
  it('blocks independent Studio identity consumers that would lose resolution', () => {
    expect(decideCatalogTrash('trash',identity,{...observed,invalidatedManagedReferences:['studio-document:independent']},now).eligible).toBe(false);
  });
  it('does not infer safety from an absent token after an uncertain old attempt', () => {
    for (const action of ['trash','restore','hold'] as const) {
      expect(decideCatalogTrash(action,identity,{...observed,destructiveAttemptUncertain:true,trashDeadline:action==='trash'?null:'2026-10-25T00:00:00Z'},now).reasons)
        .toContain('catalog_destructive_attempt_unreconciled');
    }
  });
  it('fails closed for invalid expiry deadline and invalid current time', () => {
    expect(decideCatalogTrash('expire',identity,{...observed,trashDeadline:'not-a-date'},now).reasons).toContain('invalid_catalog_deadline');
    expect(decideCatalogTrash('expire',identity,{...observed,trashDeadline:'2026-10-25T00:00:00Z'},new Date(NaN)).reasons).toContain('invalid_current_time');
  });
});
