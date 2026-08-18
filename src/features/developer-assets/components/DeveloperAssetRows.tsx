"use client";

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Archive, Check, ChevronLeft, ChevronRight, Eye, Save, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  appearanceToStyle,
  CardPreview,
  shapeClipPath,
  TemplateThumbnail,
} from '@/features/card-rendering/client';
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
  getDeveloperAssetStudioDestinationLabel,
  getDeveloperAssetStatusDescription,
  getDeveloperAssetStatusLabel,
  getDeveloperAssetTierDescription,
  getDeveloperAssetTierLabel,
  getDeveloperAssetTypeLabel,
} from '@/features/developer-assets/lib/pipelineAssetTaxonomy';
import {
  CARDFORGE_SPECIALTY_OPTIONS,
  CARDFORGE_USE_CASE_OPTIONS,
  formatContentTaxonomyTag,
  type ContentTaxonomyOption,
} from '@/features/developer-assets/lib/contentTaxonomy';
import type { DeveloperAssetProgramView } from '@/features/developer-assets/lib/developerAssetProgram';
import { isRepositoryStyle } from '@/features/developer-assets/lib/registryContentValidation';
import type { AppearanceStylePreset, TCGCardTemplate } from '@/domain/templates';

const getFontPreviewFormat = (url: string): string => {
  const extension = url.split('?')[0]?.split('.').pop()?.toLowerCase();
  if (extension === 'woff2') return 'woff2';
  if (extension === 'woff') return 'woff';
  if (extension === 'ttf') return 'truetype';
  return 'opentype';
};

const parseTaxonomySelection = (value: string): string[] => [...new Set(
  value.split(',').map((tag) => tag.trim()).filter(Boolean),
)];

function ControlledTaxonomySelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly ContentTaxonomyOption[];
  onChange: (value: string) => void;
}) {
  const selected = parseTaxonomySelection(value);
  const available = options.filter((option) => !selected.includes(option.id));
  const update = (next: string[]) => onChange(next.join(','));

  return (
    <div className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
      <span>{label}</span>
      <select
        className="border border-[#5f4526] bg-[#0c0b09] p-3 text-sm normal-case tracking-normal text-[#ffe7ad]"
        value=""
        onChange={(event) => {
          if (!event.target.value) return;
          update([...selected, event.target.value]);
        }}
      >
        <option value="">Add from CardForge taxonomy…</option>
        {available.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      {selected.length ? (
        <div className="flex flex-wrap gap-1.5 pt-1 normal-case tracking-normal">
          {selected.map((id) => {
            const option = options.find((candidate) => candidate.id === id);
            if (!option) return null;
            return (
              <button
                key={id}
                type="button"
                className="inline-flex items-center gap-1 border border-[#5f4526] bg-[#15100a] px-2 py-1 text-[11px] text-[#ffe7ad]"
                title={option.description}
                onClick={() => update(selected.filter((candidate) => candidate !== id))}
              >
                {option.label}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : (
        <span className="pt-1 text-[10px] normal-case tracking-normal text-[#7f715c]">No classification selected.</span>
      )}
    </div>
  );
}

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
  sourceNotes,
  specialtyTags,
  useCaseTags,
  requestedStudioDestination,
  destinationOptions,
  isDraft,
  isSaving,
  onNameChange,
  onDescriptionChange,
  onPreviewUrlChange,
  onSourceNotesChange,
  onSpecialtyTagsChange,
  onUseCaseTagsChange,
  onRequestedStudioDestinationChange,
  onCancel,
  onSave,
  onSubmit,
}: {
  name: string;
  description: string;
  previewUrl: string;
  sourceNotes: string;
  specialtyTags: string;
  useCaseTags: string;
  requestedStudioDestination: string;
  destinationOptions: Array<{ value: string; label: string }>;
  isDraft: boolean;
  isSaving: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPreviewUrlChange: (value: string) => void;
  onSourceNotesChange: (value: string) => void;
  onSpecialtyTagsChange: (value: string) => void;
  onUseCaseTagsChange: (value: string) => void;
  onRequestedStudioDestinationChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
  onSubmit: () => void;
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
        Description
        <textarea className="min-h-24 border border-[#5f4526] bg-[#0c0b09] p-3 text-sm normal-case tracking-normal text-[#ffe7ad]" value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <ControlledTaxonomySelect
          label="Specialties"
          value={specialtyTags}
          options={CARDFORGE_SPECIALTY_OPTIONS}
          onChange={onSpecialtyTagsChange}
        />
        <ControlledTaxonomySelect
          label="Use cases"
          value={useCaseTags}
          options={CARDFORGE_USE_CASE_OPTIONS}
          onChange={onUseCaseTagsChange}
        />
      </div>
      <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
        Studio placement
        <select
          className="border border-[#5f4526] bg-[#0c0b09] p-3 text-sm normal-case tracking-normal text-[#ffe7ad]"
          value={requestedStudioDestination}
          onChange={(event) => onRequestedStudioDestinationChange(event.target.value)}
        >
          <option value="">Choose placement</option>
          {destinationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
        Source and rights notes
        <textarea
          className="min-h-24 border border-[#5f4526] bg-[#0c0b09] p-3 text-sm normal-case tracking-normal text-[#ffe7ad]"
          placeholder="State who created the artwork, where assets came from, and what publication rights CardForge has."
          value={sourceNotes}
          onChange={(event) => onSourceNotesChange(event.target.value)}
        />
      </label>
      <p className="text-xs leading-5 text-[#a98a55]">
        Studio placement controls where the asset appears. Specialty and use-case tags come from CardForge's shared taxonomy so contributors do not invent competing labels.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={isSaving} onClick={onSave}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : isDraft ? 'Save Pipeline draft' : 'Save'}
        </Button>
        {isDraft ? (
          <Button className="bg-[#8fbf75] text-[#0e170b] hover:bg-[#a8d98c]" disabled={isSaving} onClick={onSubmit}>
            {isSaving ? 'Submitting...' : 'Submit for owner review'}
          </Button>
        ) : null}
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
    program.settings.minimumVotesForGrading
  );
  const automaticProgressLabel = getReviewProgressLabel(
    submission,
    program.settings.minimumVotesForGrading
  );
  const progressLabel = submission.ownerStatusOverride
    ? `Automatic signal: ${automaticProgressLabel}`
    : automaticProgressLabel;

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
              <div><dt className="uppercase tracking-[0.12em]">Automatic result</dt><dd className="break-all text-[#c7b288]">{getDeveloperAssetStatusLabel(submission.automatedStatus)} / {getDeveloperAssetTierLabel(submission.automatedAccessTier)}</dd></div>
              <div><dt className="uppercase tracking-[0.12em]">Owner override</dt><dd className="break-all text-[#c7b288]">{submission.ownerStatusOverride || submission.ownerAccessTierOverride ? [submission.ownerStatusOverride, submission.ownerAccessTierOverride].filter(Boolean).join(' / ') : 'None - automatic'}</dd></div>
              <div><dt className="uppercase tracking-[0.12em]">Live catalog id</dt><dd className="break-all text-[#c7b288]">{submission.registryAssetId ?? 'Not published'}</dd></div>
              <div><dt className="uppercase tracking-[0.12em]">Studio placement</dt><dd className="text-[#c7b288]">{submission.requestedStudioDestination ? getDeveloperAssetStudioDestinationLabel(submission.requestedStudioDestination) : 'Not confirmed'}</dd></div>
              <div><dt className="uppercase tracking-[0.12em]">Specialties</dt><dd className="text-[#c7b288]">{submission.specialtyTags.length ? submission.specialtyTags.map(formatContentTaxonomyTag).join(', ') : 'Not confirmed'}</dd></div>
              <div><dt className="uppercase tracking-[0.12em]">Use cases</dt><dd className="text-[#c7b288]">{submission.useCaseTags.length ? submission.useCaseTags.map(formatContentTaxonomyTag).join(', ') : 'Not confirmed'}</dd></div>
              <div><dt className="uppercase tracking-[0.12em]">Source and rights</dt><dd className="text-[#c7b288]">{submission.sourceNotes || 'Not confirmed'}</dd></div>
              <div><dt className="uppercase tracking-[0.12em]">{submission.status === 'draft' ? 'Draft created' : 'Submitted'}</dt><dd className="text-[#c7b288]">{new Date(submission.submittedAt).toLocaleDateString()}</dd></div>
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
  const pipelineRecipe = isRepositoryStyle(submission.sourcePayload)
    ? submission.sourcePayload
    : null;
  const proposedTemplate = submission.sourcePayload
    && typeof submission.sourcePayload === 'object'
    && !Array.isArray(submission.sourcePayload)
    && typeof (submission.sourcePayload as Partial<TCGCardTemplate>).name === 'string'
    && typeof (submission.sourcePayload as Partial<TCGCardTemplate>).aspectRatio === 'string'
      ? submission.sourcePayload as TCGCardTemplate
      : null;

  useEffect(() => {
    setImageFailed(false);
  }, [submission.previewUrl]);

  if (pipelineRecipe) {
    return <PipelineRecipePreview recipe={pipelineRecipe} expanded={expanded} />;
  }

  if (proposedTemplate || template) {
    const primaryTemplate = proposedTemplate ?? template!;
    if (!expanded) return <TemplateThumbnail template={primaryTemplate} />;
    if (proposedTemplate && template) {
      return (
        <div className="grid w-full gap-4 p-4 sm:grid-cols-2">
          <TemplateComparisonPreview label="Current live" template={template} id={`live-${submission.id}`} />
          <TemplateComparisonPreview label={`Proposed revision ${submission.revisionNumber ?? ''}`.trim()} template={proposedTemplate} id={`proposed-${submission.id}`} />
        </div>
      );
    }
    return (
      <div className="max-h-[26rem] w-full overflow-auto p-4">
        <CardPreview
          card={{ template: primaryTemplate, data: primaryTemplate.templatePreviewData ?? {}, uniqueId: `developer-preview-${submission.id}` }}
          targetWidthPx={260}
          isEditorPreview
        />
      </div>
    );
  }

  if (submission.assetType === 'fonts') {
    const fontFamily = `developer-preview-${submission.id}`;
    const fontUrl = submission.sourceUrl || submission.previewUrl;
    return (
      <div className={`grid h-full w-full place-items-center text-center ${expanded ? 'gap-4 p-6' : 'p-2'}`}>
        {fontUrl ? (
          <style>{[
            '@font-face {',
            `  font-family: "${fontFamily}";`,
            `  src: url("${fontUrl.replace(/"/g, '\\"')}") format("${getFontPreviewFormat(fontUrl)}");`,
            '  font-weight: 100 900;',
            '  font-style: normal;',
            '  font-display: swap;',
            '}',
          ].join('\n')}</style>
        ) : null}
        <p
          className={expanded ? 'text-4xl leading-none text-[#ffe7ad]' : 'text-xl leading-none text-[#ffe7ad]'}
          style={{ fontFamily: fontUrl ? `"${fontFamily}", serif` : undefined }}
        >
          Aa
        </p>
        {expanded ? (
          <div className="space-y-2">
            <p className="text-sm text-[#ffe7ad]" style={{ fontFamily: fontUrl ? `"${fontFamily}", serif` : undefined }}>
              The quick forge preview
            </p>
            <p className="text-xs leading-5 text-[#a98a55]">
              Review readability, license notes, and intended text role before voting.
            </p>
          </div>
        ) : null}
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

function PipelineRecipePreview({
  recipe,
  expanded,
}: {
  recipe: AppearanceStylePreset;
  expanded: boolean;
}) {
  const isDivider = recipe.kind === 'divider';
  const isIcon = recipe.kind === 'icon';
  const isTextSurface = recipe.kind === 'textFrame'
    || recipe.targets.includes('text')
    || recipe.targets.includes('element');
  const visualStyle = {
    ...appearanceToStyle(recipe.appearance),
    clipPath: shapeClipPath(recipe.updates?.shapeKind),
  };
  const visualClassName = isDivider
    ? expanded ? 'h-5 w-full max-w-sm rounded-full' : 'h-3 w-12 rounded-full'
    : isIcon
      ? expanded ? 'grid h-24 w-24 place-items-center rounded-full' : 'grid h-11 w-11 place-items-center rounded-full'
      : expanded ? 'grid h-28 w-full max-w-60 place-items-center' : 'grid h-11 w-12 place-items-center';
  const glyphColor = recipe.appearance.material?.textColor
    || recipe.appearance.material?.strokeColor
    || recipe.appearance.border?.secondaryColor
    || recipe.appearance.border?.color
    || '#ffe7ad';

  return (
    <div
      className={`grid h-full w-full place-items-center ${expanded ? 'gap-4 p-5' : 'p-1'}`}
      role="img"
      aria-label={`${recipe.name} Pipeline recipe preview`}
    >
      <div className={visualClassName} style={visualStyle}>
        {isIcon ? (
          <Sparkles className={expanded ? 'h-11 w-11' : 'h-5 w-5'} style={{ color: glyphColor }} aria-hidden="true" />
        ) : isTextSurface && !isDivider ? (
          <span className={expanded ? 'font-serif text-3xl font-semibold' : 'font-serif text-sm font-semibold'} style={{ color: glyphColor }} aria-hidden="true">
            Aa
          </span>
        ) : null}
      </div>
      {expanded ? (
        <div className="text-center">
          <p className="font-serif text-lg text-[#ffe7ad]">{recipe.name}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#a98a55]">
            {getPipelineRecipeKindLabel(recipe.kind)} · {recipe.targets.join(', ')}
          </p>
        </div>
      ) : null}
    </div>
  );
}

const getPipelineRecipeKindLabel = (kind: AppearanceStylePreset['kind']): string => ({
  border: 'Border treatment',
  divider: 'Divider',
  frameKit: 'Frame kit',
  icon: 'Icon style',
  material: 'Material',
  shapeRole: 'Shape role',
  textFrame: 'Text frame',
  theme: 'Theme',
})[kind];

function TemplateComparisonPreview({
  label,
  template,
  id,
}: {
  label: string;
  template: TCGCardTemplate;
  id: string;
}) {
  return (
    <div className="grid content-start justify-items-center gap-2">
      <p className="text-xs uppercase tracking-[0.12em] text-[#a98a55]">{label}</p>
      <CardPreview
        card={{ template, data: template.templatePreviewData ?? {}, uniqueId: `developer-preview-${id}` }}
        targetWidthPx={240}
        isEditorPreview
      />
    </div>
  );
}