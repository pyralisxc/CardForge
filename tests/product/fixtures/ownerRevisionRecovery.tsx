import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OwnerAssetLibraryPanel } from '@/features/pipeline/components/OwnerAssetLibraryPanel';
import { PIPELINE_STATUSES, PIPELINE_TYPES } from '@/features/pipeline/lib/pipelineItems';
import type { PipelineProgramView } from '@/features/pipeline/lib/pipelineProgram';
import { identityProgram, identitySubmission } from './libraryTemplateIdentityData';
const id = '00000000-0000-4000-8000-000000000001';
function Fixture() {
  const [refreshes, setRefreshes] = useState(0);
  const trashed = refreshes % 2 === 1;
  const row = identitySubmission(id, { assetType: 'icons', semanticRole: 'icon', requestedStudioDestination: 'element.icon',
    name: 'Owner recovery projection', status: refreshes === 0 ? 'voting' : 'archived', publishedAt: null,
    trashedAt: trashed ? '2026-10-31T18:00:00Z' : null, purgeAfter: trashed ? '2026-11-30T18:00:00Z' : null });
  const program = { ...identityProgram([row], 'native-owner'), configured: true,
    submissionPage: { page: 1, pageSize: 50, total: 1 }, managedStorageBytes: 0, managedFileCount: 0, totalSubmissionCount: 1,
    submissionStatusCounts: Object.fromEntries(PIPELINE_STATUSES.map(status => [status, row.status === status ? 1 : 0])),
    submissionTypeCounts: Object.fromEntries(PIPELINE_TYPES.map(type => [type, type === 'icons' ? 1 : 0])),
  } as unknown as PipelineProgramView;
  return <OwnerAssetLibraryPanel focused program={program} query="" assetTypeFilter="all" statusFilter="all" page={1}
    renderTemplateSpecimen={async () => new Blob()} updatingSubmissionId={null}
    onQueryChange={() => undefined} onAssetTypeFilterChange={() => undefined} onStatusFilterChange={() => undefined} onPageChange={() => undefined}
    onUpdateOverride={async () => false} onUpdateEditorialReview={async () => false}
    onDeletePermanently={async () => undefined} onDeleteRevisionNow={async () => undefined}
    onRevisionCreated={() => { setRefreshes(value => value + 1); }} />;
}
const target = document.createElement('main'); document.body.replaceChildren(target); createRoot(target).render(<Fixture />);
