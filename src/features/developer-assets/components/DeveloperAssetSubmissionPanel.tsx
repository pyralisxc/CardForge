"use client";

import { useCallback, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { FileUp, Library, UploadCloud } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  DEVELOPER_ASSET_STORAGE_ESTIMATE_BYTES,
  DEVELOPER_ASSET_TYPES,
  type DeveloperAssetType,
} from '@/features/developer-assets/lib/developerAssets';
import type { DeveloperAssetProgramView } from '@/features/developer-assets/lib/developerAssetProgram';
import {
  developerAssetSubmissionGuidance,
  getCandidateBrowseLabel,
  getCandidateSourceEmptyMessage,
  type PersonalLibraryFilter,
  type PersonalLibraryItem,
} from '@/features/developer-assets/components/DeveloperAssetHubModel';
import { FieldHelp, GuidanceCard } from '@/features/developer-assets/components/DeveloperAssetHubUi';
import { useDeveloperPersonalLibrary } from '@/features/developer-assets/components/useDeveloperPersonalLibrary';
import { getDeveloperAssetTypeLabel } from '@/features/developer-assets/lib/pipelineAssetTaxonomy';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

interface DeveloperAssetsResponse {
  program: DeveloperAssetProgramView;
}
const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** exponent;
  return `${amount >= 10 || exponent === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[exponent]}`;
};

