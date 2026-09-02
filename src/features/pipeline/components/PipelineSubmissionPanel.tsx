"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { FileUp, Library, UploadCloud } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  PIPELINE_STORAGE_ESTIMATE_BYTES,
  CONTRIBUTOR_UPLOAD_ASSET_TYPES,
  type ContributorUploadAssetType,
} from '@/features/pipeline/lib/pipelineItems';
import type { PipelineContributorSummary } from '@/features/pipeline/lib/pipelineProgram';
import type { PipelineUploadPlan } from '@/features/pipeline/lib/pipelineUploadPolicy';
import {
  pipelineSubmissionGuidance,
  getCandidateBrowseLabel,
  getCandidateSourceEmptyMessage,
  type PersonalLibraryFilter,
  type PersonalLibraryItem,
} from '@/features/pipeline/components/PipelineContributionModel';
import { ControlledTaxonomySelect } from '@/features/pipeline/components/ControlledTaxonomySelect';
import { FieldHelp } from '@/features/pipeline/components/PipelineContributionUi';
import { usePipelineSubmissionCandidates } from '@/features/pipeline/components/usePipelineSubmissionCandidates';
import {
  CARDFORGE_SPECIALTY_OPTIONS,
  CARDFORGE_USE_CASE_OPTIONS,
} from '@/features/pipeline/lib/contentTaxonomy';
import { getPipelineTypeLabel } from '@/features/pipeline/lib/pipelineAssetTaxonomy';
import {
  getDefaultPipelineStudioDestination,
  getPipelineStudioDestinationLabel,
  getPipelineStudioDestinationOptions,
} from '@/features/pipeline/lib/pipelineAssetTaxonomy';
import type { StudioAssetDestination } from '@/domain/templates';
import { readApiError } from '@/infrastructure/http/clientResponses';
import { trackProviderBoundaryOutcome } from '@/features/analytics/client/tracking';
import { ProjectBinaryAssetImage } from '@/features/project/client/binary-assets';

interface PipelineUploadPlanResponse {
  upload: PipelineUploadPlan;
}

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** exponent;
  return `${amount >= 10 || exponent === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[exponent]}`;
};

