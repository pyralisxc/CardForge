"use client";

import { useState } from 'react';
import { Archive, CheckCircle2, ChevronLeft, ChevronRight, Eye, Pencil, Search, Settings2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AssetRow } from './PipelineSubmissionRows';
import { usePipelineTemplatePreviews } from './usePipelineTemplatePreviews';
import { getTemplatePreviewId } from './PipelineContributionModel';
import {
  PIPELINE_STATUSES,
  PIPELINE_TYPES,
  type PipelineAccessTierOverride,
  type PipelineStatus,
  type PipelineType,
} from '../lib/pipelineItems';
import type { PipelineProgramView } from '../lib/pipelineProgram';
import {
  getPipelineStatusLabel,
  getPipelineTierLabel,
  getPipelineTypeLabel,
} from '../lib/pipelineAssetTaxonomy';

export interface OwnerAssetOverrideInput {
  ownerStatusOverride?: PipelineStatus | null;
  ownerAccessTierOverride?: PipelineAccessTierOverride | null;
  ownerNote: string;
}

interface OwnerAssetLibraryPanelProps {
  program: PipelineProgramView;
  query: string;
  assetTypeFilter: PipelineType | 'all';
  statusFilter: PipelineStatus | 'all';
  page: number;
  onQueryChange: (value: string) => void;
  onAssetTypeFilterChange: (value: PipelineType | 'all') => void;
  onStatusFilterChange: (value: PipelineStatus | 'all') => void;
  onPageChange: (page: number) => void;
  updatingSubmissionId: string | null;
  onUpdateOverride: (
    submissionId: string,
    input: OwnerAssetOverrideInput,
    success?: { title: string; description: string },
  ) => Promise<boolean>;
  onDeletePermanently: (submissionId: string, confirmationName: string) => Promise<void>;
}