export function DeveloperAssetSubmissionPanel({
  program,
  onSubmitted,
}: {
  program: DeveloperAssetProgramView;
  onSubmitted: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [assetType, setAssetType] = useState<DeveloperAssetType>('icons');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const {
    filter: personalLibraryFilter,
    setFilter: setPersonalLibraryFilter,
    visibleItems: visiblePersonalLibraryItems,
  } = useDeveloperPersonalLibrary();
  const submissionGuidance = developerAssetSubmissionGuidance[assetType];
  const expectedSourceSize = DEVELOPER_ASSET_STORAGE_ESTIMATE_BYTES[assetType];

  const selectCandidateFile = useCallback((file: File | null) => {
    setSelectedFile(file);
    if (file && !name.trim()) {
      setName(file.name.replace(/\.[^.]+$/, ''));
    }
  }, [name]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    selectCandidateFile(event.target.files?.[0] ?? null);
  };

  const changeAssetType = (nextAssetType: DeveloperAssetType) => {
    setAssetType(nextAssetType);
    setPersonalLibraryFilter(nextAssetType);
  };

  const handleCandidateDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    selectCandidateFile(event.dataTransfer.files?.[0] ?? null);
  };

  const choosePersonalLibraryItem = async (item: PersonalLibraryItem) => {
    try {
      const file = await item.createFile();
      setAssetType(item.assetType);
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
  };

  const submitAsset = async () => {
    setIsSaving(true);
    try {
      if (!name.trim()) throw new Error('Name the asset before submitting.');
      if (!selectedFile) throw new Error('Choose a source file before submitting.');

      const formData = new FormData();
      formData.set('assetType', assetType);
      formData.set('name', name);
      formData.set('description', description);
      formData.set('previewUrl', previewUrl);
      formData.set('file', selectedFile);

      const response = await fetch('/api/developer-assets', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to submit asset.'));
      await response.json() as DeveloperAssetsResponse;
      await onSubmitted();
      setName('');
      setDescription('');
      setPreviewUrl('');
      setSelectedFile(null);
      setFileInputKey((key) => key + 1);
      toast({ title: 'Asset submitted', description: 'Your asset is now in the developer voting pipeline.' });
    } catch (error) {
      toast({
        title: 'Asset not submitted',
        description: error instanceof Error ? error.message : 'Unable to submit asset.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
          <TabsContent value="submit" className="mt-4">
            <div className="border border-[#5f4526] bg-[#100c08] p-4">
            <h3 className="font-serif text-xl text-[#fff1c7]">Submit a Library Candidate</h3>
            <p className="mt-2 text-sm leading-6 text-[#c7b288]">
              Candidate submissions enter the shared CardForge review pipeline. Local browser uploads remain private in your own workspace.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <GuidanceCard
                eyebrow="Destination"
                title={submissionGuidance.destination}
                body={`${getDeveloperAssetTypeLabel(assetType)} publish to this Studio surface after voting, owner review, and cap checks.`}
              />
              <GuidanceCard
                eyebrow="Source"
                title={submissionGuidance.sourceLabel}
                body={submissionGuidance.sourceHelp}
              />
              <GuidanceCard
                eyebrow="Reviewers check"
                title={submissionGuidance.checklist.join(' / ')}
                body={submissionGuidance.notesHelp}
              />
            </div>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-2 text-sm text-[#c7b288]">
                <label htmlFor="developer-asset-family" className="flex items-center justify-between gap-2">
                  Asset family
                  <FieldHelp text="Choose the accepted asset folder/type this submission belongs to so owners can cap and publish it correctly." />
                </label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label="Submission quick picks">
                  {DEVELOPER_ASSET_TYPES.map((type) => {
                    const isActive = assetType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        className={`border p-3 text-left transition-colors ${isActive ? 'border-[#d8b365] bg-[#2a1b0d] text-[#ffe7ad]' : 'border-[#5f4526] bg-[#0c0b09] text-[#c7b288] hover:border-[#8a642f] hover:text-[#ffe7ad]'}`}
                        aria-pressed={isActive}
                        onClick={() => changeAssetType(type)}
                      >
                        <span className="block text-xs uppercase tracking-[0.12em] text-[#a98a55]">
                          {type === 'fonts' ? 'Font upload' : 'Asset upload'}
                        </span>
                        <span className="mt-1 block font-medium">{getDeveloperAssetTypeLabel(type, { plural: false })}</span>
                      </button>
                    );
                  })}
                </div>
                <select
                  id="developer-asset-family"
                  className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]"
                  value={assetType}
                  onChange={(event) => changeAssetType(event.target.value as DeveloperAssetType)}
                >
                  {DEVELOPER_ASSET_TYPES.map((type) => (
                    <option key={type} value={type}>{getDeveloperAssetTypeLabel(type, { plural: false })}</option>
                  ))}
                </select>
              </div>
              <label htmlFor="developer-asset-name" className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Name
                  <FieldHelp text="Use a short library-facing name. This is what owners and peer reviewers see in queues." />
                </span>
                <input id="developer-asset-name" className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <div className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Candidate source
                  <FieldHelp text="Choose from your browser library, drag a local file here, or browse your file directory. All three routes submit through the same review pipeline." />
                </span>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
                  <div className="border border-[#5f4526] bg-[#0c0b09] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[#ffe7ad]">
                        <Library className="h-4 w-4 text-[#d7b469]" />
                        <span className="font-medium">Personal Library</span>
                      </div>
                      <select
                        className="border border-[#5f4526] bg-[#100c08] px-2 py-1 text-xs text-[#ffe7ad]"
                        value={personalLibraryFilter}
                        onChange={(event) => setPersonalLibraryFilter(event.target.value as PersonalLibraryFilter)}
                      >
                        <option value="all">All saved</option>
                        {DEVELOPER_ASSET_TYPES.map((type) => (
                          <option key={type} value={type}>{getDeveloperAssetTypeLabel(type)}</option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#a98a55]">
                      Pull saved templates, Appearance Studio styles, and local art into Forge Review. Export a project file when you need to move this browser library to another device.
                    </p>
                    <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                      {visiblePersonalLibraryItems.length === 0 ? (
                        <p className="border border-dashed border-[#3c2c1b] p-3 text-xs leading-5 text-[#a98a55]">
                          {getCandidateSourceEmptyMessage(personalLibraryFilter === 'all' ? assetType : personalLibraryFilter)}
                        </p>
                      ) : visiblePersonalLibraryItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="grid w-full grid-cols-[2.75rem,minmax(0,1fr)] gap-3 border border-[#3c2c1b] bg-[#100c08] p-2 text-left hover:border-[#d8b365] hover:bg-[#1e160d]"
                          onClick={() => void choosePersonalLibraryItem(item)}
                        >
                          <span className="grid h-11 w-11 place-items-center overflow-hidden border border-[#5f4526] bg-[#15100a]">
                            {item.previewUrl && !item.previewUrl.startsWith('/api/templates') ? (
                              <img src={item.previewUrl} alt="" className="h-full w-full object-contain" />
                            ) : (
                              <FileUp className="h-4 w-4 text-[#d7b469]" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-[#ffe7ad]">{item.name}</span>
                            <span className="block text-xs text-[#a98a55]">{item.sourceLabel} - {getDeveloperAssetTypeLabel(item.assetType, { plural: false })}</span>
                            <span className="block truncate text-xs text-[#6f5b3a]">{item.fileName}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <label
                    className={`grid min-h-56 cursor-pointer place-items-center border border-dashed p-5 text-center transition-colors ${isDragActive ? 'border-[#d8b365] bg-[#2a1b0d]' : 'border-[#5f4526] bg-[#0c0b09]'}`}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setIsDragActive(true);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={() => setIsDragActive(false)}
                    onDrop={handleCandidateDrop}
                  >
                    <span className="grid gap-3">
                      <span className="mx-auto grid h-12 w-12 place-items-center border border-[#5f4526] bg-[#15100a] text-[#d7b469]">
                        <UploadCloud className="h-5 w-5" />
                      </span>
                      <span className="text-sm font-medium text-[#ffe7ad]">{getCandidateBrowseLabel(assetType)}</span>
                      <span className="text-xs leading-5 text-[#a98a55]">
                        {submissionGuidance.acceptedFileTypes}. Typical source size: about {formatBytes(expectedSourceSize)}.
                      </span>
                      <input
                        key={fileInputKey}
                        type="file"
                        aria-label={`${getDeveloperAssetTypeLabel(assetType, { plural: false })} source file`}
                        accept={submissionGuidance.accept}
                        className="sr-only"
                        onChange={handleFileChange}
                      />
                    </span>
                  </label>
                </div>
                <span className="text-xs text-[#a98a55]">
                  {selectedFile
                    ? `${selectedFile.name} - ${Math.ceil(selectedFile.size / 1024)} KB selected`
                    : 'No source selected yet.'}
                </span>
              </div>
              <label htmlFor="developer-asset-preview-url" className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Preview URL (optional)
                  <FieldHelp text="Optional. Leave blank to use the uploaded source file as the visual preview." />
                </span>
                <input id="developer-asset-preview-url" className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={previewUrl} onChange={(event) => setPreviewUrl(event.target.value)} />
              </label>
              <label htmlFor="developer-asset-notes" className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Notes
                  <FieldHelp text={submissionGuidance.notesHelp} />
                </span>
                <textarea
                  id="developer-asset-notes"
                  className="min-h-24 border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]"
                  placeholder={submissionGuidance.notesHelp}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <Button className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={isSaving || program.remainingSubmissions <= 0} onClick={submitAsset}>
                {isSaving ? 'Uploading...' : 'Send to Forge Review'}
              </Button>
            </div>
          </div>
          </TabsContent>
  );
}
