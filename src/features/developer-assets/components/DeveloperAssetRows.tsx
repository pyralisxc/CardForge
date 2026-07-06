"use client";

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Archive, Check, ChevronLeft, ChevronRight, Eye, Save, ThumbsDown, ThumbsUp, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CardPreview } from '@/components/card-forge/CardPreview';
import { TemplateThumbnail } from '@/components/card-forge/TemplateThumbnail';
import {
  canRenderImagePreview,
  getContributorLabel,
  getReviewProgressLabel,
  getReviewProgressPercent,
  getSubmissionNextStep,
  getTemplatePreviewId,
  tierClasses,
  type DeveloperAssetSubmission,
} from '@/features/developer-assets/components/DeveloperAssetHubModel';
import {
  getDeveloperAssetStatusDescription,
  getDeveloperAssetStatusLabel,
  getDeveloperAssetTierDescription,
  getDeveloperAssetTierLabel,
  getDeveloperAssetTypeLabel,
} from '@/lib/pipelineAssetTaxonomy';
import type { DeveloperAssetProgramView } from '@/lib/developerAssetStore';
import type { TCGCardTemplate } from '@/types';

export function VoteButtons({
  submission,
  onVote,
}: {
  submission: DeveloperAssetSubmission;
  onVote: (submissionId: string, voteValue: 'positive' | 'negative') => void;
}) {
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={`border-[#5f7f54] bg-transparent text-[#bde3a8] ${submission.currentUserVote === 'positive' ? 'bg-[#142416]' : ''}`}
        onClick={() => onVote(submission.id, 'positive')}
        aria-label={`Upvote ${submission.name}`}
      >
        <ThumbsUp className="h-4 w-4" />
        <span className="ml-1 text-xs">+{submission.positiveVotes}</span>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={`border-[#7d3d32] bg-transparent text-[#ffd0c6] ${submission.currentUserVote === 'negative' ? 'bg-[#2a120d]' : ''}`}
        onClick={() => onVote(submission.id, 'negative')}
        aria-label={`Downvote ${submission.name}`}
      >
        <ThumbsDown className="h-4 w-4" />
        <span className="ml-1 text-xs">-{submission.negativeVotes}</span>
      </Button>
    </>
  );
}

