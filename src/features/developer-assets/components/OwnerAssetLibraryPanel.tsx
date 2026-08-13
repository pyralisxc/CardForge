"use client";

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DEVELOPER_ASSET_STATUSES,
  DEVELOPER_ASSET_TYPES,
  type DeveloperAssetAccessTier,
  type DeveloperAssetAccessTierOverride,
  type DeveloperAssetStatus,
  type DeveloperAssetType,
} from '@/features/developer-assets/lib/developerAssets';
import type { DeveloperAssetProgramView } from '@/features/developer-assets/lib/developerAssetStore';
import { buildOwnerAssetLibraryPage } from '@/features/developer-assets/lib/ownerAssetLibrary';
import {
  getDeveloperAssetStatusLabel,
  getDeveloperAssetTierLabel,
  getDeveloperAssetTypeLabel,
} from '@/features/developer-assets/lib/pipelineAssetTaxonomy';

const tierClasses: Record<DeveloperAssetAccessTier, string> = {
  hidden: 'border-[#4a3823] text-[#8f95a3]',
  free: 'border-[#5f7f54] text-[#bde3a8]',
  paid: 'border-[#8a642f] text-[#f0c568]',
  developer: 'border-[#35445a] text-[#b9d5ff]',
};

const getContributorLabel = (
  developerId: string,
  developerEmail: string | null,
  developerName?: string | null,
): string => developerName || developerEmail || developerId;

interface OwnerAssetLibraryPanelProps {
  program: DeveloperAssetProgramView;
  updatingSubmissionId: string | null;
  onUpdateStatus: (
    submissionId: string,
    status: DeveloperAssetStatus,
    ownerAccessTierOverride?: DeveloperAssetAccessTierOverride | null,
    ownerNote?: string,
  ) => Promise<void>;
}

