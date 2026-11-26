"use client";

import { useState } from 'react';
import type { TCGCardTemplate } from '@/domain/templates';
import type { z } from 'zod/v4';

import { useToast } from '@/components/ui/use-toast';
import { getStudioAssetDestinationDefinition } from '@/domain/templates';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

import {
  normalizeCompatibilityTags,
  normalizeContentTaxonomyTags,
  type PipelineSemanticRole,
  type PipelineVariantKind,
} from '../lib/contentTaxonomy';
import {
  getPipelineStudioDestinationOptions,
} from '../lib/pipelineAssetTaxonomy';
import type { PipelineSubmission } from '../lib/pipelineProgram';
import { contributorDraftReceipt, contributorTemplateRevisionBase } from '../lib/contributorDraftContract';
import { EditSubmissionForm } from './PipelineSubmissionRows';
import { ContributorReviewFeedback } from './ContributorReviewFeedback';
import { ContributorRevisionContinue } from './ContributorRevisionContinue';

export function PipelineSubmissionEditPanel({
  submission,
  onCancel,
  onUpdated,
  onDirtyChange,
  savedTemplates,
  onContinueRevision,
}: {
  submission: PipelineSubmission;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onUpdated: () => Promise<void> | void;
  savedTemplates?: TCGCardTemplate[];
  onContinueRevision?: (template: TCGCardTemplate, revisionBase: z.infer<typeof contributorTemplateRevisionBase>) => Promise<void>;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(submission.name);
  const [description, setDescription] = useState(submission.description);
  const [previewUrl, setPreviewUrl] = useState(submission.previewUrl ?? '');
  const [sourceNotes, setSourceNotes] = useState(submission.sourceNotes ?? '');
  const [specialtyTags, setSpecialtyTags] = useState(submission.specialtyTags.join(','));
  const [useCaseTags, setUseCaseTags] = useState(submission.useCaseTags.join(','));
  const [semanticRole, setSemanticRole] = useState<PipelineSemanticRole>(submission.semanticRole);
  const [visualFamily, setVisualFamily] = useState(submission.visualFamily ?? '');
  const [variantKind, setVariantKind] = useState<PipelineVariantKind>(submission.variantKind);
  const [variantLabel, setVariantLabel] = useState(submission.variantLabel ?? '');
  const [compatibilityTags, setCompatibilityTags] = useState(submission.compatibilityTags.join(','));
  const [requestedStudioDestination, setRequestedStudioDestination] = useState(submission.requestedStudioDestination ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const governedDraft = submission.assetType === 'templates' && submission.status === 'draft' && (submission.baseRevisionNumber ?? 0) > 0;

  const destinationOptions = getPipelineStudioDestinationOptions(submission.assetType).map((value) => ({
    value,
    label: getStudioAssetDestinationDefinition(value).label,
  }));

  const save = async (submitDraft: boolean) => {
    setIsSaving(true);
    let rejected = false;
    try {
      const response = await fetch(`/api/pipeline/${submission.id}`, {
        method: submitDraft ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(governedDraft ? { name } : {
          name,
          description,
          previewUrl,
          sourceNotes,
          specialtyTags: normalizeContentTaxonomyTags(specialtyTags),
          useCaseTags: normalizeContentTaxonomyTags(useCaseTags),
          semanticRole,
          visualFamily,
          variantKind,
          variantLabel,
          compatibilityTags: normalizeCompatibilityTags(compatibilityTags),
          requestedStudioDestination,
        }),
      });
      const body = await response.clone().json().catch(() => null);
      const parsed = contributorDraftReceipt.safeParse(body?.receipt);
      if (!parsed.success) {
        rejected = response.status >= 400 && response.status < 500;
        throw new Error(await readApiErrorMessage(response, 'The exact write outcome could not be confirmed.'));
      }
      const receipt = parsed.data;
      if (receipt.submissionId !== submission.id) throw new Error('The response did not confirm this exact revision.');
      if (receipt.outcome === 'uncertain' || receipt.outcome === 'metadata_committed_not_submitted') {
        toast({ title: receipt.outcome === 'uncertain' ? 'Submission outcome not confirmed' : 'Classification saved; draft not submitted',
          description: `${receipt.warnings.join(' ')} Read the exact draft before any further write; do not replay automatically.`, variant: 'destructive' });
        return;
      }
      const warnings = [...receipt.warnings];
      const title = receipt.outcome === 'submitted' ? 'Draft submitted' : 'Metadata committed';
      const notice = toast({ title, description: ['The exact write is committed. Library refresh is pending.', ...warnings].join(' '), variant: warnings.length ? 'destructive' : 'default', duration: Infinity });
      try { await onUpdated(); } catch { warnings.push('Library refresh is incomplete. Read current state rather than repeating the committed write.'); }
      notice.update({ id: notice.id, title,
        description: warnings.length ? warnings.join(' ') : receipt.outcome === 'submitted' ? `${name} is ready for owner review.` : `${name} now reflects your saved details.`,
        variant: warnings.length ? 'destructive' : 'default', duration: 5000 });
    } catch (error) {
      toast({ title: rejected ? (submitDraft ? 'Draft was not submitted' : 'Submission was not updated') : 'Submission outcome not confirmed',
        description: `${error instanceof Error ? error.message : 'The Pipeline could not confirm this change.'}${rejected ? '' : ' Read the exact draft before any further write; do not replay automatically.'}`, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (submission.editorialReviewStatus && submission.editorialReviewStatus !== 'pending') return <>
    <ContributorReviewFeedback submissionId={submission.id} renderNext={(feedback) => feedback.revisionBase && savedTemplates && onContinueRevision
      ? <ContributorRevisionContinue templates={savedTemplates} revisionBase={feedback.revisionBase} onContinue={onContinueRevision} /> : null} />
    <p>This reviewed revision is preserved. Continue changes in a new revision of your saved work.</p>
  </>;

  if (governedDraft) return <section className="space-y-3">
    <h3>Review your correction</h3>
    <p>This revision keeps the published Template’s source, rights and classification. Continue design changes in your saved Template before submitting.</p>
    <p>{name}</p>
    <p>{description || 'No description on the published Template.'}</p>
    <button type="button" disabled={isSaving} onClick={() => void save(true)}>Submit correction for review</button>
    <button type="button" disabled={isSaving} onClick={onCancel}>Cancel</button>
  </section>;

  return <>
    {submission.status !== 'draft' ? <ContributorReviewFeedback submissionId={submission.id} /> : null}
    <EditSubmissionForm
    assetType={submission.assetType}
    name={name}
    description={description}
    previewUrl={previewUrl}
    sourceNotes={sourceNotes}
    specialtyTags={specialtyTags}
    useCaseTags={useCaseTags}
    semanticRole={semanticRole}
    visualFamily={visualFamily}
    variantKind={variantKind}
    variantLabel={variantLabel}
    compatibilityTags={compatibilityTags}
    requestedStudioDestination={requestedStudioDestination}
    destinationOptions={destinationOptions}
    isDraft={submission.status === 'draft'}
    isSaving={isSaving}
    onNameChange={value => { setName(value); onDirtyChange?.(true); }}
    onDescriptionChange={value => { setDescription(value); onDirtyChange?.(true); }}
    onPreviewUrlChange={value => { setPreviewUrl(value); onDirtyChange?.(true); }}
    onSourceNotesChange={value => { setSourceNotes(value); onDirtyChange?.(true); }}
    onSpecialtyTagsChange={value => { setSpecialtyTags(value); onDirtyChange?.(true); }}
    onUseCaseTagsChange={value => { setUseCaseTags(value); onDirtyChange?.(true); }}
    onSemanticRoleChange={value => { setSemanticRole(value); onDirtyChange?.(true); }}
    onVisualFamilyChange={value => { setVisualFamily(value); onDirtyChange?.(true); }}
    onVariantKindChange={value => { setVariantKind(value); onDirtyChange?.(true); }}
    onVariantLabelChange={value => { setVariantLabel(value); onDirtyChange?.(true); }}
    onCompatibilityTagsChange={value => { setCompatibilityTags(value); onDirtyChange?.(true); }}
    onRequestedStudioDestinationChange={value => { setRequestedStudioDestination(value); onDirtyChange?.(true); }}
    onCancel={onCancel}
    onSave={() => void save(false)}
    onSubmit={() => void save(true)}
    />
  </>;
}