export function QueuePager({
  page,
  pageCount,
  total,
  pageSize,
  onPrevious,
  onNext,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const start = total === 0 ? 0 : ((page - 1) * pageSize) + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#3c2c1b] pt-4 text-xs text-[#a98a55]">
      <span>{start}-{end} of {total} assets</span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="border-[#5f4526] bg-transparent text-[#ffe7ad]"
          disabled={page <= 1}
          onClick={onPrevious}
          aria-label="Previous queue page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-20 text-center text-[#c7b288]">Page {page} / {pageCount}</span>
        <Button
          size="sm"
          variant="outline"
          className="border-[#5f4526] bg-transparent text-[#ffe7ad]"
          disabled={page >= pageCount}
          onClick={onNext}
          aria-label="Next queue page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function EditSubmissionForm({
  name,
  description,
  previewUrl,
  isSaving,
  onNameChange,
  onDescriptionChange,
  onPreviewUrlChange,
  onCancel,
  onSave,
}: {
  name: string;
  description: string;
  previewUrl: string;
  isSaving: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPreviewUrlChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-3 grid gap-3 border border-[#5f4526] bg-[#100c08] p-3">
      <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
        Name
        <input className="border border-[#5f4526] bg-[#0c0b09] p-3 text-sm normal-case tracking-normal text-[#ffe7ad]" value={name} onChange={(event) => onNameChange(event.target.value)} />
      </label>
      <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
        Preview URL
        <input className="border border-[#5f4526] bg-[#0c0b09] p-3 text-sm normal-case tracking-normal text-[#ffe7ad]" value={previewUrl} onChange={(event) => onPreviewUrlChange(event.target.value)} />
      </label>
      <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
        Notes
        <textarea className="min-h-24 border border-[#5f4526] bg-[#0c0b09] p-3 text-sm normal-case tracking-normal text-[#ffe7ad]" value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={isSaving} onClick={onSave}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="outline" className="border-[#5f4526] bg-transparent text-[#ffe7ad]" disabled={isSaving} onClick={onCancel}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function AssetRow({
  submission,
  program,
  templatePreviews,
  children,
  expanded = false,
  onToggleExpanded,
  editForm,
}: {
  submission: DeveloperAssetSubmission;
  program: Pick<DeveloperAssetProgramView, 'settings'>;
  templatePreviews: Record<string, TCGCardTemplate>;
  children?: ReactNode;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  editForm?: ReactNode;
}) {
  const progressPercent = getReviewProgressPercent(
    submission,
    Math.max(program.settings.minimumVotesForGrading, program.settings.minimumVotesForTierAssignment)
  );
  const progressLabel = getReviewProgressLabel(
    submission,
    Math.max(program.settings.minimumVotesForGrading, program.settings.minimumVotesForTierAssignment)
  );

  return (
    <div className="border border-[#4a3823] bg-[#0c0b09] p-3">
      <div className="grid gap-3 sm:grid-cols-[4rem_1fr_auto] sm:items-center">
        <div className="grid h-16 w-16 place-items-center overflow-hidden border border-[#5f4526] bg-[#15100a] bg-[linear-gradient(45deg,rgba(255,255,255,0.04)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.04)_75%),linear-gradient(45deg,rgba(255,255,255,0.04)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.04)_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]">
          <AssetPreview submission={submission} templatePreviews={templatePreviews} />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-[#ffe7ad]">{submission.name}</p>
            <span className="border border-[#5f4526] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#d7b469]">
              Status: {getDeveloperAssetStatusLabel(submission.status)}
            </span>
            <span className="border border-[#35445a] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#b9d5ff]">
              By: {getContributorLabel(submission)}
            </span>
            <span className={`border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${tierClasses[submission.calculatedAccessTier]}`}>
              Tier: {getDeveloperAssetTierLabel(submission.calculatedAccessTier)}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#c7b288]">
            {getDeveloperAssetTypeLabel(submission.assetType, { plural: false })} - +{submission.positiveVotes} / -{submission.negativeVotes} - quality {submission.qualityScore}%
          </p>
          <div className="mt-2 grid gap-1">
            <div className="h-1.5 overflow-hidden bg-[#2b2116]" aria-hidden="true">
              <div className="h-full bg-[#d8b365]" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#a98a55]">{progressLabel}</p>
          </div>
          <p className="mt-1 text-xs text-[#a98a55]">
            {(submission.tierDecisionReason ?? submission.decisionReason ?? 'developer_review').replaceAll('_', ' ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onToggleExpanded ? (
            <Button
              size="sm"
              variant="outline"
              className="border-[#5f4526] bg-transparent text-[#ffe7ad]"
              onClick={onToggleExpanded}
              aria-label={`${expanded ? 'Hide' : 'Show'} ${submission.name} preview`}
            >
              <Eye className="h-4 w-4" />
            </Button>
          ) : null}
          {children ?? (submission.status === 'published' ? <Check className="h-5 w-5 text-[#8be0a4]" /> : null)}
        </div>
      </div>
      {expanded ? (
        <div className="mt-3 grid gap-3 border-t border-[#3c2c1b] pt-3 lg:grid-cols-[minmax(14rem,22rem)_1fr]">
          <div className="grid min-h-48 place-items-center overflow-hidden border border-[#5f4526] bg-[#15100a] bg-[linear-gradient(45deg,rgba(255,255,255,0.04)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.04)_75%),linear-gradient(45deg,rgba(255,255,255,0.04)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.04)_75%)] bg-[length:18px_18px] bg-[position:0_0,9px_9px]">
            <AssetPreview submission={submission} templatePreviews={templatePreviews} expanded />
          </div>
          <div className="text-sm leading-6 text-[#c7b288]">
            <p>{submission.description || 'No notes were provided for this asset.'}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="border border-[#3c2c1b] bg-[#100c08] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#a98a55]">Status meaning</p>
                <p className="mt-1 text-xs leading-5 text-[#c7b288]">{getDeveloperAssetStatusDescription(submission.status)}</p>
              </div>
              <div className="border border-[#3c2c1b] bg-[#100c08] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#a98a55]">Tier meaning</p>
                <p className="mt-1 text-xs leading-5 text-[#c7b288]">{getDeveloperAssetTierDescription(submission.calculatedAccessTier)}</p>
              </div>
              <div className="border border-[#3c2c1b] bg-[#100c08] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#a98a55]">Next step</p>
                <p className="mt-1 text-xs leading-5 text-[#c7b288]">{getSubmissionNextStep(submission, program)}</p>
              </div>
            </div>
            <dl className="mt-3 grid gap-2 text-xs text-[#a98a55] sm:grid-cols-2">
              <div><dt className="uppercase tracking-[0.12em]">Contributor</dt><dd className="break-all text-[#c7b288]">{getContributorLabel(submission)}</dd></div>
              <div><dt className="uppercase tracking-[0.12em]">Email</dt><dd className="break-all text-[#c7b288]">{submission.developerEmail ?? 'Not provided'}</dd></div>
              <div><dt className="uppercase tracking-[0.12em]">Source</dt><dd className="break-all text-[#c7b288]">{submission.sourceUrl ?? 'Not attached'}</dd></div>
              <div><dt className="uppercase tracking-[0.12em]">Live catalog id</dt><dd className="break-all text-[#c7b288]">{submission.registryAssetId ?? 'Not published'}</dd></div>
              <div><dt className="uppercase tracking-[0.12em]">Submitted</dt><dd className="text-[#c7b288]">{new Date(submission.submittedAt).toLocaleDateString()}</dd></div>
              <div><dt className="uppercase tracking-[0.12em]">Updated</dt><dd className="text-[#c7b288]">{submission.updatedAt ? new Date(submission.updatedAt).toLocaleDateString() : 'Not updated'}</dd></div>
            </dl>
            {editForm}
          </div>
        </div>
      ) : editForm}
    </div>
  );
}

function AssetPreview({
  submission,
  templatePreviews,
  expanded = false,
}: {
  submission: DeveloperAssetSubmission;
  templatePreviews: Record<string, TCGCardTemplate>;
  expanded?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const templateId = getTemplatePreviewId(submission);
  const template = templateId ? templatePreviews[templateId] : undefined;

  useEffect(() => {
    setImageFailed(false);
  }, [submission.previewUrl]);

  if (template) {
    if (!expanded) return <TemplateThumbnail template={template} />;
    return (
      <div className="max-h-[26rem] w-full overflow-auto p-4">
        <CardPreview
          card={{ template, data: template.templatePreviewData ?? {}, uniqueId: `developer-preview-${template.id}` }}
          targetWidthPx={260}
          isEditorPreview
        />
      </div>
    );
  }

  if (canRenderImagePreview(submission) && !imageFailed) {
    return (
      <img
        src={submission.previewUrl}
        alt=""
        className={expanded ? 'max-h-80 w-full object-contain p-3' : 'h-full w-full object-contain p-1'}
        onError={() => setImageFailed(true)}
      />
    );
  }

  const isStructured = submission.previewUrl.startsWith('/api/templates') || submission.previewUrl.startsWith('/api/styles');
  const message = imageFailed
    ? 'Preview image could not be loaded.'
    : isStructured
      ? 'This asset uses structured data instead of a direct image preview.'
      : 'No preview file has been attached yet.';

  return (
    <div className={`grid h-full w-full place-items-center text-center text-[#c7b288] ${expanded ? 'gap-2 p-6' : 'px-2'}`}>
      {expanded ? <Archive className="mx-auto h-8 w-8 text-[#a98a55]" /> : null}
      <p className={`${expanded ? 'text-sm font-medium text-[#ffe7ad]' : 'text-[10px] uppercase tracking-[0.12em] text-[#a98a55]'}`}>
        {getDeveloperAssetTypeLabel(submission.assetType, { plural: false })}
      </p>
      {expanded ? <p className="text-xs leading-5 text-[#a98a55]">{message}</p> : null}
    </div>
  );
}