export function OwnerAssetLibraryPanel({
  program,
  updatingSubmissionId,
  onUpdateStatus,
}: OwnerAssetLibraryPanelProps) {
  const [ownerNote, setOwnerNote] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeveloperAssetStatus | 'all'>('all');
  const [assetTypeFilter, setAssetTypeFilter] = useState<DeveloperAssetType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const statusCounts = DEVELOPER_ASSET_STATUSES.reduce<Record<DeveloperAssetStatus, number>>((counts, status) => {
    counts[status] = program.submissions.filter((submission) => submission.status === status).length;
    return counts;
  }, {} as Record<DeveloperAssetStatus, number>);
  const assetTypeCounts = DEVELOPER_ASSET_TYPES.reduce<Record<DeveloperAssetType, number>>((counts, assetType) => {
    counts[assetType] = program.submissions.filter((submission) => submission.assetType === assetType).length;
    return counts;
  }, {} as Record<DeveloperAssetType, number>);
  const library = buildOwnerAssetLibraryPage(program.submissions, {
    assetType: assetTypeFilter,
    status: statusFilter,
    query: search,
    page,
  });
  const updateStatus = (
    submissionId: string,
    status: DeveloperAssetStatus,
    ownerAccessTierOverride?: DeveloperAssetAccessTierOverride | null,
  ) => onUpdateStatus(submissionId, status, ownerAccessTierOverride, ownerNote);

  return (
    <div className="mt-7 grid gap-3 lg:grid-cols-[1fr_18rem]">
      <div>
        <h3 className="font-serif text-xl text-[#fff1c7]">Asset library &amp; review</h3>
        <p className="mt-2 text-sm leading-6 text-[#c7b288]">
          Search every pipeline asset, narrow the library by type or status, and review one page at a time. Archive is the normal remove-from-active-use path; Reject closes spam, rights problems, or unusable submissions.
        </p>
        <div className="mt-4 grid gap-3 border border-[#3c2c1b] bg-[#100c08] p-3 md:grid-cols-[minmax(14rem,1fr)_minmax(12rem,0.7fr)_minmax(12rem,0.7fr)]">
          <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
            Search library
            <span className="flex items-center border border-[#5f4526] bg-[#0c0b09] px-3 focus-within:border-[#d8b365]">
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Asset, contributor, or catalog id"
                className="min-w-0 flex-1 bg-transparent p-2 text-sm normal-case tracking-normal text-[#ffe7ad] outline-none placeholder:text-[#6f624d]"
              />
            </span>
          </label>
          <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
            Asset type
            <select
              value={assetTypeFilter}
              onChange={(event) => {
                setAssetTypeFilter(event.target.value as DeveloperAssetType | 'all');
                setPage(1);
              }}
              className="border border-[#5f4526] bg-[#0c0b09] p-2 text-sm normal-case tracking-normal text-[#ffe7ad] outline-none focus:border-[#d8b365]"
            >
              <option value="all">All types ({program.submissions.length})</option>
              {DEVELOPER_ASSET_TYPES.map((assetType) => (
                <option key={assetType} value={assetType}>
                  {getDeveloperAssetTypeLabel(assetType)} ({assetTypeCounts[assetType]})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
            Pipeline status
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as DeveloperAssetStatus | 'all');
                setPage(1);
              }}
              className="border border-[#5f4526] bg-[#0c0b09] p-2 text-sm normal-case tracking-normal text-[#ffe7ad] outline-none focus:border-[#d8b365]"
            >
              <option value="all">All statuses ({program.submissions.length})</option>
              {DEVELOPER_ASSET_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {getDeveloperAssetStatusLabel(status)} ({statusCounts[status]})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#a98a55]" aria-live="polite">
          <p>
            Showing {library.firstItemNumber}-{library.lastItemNumber} of {library.totalItems} matching assets
            {library.totalItems === program.submissions.length ? '.' : ` (${program.submissions.length} total in the pipeline).`}
          </p>
          <p>Page {library.page} of {library.totalPages}</p>
        </div>
        <div className="mt-4 space-y-3">
          {library.items.length === 0 ? (
            <p className="border border-[#3c2c1b] bg-[#100c08] p-4 text-sm text-[#c7b288]">No pipeline assets match these filters. Clear the search or choose another type or status.</p>
          ) : library.items.map((submission) => {
            const isUpdatingSubmission = updatingSubmissionId === submission.id;

            return (
              <div key={submission.id} className="grid gap-3 border border-[#4a3823] bg-[#0c0b09] p-3 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[#ffe7ad]">{submission.name}</p>
                    <span className="border border-[#5f4526] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#d7b469]">
                      {getDeveloperAssetStatusLabel(submission.status)}
                    </span>
                    <span className="border border-[#35445a] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#b9d5ff]">
                      {getDeveloperAssetTypeLabel(submission.assetType, { plural: false })}
                    </span>
                    <span className={`border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${tierClasses[submission.calculatedAccessTier]}`}>
                      {getDeveloperAssetTierLabel(submission.calculatedAccessTier)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#c7b288]">
                    {getContributorLabel(submission.developerId, submission.developerEmail, submission.developerDisplayName)} - +{submission.positiveVotes} / -{submission.negativeVotes} - quality {submission.qualityScore}%
                  </p>
                  <p className="mt-1 text-xs text-[#a98a55]">
                    {(submission.tierDecisionReason ?? submission.decisionReason ?? 'developer_review').replaceAll('_', ' ')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {submission.status === 'archived' ? (
                    <Button size="sm" variant="outline" className="border-[#5f7f54] bg-transparent text-[#bde3a8]" disabled={isUpdatingSubmission} onClick={() => updateStatus(submission.id, 'voting')} aria-label={`Recover ${submission.name} to review`}>
                      {isUpdatingSubmission ? 'Updating...' : 'Recover to Review'}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="border-[#8c6436] bg-transparent text-[#f0bd75]" disabled={isUpdatingSubmission} onClick={() => updateStatus(submission.id, 'archived')} aria-label={`Archive ${submission.name}`}>
                      {isUpdatingSubmission ? 'Updating...' : 'Archive'}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="border-[#5f7f54] bg-transparent text-[#bde3a8]" disabled={isUpdatingSubmission} onClick={() => updateStatus(submission.id, 'published')} aria-label={`Publish ${submission.name}`}>Publish Live</Button>
                  <Button size="sm" variant="outline" className="border-[#7d3d32] bg-transparent text-[#ffd0c6]" disabled={isUpdatingSubmission} onClick={() => updateStatus(submission.id, 'rejected')} aria-label={`Reject and close ${submission.name}`}>Reject / Close</Button>
                  <Button size="sm" variant="outline" className="border-[#5f7f54] bg-transparent text-[#bde3a8]" disabled={isUpdatingSubmission} onClick={() => updateStatus(submission.id, submission.status, 'free')} aria-label={`Set ${submission.name} to Starter tier`}>Set Starter</Button>
                  <Button size="sm" variant="outline" className="border-[#8a642f] bg-transparent text-[#f0c568]" disabled={isUpdatingSubmission} onClick={() => updateStatus(submission.id, submission.status, 'paid')} aria-label={`Set ${submission.name} to Creator Pass tier`}>Set Creator Pass</Button>
                  <Button size="sm" variant="outline" className="border-[#4a3823] bg-transparent text-[#8f95a3]" disabled={isUpdatingSubmission} onClick={() => updateStatus(submission.id, submission.status, 'hidden')} aria-label={`Set ${submission.name} to Not Live tier`}>Set Not Live</Button>
                  {submission.ownerAccessTierOverride ? (
                    <Button size="sm" variant="outline" className="border-[#5f4526] bg-transparent text-[#c7b288]" disabled={isUpdatingSubmission} onClick={() => updateStatus(submission.id, submission.status, null)} aria-label={`Clear tier override for ${submission.name}`}>Clear Override</Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {library.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#3c2c1b] pt-4">
            <Button type="button" size="sm" variant="outline" className="rounded-none border-[#5f4526] bg-transparent text-[#ffe7ad]" disabled={library.page <= 1} onClick={() => setPage(library.page - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Previous
            </Button>
            <span className="text-xs text-[#a98a55]">{library.firstItemNumber}-{library.lastItemNumber} of {library.totalItems}</span>
            <Button type="button" size="sm" variant="outline" className="rounded-none border-[#5f4526] bg-transparent text-[#ffe7ad]" disabled={library.page >= library.totalPages} onClick={() => setPage(library.page + 1)}>
              Next <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </div>
      <label className="grid content-start gap-2 text-sm text-[#c7b288]">
        Owner note for status changes
        <textarea className="min-h-32 border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={ownerNote} onChange={(event) => setOwnerNote(event.target.value)} />
      </label>
    </div>
  );
}
