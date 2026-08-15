"use client";

import { useState } from 'react';
import { Archive, ChevronLeft, ChevronRight, Eye, Pencil, Search, Settings2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AssetRow } from './DeveloperAssetRows';
import { useDeveloperTemplatePreviews } from './useDeveloperTemplatePreviews';
import {
  DEVELOPER_ASSET_STATUSES,
  DEVELOPER_ASSET_TYPES,
  type DeveloperAssetAccessTierOverride,
  type DeveloperAssetStatus,
  type DeveloperAssetType,
} from '../lib/developerAssets';
import type { DeveloperAssetProgramView } from '../lib/developerAssetProgram';
import {
  getDeveloperAssetStatusLabel,
  getDeveloperAssetTierLabel,
  getDeveloperAssetTypeLabel,
} from '../lib/pipelineAssetTaxonomy';

export interface OwnerAssetOverrideInput {
  ownerStatusOverride?: DeveloperAssetStatus | null;
  ownerAccessTierOverride?: DeveloperAssetAccessTierOverride | null;
  ownerNote: string;
}

interface OwnerAssetLibraryPanelProps {
  program: DeveloperAssetProgramView;
  query: string;
  assetTypeFilter: DeveloperAssetType | 'all';
  statusFilter: DeveloperAssetStatus | 'all';
  page: number;
  onQueryChange: (value: string) => void;
  onAssetTypeFilterChange: (value: DeveloperAssetType | 'all') => void;
  onStatusFilterChange: (value: DeveloperAssetStatus | 'all') => void;
  onPageChange: (page: number) => void;
  updatingSubmissionId: string | null;
  onUpdateOverride: (submissionId: string, input: OwnerAssetOverrideInput) => Promise<void>;
  onDeletePermanently: (submissionId: string, confirmationName: string) => Promise<void>;
}

const statusOptions: DeveloperAssetStatus[] = [
  'voting',
  'publish_candidate',
  'published',
  'archived',
  'rejected',
];