export function PipelineSubmissionPanel({
  context,
  onSubmitted,
  initialSetId = null,
}: {
  context: PipelineContributorSummary;
  onSubmitted: () => Promise<void>;
  initialSetId?: string | null;
}) {
  const { toast } = useToast();
  const [assetType, setAssetType] = useState<ContributorUploadAssetType>('icons');
  const [studioDestination, setStudioDestination] = useState<StudioAssetDestination | null>('element.icon');
  const [specialtyTags, setSpecialtyTags] = useState<string[]>([]);
  const [useCaseTags, setUseCaseTags] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const initialSelectionRef = useRef(false);
  const {
    filter: personalLibraryFilter,
    setFilter: setPersonalLibraryFilter,
    items: personalLibraryItems,
    visibleItems: visiblePersonalLibraryItems,
  } = usePipelineSubmissionCandidates();
  const submissionGuidance = pipelineSubmissionGuidance[assetType];
  const studioDestinationOptions = getPipelineStudioDestinationOptions(assetType);
  const expectedSourceSize = PIPELINE_STORAGE_ESTIMATE_BYTES[assetType];

  const selectCandidateFile = useCallback((file: File | null) => {
    setSelectedFile(file);
    if (file && !name.trim()) {
      setName(file.name.replace(/\.[^.]+$/, ''));
    }
  }, [name]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    selectCandidateFile(event.target.files?.[0] ?? null);
  };

  const changeAssetType = (nextAssetType: ContributorUploadAssetType) => {
    setAssetType(nextAssetType);
    setStudioDestination(getDefaultPipelineStudioDestination(nextAssetType));
    setPersonalLibraryFilter(nextAssetType);
  };

  const handleCandidateDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    selectCandidateFile(event.dataTransfer.files?.[0] ?? null);
  };

  const choosePersonalLibraryItem = useCallback(async (item: PersonalLibraryItem) => {
    try {
      const file = await item.createFile();
      setAssetType(item.assetType);
      setStudioDestination(getDefaultPipelineStudioDestination(item.assetType));
      setName((currentName) => currentName.trim() ? currentName : item.name);
      setDescription((currentDescription) => currentDescription.trim() ? currentDescription : item.helperText);
      setPreviewUrl((currentPreviewUrl) => currentPreviewUrl.trim() ? currentPreviewUrl : item.previewUrl ?? '');
      setSelectedFile(file);
      setFileInputKey((key) => key + 1);
      toast({
        title: 'Personal library item selected',
        description: `${item.name} is ready to send through Forge Review.`,
      });
    } catch (error) {
      toast({
        title: 'Library item unavailable',
        description: error instanceof Error ? error.message : 'Unable to prepare that library item.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    if (!initialSetId || initialSelectionRef.current) return;
    const item = personalLibraryItems.find((candidate) => candidate.id === `set-${initialSetId}`);
    if (!item) return;
    initialSelectionRef.current = true;
    void choosePersonalLibraryItem(item);
  }, [choosePersonalLibraryItem, initialSetId, personalLibraryItems]);

  const submitAsset = async () => {
    const submissionAssetType = assetType;
    const submissionStudioDestination = studioDestination;
    setIsSaving(true);
    let pendingUpload: PipelineUploadPlan | null = null;
    let submitted = false;
    try {
      if (!name.trim()) throw new Error('Name the asset before submitting.');
      if (!specialtyTags.length) throw new Error('Choose at least one CardForge specialty.');
      if (!useCaseTags.length) throw new Error('Choose at least one CardForge use case.');
      if (!selectedFile) throw new Error('Choose a source file before submitting.');

      const planResponse = await fetch('/api/pipeline/upload-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetType: submissionAssetType,
          studioDestination: submissionStudioDestination,
          fileName: selectedFile.name,
          fileSizeBytes: selectedFile.size,
          mimeType: selectedFile.type || 'application/octet-stream',
        }),
      });
      trackProviderBoundaryOutcome('pipeline', planResponse);
      if (!planResponse.ok) throw await readApiError(planResponse, 'Unable to prepare the source upload.');
      pendingUpload = (await planResponse.json() as PipelineUploadPlanResponse).upload;

      const uploadForm = new FormData();
      uploadForm.append('cacheControl', '3600');
      uploadForm.append('', selectedFile);
      const uploadResponse = await fetch(pendingUpload.signedUrl, {
        method: 'PUT',
        headers: { 'x-upsert': 'false' },
        body: uploadForm,
      });
      trackProviderBoundaryOutcome('pipeline', uploadResponse);
      if (!uploadResponse.ok) {
        throw new Error('The source file could not be uploaded to Forge Review storage. Retry the same file.');
      }

      const response = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetType: submissionAssetType,
          studioDestination: submissionStudioDestination,
          specialtyTags,
          useCaseTags,
          name,
          description,
          previewUrl,
          uploadedFile: {
            storagePath: pendingUpload.storagePath,
            fileName: pendingUpload.fileName,
            fileSizeBytes: pendingUpload.fileSizeBytes,
            mimeType: pendingUpload.mimeType,
          },
        }),
      });
      trackProviderBoundaryOutcome('pipeline', response);
      if (!response.ok) throw await readApiError(response, 'Unable to submit asset.');
      await response.json();
      submitted = true;
      await onSubmitted();
      setName('');
      setDescription('');
      setPreviewUrl('');
      setSpecialtyTags([]);
      setUseCaseTags([]);
      setSelectedFile(null);
      setFileInputKey((key) => key + 1);
      toast({ title: 'Asset submitted', description: 'Your classified asset is now in Forge Review.' });
    } catch (error) {
      toast({
        title: 'Asset not submitted',
        description: error instanceof Error ? error.message : 'Unable to submit asset.',
        variant: 'destructive',
      });
    } finally {
      if (pendingUpload && !submitted) {
        void fetch('/api/pipeline/upload-plan', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetType: submissionAssetType, storagePath: pendingUpload.storagePath }),
        });
      }
      setIsSaving(false);
    }
  };

  return (
    <div className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">Submit to the Pipeline</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--cf-text-muted)]">Choose owned work or a source file, classify it, then send it to Forge Review.</p>
          </div>
          <span className="border border-[var(--cf-border-subtle)] px-2 py-1 text-xs text-[var(--cf-text-subtle)]">{context.remainingSubmissions} submission{context.remainingSubmissions === 1 ? '' : 's'} left this month</span>
        </div>
        <div className="mt-4 grid gap-3">
          <div className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
            <label htmlFor="pipeline-asset-family" className="flex items-center justify-between gap-2">
              Asset family
              <FieldHelp text="Choose the accepted asset folder/type this submission belongs to so owners can cap and publish it correctly." />
            </label>
            <div className="grid grid-cols-2 gap-px overflow-hidden border border-[var(--cf-border)] bg-[var(--cf-border)] sm:grid-cols-3 lg:grid-cols-6" role="group" aria-label="Submission quick picks">
              {CONTRIBUTOR_UPLOAD_ASSET_TYPES.map((type) => {
                const isActive = assetType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    className={`min-h-14 px-3 py-2 text-left transition-colors ${isActive ? 'relative z-10 bg-[var(--cf-surface-hover)] text-[var(--cf-accent-text)] ring-1 ring-inset ring-[var(--cf-accent)]' : 'bg-[var(--cf-canvas)] text-[var(--cf-text-muted)] hover:bg-[var(--cf-surface)] hover:text-[var(--cf-accent-text)]'}`}
                    aria-pressed={isActive}
                    onClick={() => changeAssetType(type)}
                  >
                    <span className="block text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">
                      {type === 'sets' ? 'Set package' : type === 'fonts' ? 'Font upload' : 'Asset upload'}
                    </span>
                    <span className="mt-1 block font-medium">{getPipelineTypeLabel(type, { plural: false })}</span>
                  </button>
                );
              })}
            </div>
            <select
              id="pipeline-asset-family"
              className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)]"
              value={assetType}
              onChange={(event) => changeAssetType(event.target.value as ContributorUploadAssetType)}
            >
              {CONTRIBUTOR_UPLOAD_ASSET_TYPES.map((type) => (
                <option key={type} value={type}>{getPipelineTypeLabel(type, { plural: false })}</option>
              ))}
            </select>
          </div>
          {studioDestination ? <label htmlFor="pipeline-asset-studio-destination" className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
            <span className="flex items-center justify-between gap-2">
              Studio destination
              <FieldHelp text="Choose where creators should find this asset. CardForge only permits destinations compatible with the selected asset family." />
            </span>
            <select
              id="pipeline-asset-studio-destination"
              className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)]"
              value={studioDestination}
              onChange={(event) => setStudioDestination(event.target.value as StudioAssetDestination)}
            >
              {studioDestinationOptions.map((destination) => (
                <option key={destination} value={destination}>{getPipelineStudioDestinationLabel(destination)}</option>
              ))}
            </select>
            <span className="text-xs leading-5 text-[var(--cf-text-subtle)]">{submissionGuidance.destination}</span>
          </label> : <div className="grid gap-1 border border-[var(--cf-border-subtle)] bg-[var(--cf-canvas)] p-3 text-sm"><strong className="text-[var(--cf-accent-text)]">Published Set destination</strong><span className="text-xs leading-5 text-[var(--cf-text-subtle)]">Sets become immutable starters in Desk and Pipeline Library. Creators receive a new independent browser copy.</span></div>}
          <div className="grid gap-3 md:grid-cols-2">
            <ControlledTaxonomySelect
              label="Specialties"
              selectedIds={specialtyTags}
              options={CARDFORGE_SPECIALTY_OPTIONS}
              onChange={setSpecialtyTags}
              emptyLabel="Choose at least one specialty."
            />
            <ControlledTaxonomySelect
              label="Use cases"
              selectedIds={useCaseTags}
              options={CARDFORGE_USE_CASE_OPTIONS}
              onChange={setUseCaseTags}
              emptyLabel="Choose at least one use case."
            />
          </div>
          <p className="text-xs leading-5 text-[var(--cf-text-subtle)]">
            Studio destination controls where the asset appears. Specialty and use-case classification comes from CardForge's shared taxonomy and is stored with the submission from the start.
          </p>
          <label htmlFor="pipeline-asset-name" className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
            <span className="flex items-center justify-between gap-2">
              Name
              <FieldHelp text="Use a short library-facing name. This is what owners and peer reviewers see in queues." />
            </span>
            <input id="pipeline-asset-name" className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)]" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
            <span className="flex items-center justify-between gap-2">
              Candidate source
              <FieldHelp text="Choose from your browser library, drag a local file here, or browse your file directory. All three routes submit through the same review pipeline." />
            </span>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
              <div className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[var(--cf-accent-text)]">
                    <Library className="h-4 w-4 text-[var(--cf-accent)]" />
                    <span className="font-medium">Personal Library</span>
                  </div>
                  <select
                    className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] px-2 py-1 text-xs text-[var(--cf-accent-text)]"
                    value={personalLibraryFilter}
                    onChange={(event) => setPersonalLibraryFilter(event.target.value as PersonalLibraryFilter)}
                  >
                    <option value="all">All saved</option>
                    {CONTRIBUTOR_UPLOAD_ASSET_TYPES.map((type) => (
                      <option key={type} value={type}>{getPipelineTypeLabel(type)}</option>
                    ))}
                  </select>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--cf-text-subtle)]">
                  Pull locally saved Sets and art into Forge Review. Templates and Styles stay in their Studio-native authoring workflows.
                </p>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {visiblePersonalLibraryItems.length === 0 ? (
                    <p className="border border-dashed border-[var(--cf-border-subtle)] p-3 text-xs leading-5 text-[var(--cf-text-subtle)]">
                      {getCandidateSourceEmptyMessage(personalLibraryFilter === 'all' ? assetType : personalLibraryFilter)}
                    </p>
                  ) : visiblePersonalLibraryItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="grid w-full grid-cols-[2.75rem,minmax(0,1fr)] gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-2 text-left hover:border-[var(--cf-accent)] hover:bg-[#1e160d]"
                      onClick={() => void choosePersonalLibraryItem(item)}
                    >
                      <span className="grid h-11 w-11 place-items-center overflow-hidden border border-[var(--cf-border)] bg-[var(--cf-surface)]">
                        {item.previewUrl && !item.previewUrl.startsWith('/api/templates') ? (
                          <ProjectBinaryAssetImage source={item.previewUrl} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <FileUp className="h-4 w-4 text-[var(--cf-accent)]" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-[var(--cf-accent-text)]">{item.name}</span>
                        <span className="block text-xs text-[var(--cf-text-subtle)]">{item.sourceLabel} - {getPipelineTypeLabel(item.assetType, { plural: false })}</span>
                        <span className="block truncate text-xs text-[#6f5b3a]">{item.fileName}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <label
                className={`grid min-h-56 cursor-pointer place-items-center border border-dashed p-5 text-center transition-colors ${isDragActive ? 'border-[var(--cf-accent)] bg-[var(--cf-surface-hover)]' : 'border-[var(--cf-border)] bg-[var(--cf-canvas)]'}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragActive(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setIsDragActive(false)}
                onDrop={handleCandidateDrop}
              >
                <span className="grid gap-3">
                  <span className="mx-auto grid h-12 w-12 place-items-center border border-[var(--cf-border)] bg-[var(--cf-surface)] text-[var(--cf-accent)]">
                    <UploadCloud className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium text-[var(--cf-accent-text)]">{getCandidateBrowseLabel(assetType)}</span>
                  <span className="text-xs leading-5 text-[var(--cf-text-subtle)]">
                    {submissionGuidance.acceptedFileTypes}. Typical source size: about {formatBytes(expectedSourceSize)}. Owner ceiling: {context.maxSubmissionFileSizeMb} MB.
                  </span>
                  <input
                    key={fileInputKey}
                    type="file"
                    aria-label={`${getPipelineTypeLabel(assetType, { plural: false })} source file`}
                    accept={submissionGuidance.accept}
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </span>
              </label>
            </div>
            <span className="text-xs text-[var(--cf-text-subtle)]">
              {selectedFile
                ? `${selectedFile.name} - ${Math.ceil(selectedFile.size / 1024)} KB selected`
                : 'No source selected yet.'}
            </span>
          </div>
          <label htmlFor="pipeline-asset-preview-url" className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
            <span className="flex items-center justify-between gap-2">
              Preview URL (optional)
              <FieldHelp text="Optional. Leave blank to use the uploaded source file as the visual preview." />
            </span>
            <input id="pipeline-asset-preview-url" className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)]" value={previewUrl} onChange={(event) => setPreviewUrl(event.target.value)} />
          </label>
          <label htmlFor="pipeline-asset-notes" className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
            <span className="flex items-center justify-between gap-2">
              Notes
              <FieldHelp text={submissionGuidance.notesHelp} />
            </span>
            <textarea
              id="pipeline-asset-notes"
              className="min-h-24 border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)]"
              placeholder={submissionGuidance.notesHelp}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <Button className="bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]" disabled={isSaving || context.remainingSubmissions <= 0} onClick={submitAsset}>
            {isSaving ? 'Uploading...' : context.remainingSubmissions > 0 ? 'Send to Forge Review' : 'Monthly submission limit reached'}
          </Button>
        </div>
    </div>
  );
}