const statusOptions: PipelineStatus[] = [
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
  const [statusOverride, setStatusOverride] = useState<PipelineStatus | 'automatic'>('automatic');
  const [tierOverride, setTierOverride] = useState<PipelineAccessTierOverride | 'automatic'>('automatic');
  const [ownerNote, setOwnerNote] = useState('');
  const templatePreviews = usePipelineTemplatePreviews(program.submissions);
  const totalPages = Math.max(1, Math.ceil(program.submissionPage.total / program.submissionPage.pageSize));
  const currentPage = Math.min(page, totalPages);
  const firstItemNumber = program.submissionPage.total === 0
    ? 0
    : (currentPage - 1) * program.submissionPage.pageSize + 1;
  const lastItemNumber = Math.min(currentPage * program.submissionPage.pageSize, program.submissionPage.total);

  const openManager = (submission: PipelineProgramView['submissions'][number]) => {
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
    const saved = await onUpdateOverride(submissionId, {
      ownerStatusOverride: nextStatus,
      ownerAccessTierOverride: tierOverride === 'automatic' ? null : tierOverride,
      ownerNote,
    });
    if (saved) setManagingId(null);
  };

  const publishTemplateRevision = async (submission: PipelineProgramView['submissions'][number]) => {
    const isNewTemplate = submission.baseRevisionNumber === 0;
    const revisionLabel = isNewTemplate
      ? 'this new Template'
      : submission.revisionNumber ? `revision ${submission.revisionNumber}` : 'this revision';
    if (!window.confirm(`Publish ${revisionLabel} “${submission.name}” to the shared CardForge Library now?`)) return;
    const saved = await onUpdateOverride(
      submission.id,
      {
        ownerStatusOverride: 'published',
        ownerAccessTierOverride: 'free',
        ownerNote: `Approved and published ${revisionLabel} from Owner Review.`,
      },
      {
        title: isNewTemplate ? 'New Template published' : 'Template revision published',
        description: `${revisionLabel[0].toUpperCase()}${revisionLabel.slice(1)} is now live in the shared CardForge Library.`,
      },
    );
    if (saved) {
      setManagingId(null);
      setExpandedId(null);
    }
  };

  const retireAsset = async (submission: PipelineProgramView['submissions'][number]) => {
    if (!window.confirm(`Retire “${submission.name}” from use while preserving its history?`)) return;
    await onUpdateOverride(submission.id, {
      ownerStatusOverride: 'archived',
      ownerNote: ownerNote || submission.ownerNote || 'Retired by the owner.',
    });
    setManagingId(null);
  };

  const deletePermanently = async (submission: PipelineProgramView['submissions'][number]) => {
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
      <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">Visual asset library</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">
        New Templates and revisions have a direct publication decision. Other assets follow the automatic pipeline unless you use Manage for an owner exception.
      </p>
      {program.submissionStatusCounts.submitted > 0 ? (
        <div className="mt-4 flex flex-col gap-3 border border-[#8a642f] bg-[#1b140c] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-serif text-lg text-[var(--cf-accent-text)]">Owner review queue</p>
            <p className="mt-1 text-xs leading-5 text-[var(--cf-text-muted)]">
              {program.submissionStatusCounts.submitted} submitted Template contribution{program.submissionStatusCounts.submitted === 1 ? '' : 's'} waiting for a publication decision.
            </p>
          </div>
          <Button
            size="sm"
            className="rounded-none bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]"
            onClick={() => onStatusFilterChange('submitted')}
          >
            Show pending Templates
          </Button>
        </div>
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <LibrarySummary label="Managed files" value={String(program.managedFileCount)} detail="Supabase objects owned by this pipeline" />
        <LibrarySummary label="Managed storage" value={formatBytes(program.managedStorageBytes)} detail="Known source-file size" />
        <LibrarySummary label="Owner deletable" value={String(program.totalSubmissionCount)} detail="Votes and publication do not limit owner authority" />
      </div>
      <div className="mt-4 grid gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 md:grid-cols-[minmax(14rem,1fr)_minmax(12rem,0.7fr)_minmax(12rem,0.7fr)]">
        <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">
          Search library
          <span className="flex items-center border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 focus-within:border-[var(--cf-accent)]">
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Asset, contributor, or catalog id"
              className="min-w-0 flex-1 bg-transparent p-2 text-sm normal-case tracking-normal text-[var(--cf-accent-text)] outline-none placeholder:text-[#6f624d]"
            />
          </span>
        </label>
        <FilterSelect
          label="Asset type"
          value={assetTypeFilter}
          onChange={(value) => onAssetTypeFilterChange(value as PipelineType | 'all')}
          options={[
            { value: 'all', label: `All types (${program.totalSubmissionCount})` },
            ...PIPELINE_TYPES.map((assetType) => ({
              value: assetType,
              label: `${getPipelineTypeLabel(assetType)} (${program.submissionTypeCounts[assetType]})`,
            })),
          ]}
        />
        <FilterSelect
          label="Pipeline status"
          value={statusFilter}
          onChange={(value) => onStatusFilterChange(value as PipelineStatus | 'all')}
          options={[
            { value: 'all', label: `All statuses (${program.totalSubmissionCount})` },
            ...PIPELINE_STATUSES.map((status) => ({
              value: status,
              label: `${getPipelineStatusLabel(status)} (${program.submissionStatusCounts[status]})`,
            })),
          ]}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--cf-text-subtle)]" aria-live="polite">
        <p>Showing {firstItemNumber}-{lastItemNumber} of {program.submissionPage.total} matching assets.</p>
        <p>Page {currentPage} of {totalPages}</p>
      </div>
      <div className="mt-4 space-y-3">
        {program.submissions.length === 0 ? (
          <p className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4 text-sm text-[var(--cf-text-muted)]">No pipeline assets match these filters.</p>
        ) : program.submissions.map((submission) => {
          const isPendingTemplateRevision = submission.assetType === 'templates'
            && submission.revisionNumber != null
            && submission.status === 'submitted';
          const isNewTemplateSubmission = isPendingTemplateRevision && submission.baseRevisionNumber === 0;
          const editTemplateId = getTemplatePreviewId(submission);
          return (
          <AssetRow
            key={submission.id}
            submission={submission}
            program={program}
            templatePreviews={templatePreviews}
            expanded={expandedId === submission.id}
            editForm={managingId === submission.id ? (
              <div className="mt-4 grid gap-3 border border-[#6f4f28] bg-[var(--cf-surface)] p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">
                    Status control
                    <select className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-sm normal-case tracking-normal text-[var(--cf-accent-text)]" value={statusOverride} onChange={(event) => setStatusOverride(event.target.value as PipelineStatus | 'automatic')}>
                      <option value="automatic">Automatic ({getPipelineStatusLabel(submission.automatedStatus)})</option>
                      {statusOptions.map((status) => <option key={status} value={status}>Pin {getPipelineStatusLabel(status)}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">
                    Access control
                    <select className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-sm normal-case tracking-normal text-[var(--cf-accent-text)]" value={tierOverride} onChange={(event) => setTierOverride(event.target.value as PipelineAccessTierOverride | 'automatic')}>
                      <option value="automatic">Automatic ({getPipelineTierLabel(submission.automatedAccessTier)})</option>
                      <option value="free">Pin Starter</option>
                      <option value="paid">Pin Creator Pass</option>
                      <option value="hidden">Pin hidden</option>
                    </select>
                  </label>
                </div>
                <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">
                  Decision note
                  <textarea className="min-h-24 border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-sm normal-case tracking-normal text-[var(--cf-accent-text)]" value={ownerNote} onChange={(event) => setOwnerNote(event.target.value)} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={updatingSubmissionId === submission.id} className="rounded-none bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]" onClick={() => void saveOverride(submission.id)}>
                    {updatingSubmissionId === submission.id ? 'Saving...' : 'Save control'}
                  </Button>
                  <Button variant="outline" className="rounded-none border-[var(--cf-border)] bg-transparent text-[var(--cf-accent-text)]" onClick={() => setManagingId(null)}>Cancel</Button>
                </div>
                <div className="border-t border-[var(--cf-border-subtle)] pt-3">
                  <p className="text-xs leading-5 text-[var(--cf-text-subtle)]">
                    Retire hides an asset and preserves its votes and publication history. Permanent deletion removes the complete shared asset lineage and cannot be undone.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingSubmissionId === submission.id}
                      className="rounded-none border-[#8a642f] bg-transparent text-[var(--cf-accent-strong)]"
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
            {isPendingTemplateRevision ? (
              <Button
                size="sm"
                disabled={updatingSubmissionId === submission.id}
                className="rounded-none bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]"
                onClick={() => void publishTemplateRevision(submission)}
              >
                <CheckCircle2 className="mr-1 h-4 w-4" />
                {updatingSubmissionId === submission.id
                  ? 'Publishing...'
                  : isNewTemplateSubmission
                    ? 'Approve & publish new Template'
                    : `Approve & publish revision ${submission.revisionNumber}`}
              </Button>
            ) : null}
            {editTemplateId && templatePreviews[editTemplateId] ? (
              <Button asChild size="sm" variant="outline" className="border-[var(--cf-border)] bg-transparent text-[var(--cf-accent-text)]">
                <a href={`/account?${new URLSearchParams({ section: 'library', scope: 'pipeline', tool: 'design', artifact: editTemplateId, editTemplate: editTemplateId })}`}>
                  <Pencil className="mr-1 h-4 w-4" /> Edit Template
                </a>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" className="border-[var(--cf-border)] bg-transparent text-[var(--cf-accent-text)]" onClick={() => setExpandedId((current) => current === submission.id ? null : submission.id)}>
              <Eye className="mr-1 h-4 w-4" /> {isPendingTemplateRevision ? 'Compare revision' : 'Review'}
            </Button>
            <Button size="sm" variant="outline" className="border-[#8a642f] bg-transparent text-[var(--cf-accent-strong)]" onClick={() => openManager(submission)}>
              <Settings2 className="mr-1 h-4 w-4" /> Manage
            </Button>
          </AssetRow>
          );
        })}
      </div>
      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--cf-border-subtle)] pt-4">
          <Button size="sm" variant="outline" className="rounded-none border-[var(--cf-border)] bg-transparent text-[var(--cf-accent-text)]" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <span className="text-xs text-[var(--cf-text-subtle)]">{firstItemNumber}-{lastItemNumber} of {program.submissionPage.total}</span>
          <Button size="sm" variant="outline" className="rounded-none border-[var(--cf-border)] bg-transparent text-[var(--cf-accent-text)]" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function LibrarySummary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">{label}</p>
      <p className="mt-1 font-serif text-xl text-[var(--cf-accent-text)]">{value}</p>
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
    <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-2 text-sm normal-case tracking-normal text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)]">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
