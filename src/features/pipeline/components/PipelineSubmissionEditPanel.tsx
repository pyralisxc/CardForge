"use client";

import { useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { getStudioAssetDestinationDefinition } from '@/domain/templates';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

import { normalizeContentTaxonomyTags } from '../lib/contentTaxonomy';
import {
  getPipelineStudioDestinationOptions,
} from '../lib/pipelineAssetTaxonomy';
import type { PipelineSubmission } from '../lib/pipelineProgram';
import { EditSubmissionForm } from './PipelineSubmissionRows';

export function PipelineSubmissionEditPanel({
  submission,
  onCancel,
  onUpdated,
}: {
  submission: PipelineSubmission;
  onCancel: () => void;
  onUpdated: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(submission.name);
  const [description, setDescription] = useState(submission.description);
  const [previewUrl, setPreviewUrl] = useState(submission.previewUrl ?? '');
  const [sourceNotes, setSourceNotes] = useState(submission.sourceNotes ?? '');
  const [specialtyTags, setSpecialtyTags] = useState(submission.specialtyTags.join(','));
  const [useCaseTags, setUseCaseTags] = useState(submission.useCaseTags.join(','));
  const [requestedStudioDestination, setRequestedStudioDestination] = useState(submission.requestedStudioDestination ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const destinationOptions = getPipelineStudioDestinationOptions(submission.assetType).map((value) => ({
    value,
    label: getStudioAssetDestinationDefinition(value).label,
  }));

  const save = async (submitDraft: boolean) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/pipeline/${submission.id}`, {
        method: submitDraft ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          previewUrl,
          sourceNotes,
          specialtyTags: normalizeContentTaxonomyTags(specialtyTags),
          useCaseTags: normalizeContentTaxonomyTags(useCaseTags),
          requestedStudioDestination,
        }),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, submitDraft ? 'Unable to submit this Pipeline draft.' : 'Unable to update this Pipeline submission.'));
      toast({
        title: submitDraft ? 'Draft submitted' : 'Submission updated',
        description: submitDraft
          ? `${name} is ready for owner review.`
          : `${name} now reflects your latest details.`,
      });
      await onUpdated();
    } catch (error) {
      toast({
        title: submitDraft ? 'Draft was not submitted' : 'Submission was not updated',
        description: error instanceof Error ? error.message : 'The Pipeline could not save this change.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return <EditSubmissionForm
    assetType={submission.assetType}
    name={name}
    description={description}
    previewUrl={previewUrl}
    sourceNotes={sourceNotes}
    specialtyTags={specialtyTags}
    useCaseTags={useCaseTags}
    requestedStudioDestination={requestedStudioDestination}
    destinationOptions={destinationOptions}
    isDraft={submission.status === 'draft'}
    isSaving={isSaving}
    onNameChange={setName}
    onDescriptionChange={setDescription}
    onPreviewUrlChange={setPreviewUrl}
    onSourceNotesChange={setSourceNotes}
    onSpecialtyTagsChange={setSpecialtyTags}
    onUseCaseTagsChange={setUseCaseTags}
    onRequestedStudioDestinationChange={setRequestedStudioDestination}
    onCancel={onCancel}
    onSave={() => void save(false)}
    onSubmit={() => void save(true)}
  />;
}
