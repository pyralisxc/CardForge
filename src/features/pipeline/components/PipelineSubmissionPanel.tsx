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
import { getPipelineUploadTransportBlob, type PipelineUploadPlan } from '@/features/pipeline/lib/pipelineUploadPolicy';
import {
  getPipelineSubmissionGuidance,
  getCandidateBrowseLabel,
  getCandidateSourceEmptyMessage,
  type PersonalLibraryFilter,
  type PersonalLibraryItem,
} from '@/features/pipeline/components/PipelineContributionModel';
import { ControlledTaxonomySelect } from '@/features/pipeline/components/ControlledTaxonomySelect';
import { ContentQualityGuidance } from '@/features/pipeline/components/ContentQualityGuidance';
import { buildPipelineSourceEvidence, type PipelineAiAssistance } from '@/features/pipeline/lib/contentQualityStandard';
import { FieldHelp } from '@/features/pipeline/components/PipelineContributionUi';
import { usePipelineSubmissionCandidates } from '@/features/pipeline/components/usePipelineSubmissionCandidates';
import {
  hasRequiredPipelineClassification,
  CARDFORGE_COMPATIBILITY_OPTIONS,
  CARDFORGE_SPECIALTY_OPTIONS,
  CARDFORGE_USE_CASE_OPTIONS,
  CARDFORGE_VARIANT_KIND_OPTIONS,
  getDefaultSemanticRole,
  getSemanticRoleOptions,
  type PipelineSemanticRole,
  type PipelineVariantKind,
} from '@/features/pipeline/lib/contentTaxonomy';
import { getPipelineTypeLabel } from '@/features/pipeline/lib/pipelineAssetTaxonomy';
import {
  getDefaultPipelineStudioDestination,
  getPipelineStudioDestinationLabel,
  getPipelineStudioDestinationOptions,
} from '@/features/pipeline/lib/pipelineAssetTaxonomy';
import type { StudioAssetDestination } from '@/domain/templates';
import { readApiError } from '@/infrastructure/http/clientResponses';
import { observeProviderBoundaryResponse } from '@/features/analytics/client/tracking';
import { ProjectBinaryAssetImage } from '@/features/project/client/binary-assets';
import { lookupUploadAttempt, readUploadAttempt, removeUploadAttempt, saveUploadAttempt, withUploadAttemptLock, type PipelineUploadAttempt } from '@/features/pipeline/client/uploadAttempts';

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
  contributorId,
  onSubmitted,
  initialSetId = null,
}: {
  context: PipelineContributorSummary;
  contributorId: string;
  onSubmitted: () => Promise<void>;
  initialSetId?: string | null;
}) {
  const { toast } = useToast();
  const [assetType, setAssetType] = useState<ContributorUploadAssetType>('icons');
  const [studioDestination, setStudioDestination] = useState<StudioAssetDestination | null>('element.icon');
  const [specialtyTags, setSpecialtyTags] = useState<string[]>([]);
  const [useCaseTags, setUseCaseTags] = useState<string[]>([]);
  const [semanticRole, setSemanticRole] = useState<PipelineSemanticRole>('icon');
  const [visualFamily, setVisualFamily] = useState('');
  const [variantKind, setVariantKind] = useState<PipelineVariantKind>('base');
  const [variantLabel, setVariantLabel] = useState('');
  const [compatibilityTags, setCompatibilityTags] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rightsAndSources, setRightsAndSources] = useState('');
  const [aiAssistance, setAiAssistance] = useState<PipelineAiAssistance | ''>('');
  const [aiProcess, setAiProcess] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<PipelineUploadAttempt | null>(null);
  const [receipt, setReceipt] = useState<{ state: 'pending' | 'owned'; submissionId: string | null; storagePath: string } | null>(null);
  const recoveryRequest = useRef(0);
  const initialSelectionRef = useRef(false);
  const {
    filter: personalLibraryFilter,
    setFilter: setPersonalLibraryFilter,
    items: personalLibraryItems,
    visibleItems: visiblePersonalLibraryItems,
    loadError: personalLibraryError,
    refresh: refreshPersonalLibrary,
  } = usePipelineSubmissionCandidates();
  const submissionGuidance = getPipelineSubmissionGuidance(assetType, studioDestination);
  const studioDestinationOptions = getPipelineStudioDestinationOptions(assetType);
  const expectedSourceSize = PIPELINE_STORAGE_ESTIMATE_BYTES[assetType];

  const refreshRecovery = useCallback(async () => {
    const request = ++recoveryRequest.current;
    setRecoveryReady(false);
    try { const saved = await readUploadAttempt(contributorId); if (request === recoveryRequest.current) { setAttempt(saved); setReceipt(current => current?.storagePath === saved?.payload.uploadedFile.storagePath ? current : null); setRecoveryError(null); } }
    catch (error) { if (request === recoveryRequest.current) setRecoveryError(error instanceof Error ? error.message : 'Saved submission attempts are unavailable.'); }
    finally { if (request === recoveryRequest.current) setRecoveryReady(true); }
  }, [contributorId]);
  useEffect(() => { setReceipt(null); void refreshRecovery(); const focus = () => { void refreshRecovery(); };
    window.addEventListener('focus', focus); return () => { recoveryRequest.current += 1; window.removeEventListener('focus', focus); };
  }, [refreshRecovery]);

  const checkAttempt = async (retry = false) => {
    setIsSaving(true); setRecoveryError(null);
    try {
      await withUploadAttemptLock(contributorId, async () => {
        const saved = await readUploadAttempt(contributorId);
        if (!saved) throw new Error('The saved submission attempt is no longer available.');
        let result = await lookupUploadAttempt(saved);
        if (retry && result.state === 'pending') {
          const response = await fetch('/api/pipeline', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pipeline-Contributor': contributorId }, body: JSON.stringify(saved.payload) });
          if (!response.ok || (await response.json()).submitted !== true) throw new Error('The submission outcome is still unconfirmed. Check the saved attempt again.');
          result = await lookupUploadAttempt(saved);
        }
        setAttempt(saved); setReceipt({ ...result, storagePath: saved.payload.uploadedFile.storagePath });
      });
    } catch (error) { setReceipt(null); setRecoveryError(error instanceof Error ? error.message : 'The submission outcome is still unconfirmed.'); }
    finally { setIsSaving(false); }
  };

  const finishRecoveredAttempt = async () => {
    setIsSaving(true);
    try {
      await withUploadAttemptLock(contributorId, async () => {
        const saved = await readUploadAttempt(contributorId);
        if (!saved || (await lookupUploadAttempt(saved)).state !== 'owned') throw new Error('The exact submission could not be confirmed.');
        await removeUploadAttempt(contributorId);
      });
      setAttempt(null); setReceipt(null); setSelectedFile(null); setName(''); setDescription('');
      setRightsAndSources(''); setAiAssistance(''); setAiProcess(''); setPreviewUrl(''); setSpecialtyTags([]); setUseCaseTags([]);
      setSemanticRole(getDefaultSemanticRole(assetType, studioDestination)); setVisualFamily(''); setVariantKind('base'); setVariantLabel(''); setCompatibilityTags([]); setFileInputKey(key => key + 1);
      await onSubmitted();
    } catch (error) { setRecoveryError(error instanceof Error ? error.message : 'The saved submission could not be cleared.'); }
    finally { setIsSaving(false); }
  };

  const discardPendingAttempt = async () => {
    setIsSaving(true); setRecoveryError(null);
    try {
      await withUploadAttemptLock(contributorId, async () => {
        const saved = await readUploadAttempt(contributorId);
        if (!saved || (await lookupUploadAttempt(saved)).state !== 'pending') throw new Error('This upload is no longer confirmed pending. Check its outcome again.');
        const response = await fetch('/api/pipeline/upload-plan', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'X-Pipeline-Contributor': contributorId }, body: JSON.stringify({ assetType: saved.payload.assetType, storagePath: saved.payload.uploadedFile.storagePath }) }).catch(() => { throw new Error('Upload cleanup could not be confirmed. The saved attempt has been preserved.'); });
        if (!response.ok || (await response.json()).removed !== true) throw new Error('Upload cleanup could not be confirmed. The saved attempt has been preserved.');
        await removeUploadAttempt(contributorId);
      });
      setAttempt(null); setReceipt(null);
    } catch (error) { setReceipt(null); setRecoveryError(error instanceof Error ? error.message : 'Upload cleanup could not be confirmed.'); }
    finally { setIsSaving(false); }
  };

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
    const nextDestination = getDefaultPipelineStudioDestination(nextAssetType);
    setAssetType(nextAssetType);
    setStudioDestination(nextDestination);
    setSemanticRole(getDefaultSemanticRole(nextAssetType, nextDestination));
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
      const nextDestination = getDefaultPipelineStudioDestination(item.assetType);
      setAssetType(item.assetType);
      setStudioDestination(nextDestination);
      setSemanticRole(getDefaultSemanticRole(item.assetType, nextDestination));
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
    const pendingUpload: { plan: PipelineUploadPlan | null } = { plan: null };
    let submitted = false;
    let retained = false;
    try {
      await withUploadAttemptLock(contributorId, async () => {
        if (await readUploadAttempt(contributorId)) throw new Error('Check the saved submission attempt before starting another.');
        if (!name.trim()) throw new Error('Name the asset before submitting.');
        if (!specialtyTags.length) throw new Error('Choose at least one CardForge specialty.');
        if (!hasRequiredPipelineClassification(assetType, specialtyTags, useCaseTags)) throw new Error('Choose at least one CardForge use case.');
        if (!selectedFile) throw new Error('Choose a source file before submitting.');
        const sourceEvidence = buildPipelineSourceEvidence({ rightsAndSources, aiAssistance, aiProcess });
        if (!sourceEvidence.ok) throw new Error(sourceEvidence.message);

        const planResponse = await observeProviderBoundaryResponse('pipeline', 'pipeline_upload_plan', () => fetch('/api/pipeline/upload-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Pipeline-Contributor': contributorId },
          body: JSON.stringify({
            assetType: submissionAssetType,
            studioDestination: submissionStudioDestination,
            fileName: selectedFile.name,
            fileSizeBytes: selectedFile.size,
            mimeType: selectedFile.type || 'application/octet-stream',
          }),
        }));
        if (!planResponse.ok) throw await readApiError(planResponse, 'Unable to prepare the source upload.');
        const uploadPlan = (await planResponse.json() as PipelineUploadPlanResponse).upload;
        pendingUpload.plan = uploadPlan;

        const uploadForm = new FormData();
        uploadForm.append('cacheControl', '3600');
        uploadForm.append('', getPipelineUploadTransportBlob(selectedFile), selectedFile.name);
        const uploadResponse = await observeProviderBoundaryResponse('pipeline', 'pipeline_upload', () => fetch(uploadPlan.signedUrl, {
          method: 'PUT',
          headers: { 'x-upsert': 'false' },
          body: uploadForm,
        }));
        if (!uploadResponse.ok) {
          throw new Error('The source file could not be uploaded to Forge Review storage. Retry the same file.');
        }

        const savedAttempt: PipelineUploadAttempt = { contributorId, payload: {
            assetType: submissionAssetType,
            studioDestination: submissionStudioDestination,
            specialtyTags,
            useCaseTags,
            semanticRole,
            visualFamily,
            variantKind,
            variantLabel,
            compatibilityTags,
            name,
            description,
            sourceNotes: sourceEvidence.value,
            previewUrl,
            uploadedFile: {
              storagePath: uploadPlan.storagePath,
              fileName: uploadPlan.fileName,
              fileSizeBytes: uploadPlan.fileSizeBytes,
              mimeType: uploadPlan.mimeType,
            },
          } };
        await saveUploadAttempt(savedAttempt);
        retained = true; setAttempt(savedAttempt); setReceipt(null);
        const response = await observeProviderBoundaryResponse('pipeline', 'pipeline_submit', () => fetch('/api/pipeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Pipeline-Contributor': contributorId },
          body: JSON.stringify(savedAttempt.payload),
        }));
        if (!response.ok) throw await readApiError(response, 'Unable to submit asset.');
        if ((await response.json()).submitted !== true) throw new Error('The submission receipt could not be verified.');
        submitted = true;
        try { await removeUploadAttempt(contributorId); setAttempt(null); }
        catch { toast({ title: 'Asset submitted', description: 'Your submission was recorded. The saved recovery record remains; check it before another submission.' }); }
        await onSubmitted();
        setName('');
        setDescription('');
        setRightsAndSources('');
        setAiAssistance('');
        setAiProcess('');
        setPreviewUrl('');
        setSpecialtyTags([]);
        setUseCaseTags([]);
        setSemanticRole(getDefaultSemanticRole(assetType, studioDestination));
        setVisualFamily('');
        setVariantKind('base');
        setVariantLabel('');
        setCompatibilityTags([]);
        setSelectedFile(null);
        setFileInputKey((key) => key + 1);
        toast({ title: 'Asset submitted', description: 'Your classified asset is now in Forge Review.' });
      });
    } catch (error) {
      toast({
        title: submitted ? 'Asset submitted' : retained ? 'Submission outcome unconfirmed' : 'Asset not submitted',
        description: submitted ? 'The submission was recorded, but its follow-up view could not be refreshed.' : error instanceof Error ? error.message : 'Unable to submit asset.',
        variant: submitted ? 'default' : 'destructive',
      });
    } finally {
      if (pendingUpload.plan && !submitted && !retained) {
        void fetch('/api/pipeline/upload-plan', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'X-Pipeline-Contributor': contributorId },
          body: JSON.stringify({ assetType: submissionAssetType, storagePath: pendingUpload.plan.storagePath }),
        });
      }
      setIsSaving(false);
    }
  };

  return (
    <div data-pipeline-contribution-panel className="min-w-0 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4">
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
            <div data-pipeline-asset-picks className="grid grid-cols-2 gap-px overflow-hidden border border-[var(--cf-border)] bg-[var(--cf-border)]" role="group" aria-label="Submission quick picks">
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
              onChange={(event) => {
                const nextDestination = event.target.value as StudioAssetDestination;
                setStudioDestination(nextDestination);
                setSemanticRole(getDefaultSemanticRole(assetType, nextDestination));
              }}
            >
              {studioDestinationOptions.map((destination) => (
                <option key={destination} value={destination}>{getPipelineStudioDestinationLabel(destination)}</option>
              ))}
            </select>
            <span className="text-xs leading-5 text-[var(--cf-text-subtle)]">{submissionGuidance.destination}</span>
          </label> : <div className="grid gap-1 border border-[var(--cf-border-subtle)] bg-[var(--cf-canvas)] p-3 text-sm"><strong className="text-[var(--cf-accent-text)]">Published Set destination</strong><span className="text-xs leading-5 text-[var(--cf-text-subtle)]">Sets become immutable starters in Desk and Pipeline Library. Creators receive a new independent browser copy.</span></div>}
          <div className="grid gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-canvas)] p-3">
            <div>
              <p className="text-sm font-semibold text-[var(--cf-accent-text)]">Content identity</p>
              <p className="mt-1 text-xs leading-5 text-[var(--cf-text-subtle)]">
                Semantic role describes what this object is. Studio destination only controls where creators find it.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm text-[var(--cf-text-muted)]">
                Semantic role
                <select
                  className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] px-3 text-[var(--cf-accent-text)]"
                  value={semanticRole}
                  onChange={(event) => setSemanticRole(event.target.value as PipelineSemanticRole)}
                >
                  {getSemanticRoleOptions(assetType).map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm text-[var(--cf-text-muted)]">
                Visual family / pack <span className="text-xs text-[var(--cf-text-subtle)]">Optional</span>
                <input
                  className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] px-3 text-[var(--cf-accent-text)]"
                  maxLength={80}
                  placeholder="e.g. Ember Court"
                  value={visualFamily}
                  onChange={(event) => setVisualFamily(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm text-[var(--cf-text-muted)]">
                Family relationship
                <select
                  className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] px-3 text-[var(--cf-accent-text)]"
                  value={variantKind}
                  onChange={(event) => setVariantKind(event.target.value as PipelineVariantKind)}
                >
                  {CARDFORGE_VARIANT_KIND_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm text-[var(--cf-text-muted)]">
                Variant label <span className="text-xs text-[var(--cf-text-subtle)]">Optional</span>
                <input
                  className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] px-3 text-[var(--cf-accent-text)]"
                  maxLength={80}
                  placeholder="e.g. Poker format"
                  value={variantLabel}
                  onChange={(event) => setVariantLabel(event.target.value)}
                />
              </label>
            </div>
            <ControlledTaxonomySelect
              label="Compatibility"
              selectedIds={compatibilityTags}
              options={CARDFORGE_COMPATIBILITY_OPTIONS}
              onChange={setCompatibilityTags}
              emptyLabel="Optional compositional traits such as Print, Full Bleed, or Tileable."
            />
          </div>
          <ContentQualityGuidance role={semanticRole} />
          <div data-pipeline-taxonomy-grid className="grid gap-3">
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
              emptyLabel={hasRequiredPipelineClassification(assetType, specialtyTags, []) ? 'Optional for a General reusable resource.' : 'Choose at least one use case.'}
            />
          </div>
          <p className="text-xs leading-5 text-[var(--cf-text-subtle)]">
            Semantic role identifies the object itself. Visual family and variant group related treatments. Studio destination controls placement; specialties, use cases, and compatibility remain controlled discovery metadata.
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
            <div data-pipeline-candidate-grid className="grid min-w-0 gap-3">
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
                  {personalLibraryError ? <div role="alert" className="text-sm text-[var(--cf-danger)]">
                    <p>Saved artwork unavailable: {personalLibraryError}</p>
                    <Button type="button" variant="outline" onClick={() => void refreshPersonalLibrary()}>Retry</Button>
                  </div> : null}
                  {visiblePersonalLibraryItems.length === 0 && !personalLibraryError ? (
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
          <section className="grid gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-canvas)] p-3" aria-label="Source rights and AI disclosure">
            <div>
              <p className="text-sm font-semibold text-[var(--cf-accent-text)]">Source, rights and creative process</p>
              <p className="text-xs leading-5 text-[var(--cf-text-subtle)]">Required for editorial approval. Private review evidence is not projected into the public catalog. Do not include sensitive prompts, user data or secrets.</p>
            </div>
            <label className="grid gap-1 text-sm text-[var(--cf-text-muted)]">
              Creator, sources, licenses and publication rights
              <textarea className="min-h-24 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-3 text-[var(--cf-accent-text)]" maxLength={540} value={rightsAndSources} placeholder="Who made it? Which sources and licenses permit CardForge publication?" onChange={(event) => setRightsAndSources(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-[var(--cf-text-muted)]">
              AI assistance
              <select className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-3 text-[var(--cf-accent-text)]" value={aiAssistance} onChange={(event) => setAiAssistance(event.target.value as PipelineAiAssistance | '')}>
                <option value="">Choose AI-use disclosure</option>
                <option value="none">No AI assistance used</option>
                <option value="used">AI-assisted or generated</option>
              </select>
            </label>
            {aiAssistance === 'used' ? <label className="grid gap-1 text-sm text-[var(--cf-text-muted)]">
              Non-sensitive AI process and human edits
              <textarea className="min-h-24 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-3 text-[var(--cf-accent-text)]" maxLength={400} placeholder="Tool/model and date if known; references, creation summary, edits and review." value={aiProcess} onChange={(event) => setAiProcess(event.target.value)} />
            </label> : null}
          </section>
          {recoveryError ? <div><p role="alert">{recoveryError}</p>{!attempt ? <Button type="button" variant="outline" disabled={isSaving} onClick={() => void refreshRecovery()}>Retry recovery access</Button> : null}</div> : null}
          {attempt?.contributorId === contributorId ? <section aria-label="Saved submission attempt" className="grid gap-2 border border-[var(--cf-border)] p-3 text-sm">
            <strong>Saved submission: {attempt.payload.name}</strong>
            <p>{receipt?.state === 'owned' ? `Submitted to Forge Review. Submission ID: ${receipt.submissionId}` : receipt?.state === 'pending' ? 'This exact upload has not been submitted. You may retry the saved request.' : 'The submission may have completed. Check its outcome before starting another.'}</p>
            <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={isSaving} onClick={() => void checkAttempt()}>Check submission outcome</Button>
              {receipt?.state === 'pending' ? <><Button type="button" variant="outline" disabled={isSaving} onClick={() => void checkAttempt(true)}>Retry original submission</Button><Button type="button" variant="outline" disabled={isSaving} onClick={() => void discardPendingAttempt()}>Discard pending upload</Button></> : null}
              {receipt?.state === 'owned' ? <Button type="button" variant="outline" disabled={isSaving} onClick={() => void finishRecoveredAttempt()}>Done</Button> : null}</div>
          </section> : null}
          <Button className="bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]" disabled={isSaving || !recoveryReady || Boolean(recoveryError) || Boolean(attempt) || context.remainingSubmissions <= 0} onClick={submitAsset}>
            {isSaving ? 'Uploading...' : context.remainingSubmissions > 0 ? 'Send to Forge Review' : 'Monthly submission limit reached'}
          </Button>
        </div>
    </div>
  );
}
