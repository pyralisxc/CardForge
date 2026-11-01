import { describe, expect, it } from 'vitest';
import { getPipelineTrashState } from '@/features/pipeline/lib/pipelineTrash';
import { mapPipelineSubmissionRow, type PipelineSubmissionRow } from '@/features/pipeline/lib/pipelineProgram';
import { isPipelineRevisionVisibleToContributor } from '@/features/pipeline/lib/pipelineVisibility';

const catalog = { catalogTrashedAt: '2026-11-01T00:00:00Z', catalogPurgeAfter: '2026-12-01T00:00:00Z', catalogRetentionHold: true, catalogSubmissionId: 'current-published' };
describe('protected effective Pipeline Trash projection', () => {
 it('preserves each clock and routes catalog recovery first when both owners apply', () => {
  const revision = { trashedAt: '2026-10-31T00:00:00Z', purgeAfter: '2026-11-30T00:00:00Z' };
  expect(getPipelineTrashState({ ...revision, ...catalog })).toMatchObject({ trashed: true, scope: 'catalog', catalogSubmissionId: 'current-published', held: true, trashedAt: catalog.catalogTrashedAt });
  expect(getPipelineTrashState(revision)).toMatchObject({ trashed: true, scope: 'revision', catalogSubmissionId: null, trashedAt: revision.trashedAt });
  expect(getPipelineTrashState({})).toMatchObject({ trashed: false, scope: null });
 });
 it('maps native lineage metadata without rewriting revision identity, status or dates', () => {
  const row = { id: 'historical', contributor_id: 'author', name: 'Historical', asset_type: 'icons', status: 'published',
   catalog_trashed_at: catalog.catalogTrashedAt, catalog_purge_after: catalog.catalogPurgeAfter,
   catalog_retention_hold: true, catalog_submission_id: catalog.catalogSubmissionId,
   catalog_source_published: true, published_at: null, revision_publication_retained: false, trashed_at: null,
  } as PipelineSubmissionRow;
  const result = mapPipelineSubmissionRow(row, {});
  expect(result).toMatchObject({ id: 'historical', status: 'published', trashedAt: null, publicationRetained: true, ...catalog });
 });
 it('does not expose private drafts or unknown archived siblings through shared catalog moderation', () => {
  const base = { contributorId: 'author', status: 'archived' as const, purgeState: null, viewerId: 'peer', contributor: true, owner: false, ...catalog };
  expect(isPipelineRevisionVisibleToContributor(base)).toBe(false);
  expect(isPipelineRevisionVisibleToContributor({ ...base, publicationRetained: true })).toBe(true);
  expect(isPipelineRevisionVisibleToContributor({ ...base, status: 'draft', publicationRetained: true })).toBe(false);
  expect(isPipelineRevisionVisibleToContributor({ ...base, viewerId: 'author' })).toBe(true);
 });
});
