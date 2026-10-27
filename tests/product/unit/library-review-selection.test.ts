import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createPipelineReviewTarget, resolvePipelineReviewTarget, verifyReviewPublication } from '@/features/pipeline/lib/pipelineReviewTarget';
import { libraryReviewSelection, canEditSelectedContribution } from '@/features/storage-management/lib/libraryReviewSelection';
import { PipelineDetailContent, createLibraryReviewAction, getSharedLibraryActions } from '@/features/storage-management/components/LibraryObjectPresentation';
import { isActionApplicable } from '@/features/app-shell/environment/model';
import type { PipelineSubmission } from '@/features/pipeline/client';
import type { LibraryViewItem } from '@/features/storage-management/components/LibraryObjectPresentation';
const row = { id: 'r1', registryAssetId: 'material', targetRegistryAssetId: null, lineageId: 'lineage', revisionNumber: 1,
  status: 'published', publishedAt: '2026-01-01', updatedAt: '2026-01-01' } as PipelineSubmission;
const pipeline = (selected = row, own = true, editable = selected) => ({ scope: 'pipeline', pipeline: {
  submission: selected, ownership: own ? 'mine' : 'other', editableSubmission: editable,
} }) as LibraryViewItem;
describe('Library exact review selection', () => {
  it('retains a historical selection even when a newer revision is first', () => {
    const target = createPipelineReviewTarget(row)!;
    expect(resolvePipelineReviewTarget(target, [{ ...row, id: 'r2', revisionNumber: 2 }, row])).toBe(row);
    expect(libraryReviewSelection(pipeline(), [])).toEqual(target);
  });
  it.each(['lineageId', 'revisionNumber', 'status', 'publishedAt', 'updatedAt', 'registryAssetId'] as const)('rejects changed %s rather than adopting latest', field => {
    expect(() => resolvePipelineReviewTarget(createPipelineReviewTarget(row)!, [{ ...row, [field]: 'changed' } as PipelineSubmission])).toThrow('changed');
  });
  it('rejects missing exact identity', () => {
    expect(() => resolvePipelineReviewTarget(createPipelineReviewTarget(row)!, [{ ...row, id: 'other' }])).toThrow('unavailable');
    expect(createPipelineReviewTarget({ ...row, lineageId: undefined })).toBeNull();
  });
  it('resolves Published only with matching registry, lineage and revision', () => {
    const item = { scope: 'published', published: { id: 'published:elementPreset:material', lineageId: 'lineage', revision: 1, publicationIdentity: { assetId: 'material', submissionId: 'r1', updatedAt: '2026-01-01' } } } as LibraryViewItem;
    expect(libraryReviewSelection(item, [row])?.submissionId).toBe('r1');
    expect(libraryReviewSelection(item, [{ ...row, revisionNumber: 2 }])).toBeNull();
    expect(libraryReviewSelection(item, [{ ...row, registryAssetId: 'other' }])).toBeNull();
  });
  it('keeps Contributor editing on their selected editable revision only', () => {
    expect(canEditSelectedContribution(pipeline())).toBe(true);
    expect(canEditSelectedContribution(pipeline(row, false))).toBe(false);
    expect(canEditSelectedContribution(pipeline(row, true, { ...row, id: 'other' }))).toBe(false);
  });
});

describe('contextual review action uses native applicability', () => {
  it.each(['pipeline-asset', 'published-asset'])('applies to selected %s for Owner only', objectKind => {
    const action = createLibraryReviewAction();
    const context = { objectKind, sources: [{ id: 'native', label: 'Native', source: 'provider-native' as const, currentRevisionAvailable: true }], viewer: { signedIn: true, owner: true, contributor: true } };
    expect(isActionApplicable(action, context)).toBe(true);
    expect(isActionApplicable(action, { ...context, viewer: { signedIn: true, owner: false, contributor: true } })).toBe(false);
    expect(isActionApplicable(action, { ...context, viewer: { signedIn: false, owner: false, contributor: false } })).toBe(false);
  });
  it('does not offer another Contributor or different revision edit', () => {
    expect(getSharedLibraryActions(pipeline(row, false) as never).some(a => a.id === 'library.edit-pipeline')).toBe(false);
    expect(getSharedLibraryActions(pipeline(row, true, { ...row, id: 'other' }) as never).some(a => a.id === 'library.edit-pipeline')).toBe(false);
    expect(getSharedLibraryActions(pipeline() as never).some(a => a.id === 'library.edit-pipeline')).toBe(true);
  });
});

describe('Published registry selection pin', () => {
  const target = { ...createPipelineReviewTarget(row)!, catalogPublication: { submissionId: row.id, updatedAt: 'registry-epoch' } };
  const published = { id: 'material', lineageId: 'lineage', submissionId: row.id, updatedAt: 'registry-epoch' };
  it('accepts the same explicit registry publication and submission', () => {
    expect(() => verifyReviewPublication(target, [published] as never)).not.toThrow();
    expect(resolvePipelineReviewTarget(target, [row])).toBe(row);
  });
  it.each(['submissionId', 'lineageId', 'updatedAt'])('blocks changed registry %s', field => {
    expect(() => verifyReviewPublication(target, [{ ...published, [field]: 'changed' }] as never)).toThrow('publication changed');
  });
  it('blocks missing registry publication', () => expect(() => verifyReviewPublication(target, [])).toThrow('unavailable'));
});

describe('own Contributor pending history entry', () => {
  const published = { ...row, name: 'Published', specialtyTags: [], useCaseTags: [], sourceNotes: '', status: 'published' as const };
  const candidate = { ...published, id: 'r2', revisionNumber: 2, status: 'draft' as const, publishedAt: null };
  const item = (ownership: string) => ({ scope: 'pipeline', pipeline: { submission: published, currentPublishedSubmission: published,
    revisions: [published, candidate], editableSubmission: candidate, ownership, reviewSubmission: null } }) as unknown as LibraryViewItem;
  const markup = (ownership: string) => renderToStaticMarkup(createElement(PipelineDetailContent, { item: item(ownership) as never,
    canReview: false, votingId: null, isSelfVoteBlocked: () => false, onVoteRevision: () => {}, onEditRevision: () => {} }));
  it('keeps the displayed published identity and explicitly names the owned pending revision for editing', () => {
    expect(getSharedLibraryActions(item('mine') as never).some(a => a.id === 'library.edit-pipeline')).toBe(false);
    expect(markup('mine')).toContain('Edit Revision 2');
    expect(markup('mine')).not.toContain('Edit Revision 1');
  });
  it('does not offer editing another Contributor history', () => expect(markup('other')).not.toContain('Edit Revision 2'));
});