export function OwnerAssetLibraryPanel({
  program,
  query,
  assetTypeFilter,
  statusFilter,
  page,
  onQueryChange,
  onAssetTypeFilterChange,
  onStatusFilterChange,
  onPageChange,
  updatingSubmissionId,
  onUpdateOverride,
  onDeletePermanently,
}: OwnerAssetLibraryPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [statusOverride, setStatusOverride] = useState<DeveloperAssetStatus | 'automatic'>('automatic');
  const [tierOverride, setTierOverride] = useState<DeveloperAssetAccessTierOverride | 'automatic'>('automatic');
  const [ownerNote, setOwnerNote] = useState('');
  const templatePreviews = useDeveloperTemplatePreviews(program.submissions);
  const totalPages = Math.max(1, Math.ceil(program.submissionPage.total / program.submissionPage.pageSize));
  const currentPage = Math.min(page, totalPages);
  const firstItemNumber = program.submissionPage.total === 0
    ? 0
    : (currentPage - 1) * program.submissionPage.pageSize + 1;
  const lastItemNumber = Math.min(currentPage * program.submissionPage.pageSize, program.submissionPage.total);

  const openManager = (submission: DeveloperAssetProgramView['submissions'][number]) => {
    setManagingId(submission.id);
    setExpandedId(submission.id);
    setStatusOverride(submission.ownerStatusOverride ?? 'automatic');
    setTierOverride(submission.ownerAccessTierOverride ?? 'automatic');
    setOwnerNote(submission.ownerNote ?? '');
  };

  const saveOverride = async (submissionId: string) => {
    const nextStatus = statusOverride === 'automatic' ? null : statusOverride;
    if (
      (nextStatus === 'archived' || nextStatus === 'rejected')
      && !window.confirm(`Confirm ${nextStatus === 'rejected' ? 'closing' : 'retiring'} this asset. Its history will be preserved.`)
    ) return;
    await onUpdateOverride(submissionId, {
      ownerStatusOverride: nextStatus,
      ownerAccessTierOverride: tierOverride === 'automatic' ? null : tierOverride,
      ownerNote,
    });
    setManagingId(null);
  };

  const retireAsset = async (submission: DeveloperAssetProgramView['submissions'][number]) => {
    if (!window.confirm(`Retire “${submission.name}” from use while preserving its history?`)) return;
    await onUpdateOverride(submission.id, {
      ownerStatusOverride: 'archived',
      ownerNote: ownerNote || submission.ownerNote || 'Retired by the owner.',
    });
    setManagingId(null);
  };

  const deletePermanently = async (submission: DeveloperAssetProgramView['submissions'][number]) => {
    const confirmationName = window.prompt(
      `This permanently deletes the asset, its registry entry, revisions, votes, and managed files. Type the exact asset name to continue:\n\n${submission.name}`,
    );
    if (confirmationName === null) return;
    await onDeletePermanently(submission.id, confirmationName);
    setManagingId(null);
    setExpandedId(null);
  };

  return (
    <div className="mt-7">
      <h3 className="font-serif text-xl text-[#fff1c7]">Visual asset library</h3>
      <p className="mt-2 text-sm leading-6 text-[#c7b288]">
        Review the actual asset, see the automatic result, and use Manage only when CardForge needs an owner exception. Clearing an override immediately returns the asset to automatic operation.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <LibrarySummary label="Managed files" value={String(program.managedFileCount)} detail="Supabase objects owned by this pipeline" />
        <LibrarySummary label="Managed storage" value={formatBytes(program.managedStorageBytes)} detail="Known source-file size" />
        <LibrarySummary label="Owner deletable" value={String(program.totalSubmissionCount)} detail="Votes and publication do not limit owner authority" />
      </div>
      <div className="mt-4 grid gap-3 border border-[#3c2c1b] bg-[#100c08] p-3 md:grid-cols-[minmax(14rem,1fr)_minmax(12rem,0.7fr)_minmax(12rem,0.7fr)]">
        <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
          Search library
          <span className="flex items-center border border-[#5f4526] bg-[#0c0b09] px-3 focus-within:border-[#d8b365]">
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Asset, contributor, or catalog id"
              className="min-w-0 flex-1 bg-transparent p-2 text-sm normal-case tracking-normal text-[#ffe7ad] outline-none placeholder:text-[#6f624d]"
            />
          </span>
        </label>
        <FilterSelect
          label="Asset type"
          value={assetTypeFilter}
          onChange={(value) => onAssetTypeFilterChange(value as DeveloperAssetType | 'all')}
          options={[
            { value: 'all', label: `All types (${program.totalSubmissionCount})` },
            ...DEVELOPER_ASSET_TYPES.map((assetType) => ({
              value: assetType,
              label: `${getDeveloperAssetTypeLabel(assetType)} (${program.submissionTypeCounts[assetType]})`,
            })),
          ]}
        />
        <FilterSelect
          label="Pipeline status"
          value={statusFilter}
          onChange={(value) => onStatusFilterChange(value as DeveloperAssetStatus | 'all')}
          options={[
            { value: 'all', label: `All statuses (${program.totalSubmissionCount})` },
            ...DEVELOPER_ASSET_STATUSES.map((status) => ({
              value: status,
              label: `${getDeveloperAssetStatusLabel(status)} (${program.submissionStatusCounts[status]})`,
            })),
          ]}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#a98a55]" aria-live="polite">
        <p>Showing {firstItemNumber}-{lastItemNumber} of {program.submissionPage.total} matching assets.</p>
        <p>Page {currentPage} of {totalPages}</p>
      </div>
      <div className="mt-4 space-y-3">
        {program.submissions.length === 0 ? (
          <p className="border border-[#3c2c1b] bg-[#100c08] p-4 text-sm text-[#c7b288]">No pipeline assets match these filters.</p>
        ) : program.submissions.map((submission) => (
          <AssetRow
            key={submission.id}
            submission={submission}
            program={program}
            templatePreviews={templatePreviews}
            expanded={expandedId === submission.id}
            editForm={managingId === submission.id ? (
              <div className="mt-4 grid gap-3 border border-[#6f4f28] bg-[#15100a] p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
                    Status control
                    <select className="border border-[#5f4526] bg-[#0c0b09] p-3 text-sm normal-case tracking-normal text-[#ffe7ad]" value={statusOverride} onChange={(event) => setStatusOverride(event.target.value as DeveloperAssetStatus | 'automatic')}>
                      <option value="automatic">Automatic ({getDeveloperAssetStatusLabel(submission.automatedStatus)})</option>
                      {statusOptions.map((status) => <option key={status} value={status}>Pin {getDeveloperAssetStatusLabel(status)}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
                    Access control
                    <select className="border border-[#5f4526] bg-[#0c0b09] p-3 text-sm normal-case tracking-normal text-[#ffe7ad]" value={tierOverride} onChange={(event) => setTierOverride(event.target.value as DeveloperAssetAccessTierOverride | 'automatic')}>
                      <option value="automatic">Automatic ({getDeveloperAssetTierLabel(submission.automatedAccessTier)})</option>
                      <option value="free">Pin Starter</option>
                      <option value="paid">Pin Creator Pass</option>
                      <option value="hidden">Pin hidden</option>
                    </select>
                  </label>
                </div>
                <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
                  Decision note
                  <textarea className="min-h-24 border border-[#5f4526] bg-[#0c0b09] p-3 text-sm normal-case tracking-normal text-[#ffe7ad]" value={ownerNote} onChange={(event) => setOwnerNote(event.target.value)} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={updatingSubmissionId === submission.id} className="rounded-none bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" onClick={() => void saveOverride(submission.id)}>
                    {updatingSubmissionId === submission.id ? 'Saving...' : 'Save control'}
                  </Button>
                  <Button variant="outline" className="rounded-none border-[#5f4526] bg-transparent text-[#ffe7ad]" onClick={() => setManagingId(null)}>Cancel</Button>
                </div>
                <div className="border-t border-[#3c2c1b] pt-3">
                  <p className="text-xs leading-5 text-[#a98a55]">
                    Retire hides an asset and preserves its votes and publication history. Permanent deletion removes the complete shared asset lineage and cannot be undone.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingSubmissionId === submission.id}
                      className="rounded-none border-[#8a642f] bg-transparent text-[#f0c568]"
                      onClick={() => void retireAsset(submission)}
                    >
                      <Archive className="mr-1 h-4 w-4" /> Retire
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingSubmissionId === submission.id}
                      className="rounded-none border-[#8f3e36] bg-transparent text-[#ffb8a8] hover:bg-[#2a120d]"
                      onClick={() => void deletePermanently(submission)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Delete permanently
                    </Button>
                  </div>
                </div>
              </div>
            ) : undefined}
          >
            {submission.assetType === 'templates' && (submission.registryAssetId || submission.targetRegistryAssetId) ? (
              <Button asChild size="sm" variant="outline" className="border-[#5f4526] bg-transparent text-[#ffe7ad]">
                <a href={`/studio?editTemplate=${encodeURIComponent(submission.registryAssetId ?? submission.targetRegistryAssetId!)}`}>
                  <Pencil className="mr-1 h-4 w-4" /> Edit Template
                </a>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" className="border-[#5f4526] bg-transparent text-[#ffe7ad]" onClick={() => setExpandedId((current) => current === submission.id ? null : submission.id)}>
              <Eye className="mr-1 h-4 w-4" /> Review
            </Button>
            <Button size="sm" variant="outline" className="border-[#8a642f] bg-transparent text-[#f0c568]" onClick={() => openManager(submission)}>
              <Settings2 className="mr-1 h-4 w-4" /> Manage
            </Button>
          </AssetRow>
        ))}
      </div>
      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#3c2c1b] pt-4">
          <Button size="sm" variant="outline" className="rounded-none border-[#5f4526] bg-transparent text-[#ffe7ad]" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <span className="text-xs text-[#a98a55]">{firstItemNumber}-{lastItemNumber} of {program.submissionPage.total}</span>
          <Button size="sm" variant="outline" className="rounded-none border-[#5f4526] bg-transparent text-[#ffe7ad]" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function LibrarySummary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border border-[#3c2c1b] bg-[#100c08] p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-[#a98a55]">{label}</p>
      <p className="mt-1 font-serif text-xl text-[#ffe7ad]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[#8f7a5e]">{detail}</p>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="border border-[#5f4526] bg-[#0c0b09] p-2 text-sm normal-case tracking-normal text-[#ffe7ad] outline-none focus:border-[#d8b365]">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
