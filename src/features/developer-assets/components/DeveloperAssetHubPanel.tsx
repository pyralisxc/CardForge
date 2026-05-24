"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { Archive, Check, Info, ThumbsDown, ThumbsUp, UploadCloud } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { DEVELOPER_ASSET_TYPES, type DeveloperAssetAccessTier, type DeveloperAssetType } from '@/lib/developerAssets';
import type { DeveloperAssetProgramView } from '@/lib/developerAssetStore';

interface DeveloperAssetsResponse {
  program: DeveloperAssetProgramView;
}

interface UploadedDeveloperAsset {
  bucket: string;
  path: string;
  sourceUrl: string;
  previewUrl: string;
  fileSizeBytes: number;
  mimeType: string | null;
  fileName: string;
}

const assetTypeLabels: Record<DeveloperAssetType, string> = {
  templates: 'Template',
  elementPresets: 'Element Preset',
  textures: 'Texture',
  dividers: 'Divider',
  icons: 'Icon',
  imageAssets: 'Image Asset',
  parts: 'Part',
};

const tierLabels: Record<DeveloperAssetAccessTier, string> = {
  hidden: 'Hidden',
  free: 'Starter Library',
  paid: 'Creator Pass',
  developer: 'Forge Review',
  official: 'Official Default',
};

const tierClasses: Record<DeveloperAssetAccessTier, string> = {
  hidden: 'border-[#4a3823] text-[#8f95a3]',
  free: 'border-[#5f7f54] text-[#bde3a8]',
  paid: 'border-[#8a642f] text-[#f0c568]',
  developer: 'border-[#35445a] text-[#b9d5ff]',
  official: 'border-[#d8b365] text-[#ffe7ad]',
};

const getApiErrorMessage = async (response: Response, fallback: string) => {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
};

export function DeveloperAssetHubPanel({ compact = false }: { compact?: boolean }) {
  const { toast } = useToast();
  const [program, setProgram] = useState<DeveloperAssetProgramView | null>(null);
  const [assetType, setAssetType] = useState<DeveloperAssetType>('icons');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedAsset, setUploadedAsset] = useState<UploadedDeveloperAsset | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const ownSubmissions = useMemo(() => (
    program?.submissions.filter((submission) => submission.developerId === program.currentUserId) ?? []
  ), [program]);

  const loadProgram = useCallback(async (attempt = 0) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/developer-assets', { cache: 'no-store' });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to load developer asset hub.'));
      const body = await response.json() as DeveloperAssetsResponse;
      setProgram(body.program);
      setIsLoading(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load developer asset hub.';
      if (attempt < 2) {
        window.setTimeout(() => {
          void loadProgram(attempt + 1);
        }, 1200);
        return;
      }
      setLoadError(message);
      toast({ title: 'Developer asset hub unavailable', description: message, variant: 'destructive' });
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadProgram();
  }, [loadProgram]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadedAsset(null);
  };

  const uploadSelectedFile = async (): Promise<UploadedDeveloperAsset> => {
    if (!selectedFile) {
      throw new Error('Choose a source file before submitting.');
    }

    const formData = new FormData();
    formData.set('assetType', assetType);
    formData.set('file', selectedFile);

    const response = await fetch('/api/developer-assets/upload', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to upload source file.'));
    return response.json() as Promise<UploadedDeveloperAsset>;
  };

  const submitAsset = async () => {
    setIsSaving(true);
    try {
      if (!name.trim()) throw new Error('Name the asset before submitting.');
      const uploaded = selectedFile ? await uploadSelectedFile() : uploadedAsset;
      if (!uploaded) throw new Error('Choose a source file before submitting.');
      setUploadedAsset(uploaded);
      if (selectedFile) {
        setSelectedFile(null);
        setFileInputKey((key) => key + 1);
      }

      const response = await fetch('/api/developer-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetType,
          name,
          description,
          previewUrl: previewUrl.trim() || uploaded.previewUrl,
          sourceUrl: uploaded.sourceUrl,
          sourceFileSizeBytes: uploaded.fileSizeBytes,
          sourceMimeType: uploaded.mimeType,
          sourceStorageBucket: uploaded.bucket,
          sourceStoragePath: uploaded.path,
        }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to submit asset.'));
      const body = await response.json() as DeveloperAssetsResponse;
      setProgram(body.program);
      setName('');
      setDescription('');
      setPreviewUrl('');
      setSelectedFile(null);
      setUploadedAsset(null);
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

  const vote = async (submissionId: string, voteValue: 'positive' | 'negative') => {
    try {
      const response = await fetch(`/api/developer-assets/${submissionId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteValue }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to submit vote.'));
      const body = await response.json() as DeveloperAssetsResponse;
      setProgram(body.program);
      toast({ title: 'Vote recorded', description: 'The submission score has been updated.' });
    } catch (error) {
      toast({
        title: 'Vote not saved',
        description: error instanceof Error ? error.message : 'Unable to submit vote.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <section className={compact ? '' : 'mx-auto max-w-7xl px-5 pb-14 md:px-8'}>
        <div className="border border-[#5f4526] bg-[#15100a] p-6 text-[#c7b288]">Loading developer asset hub...</div>
      </section>
    );
  }

  if (!program) {
    return (
      <section className={compact ? '' : 'mx-auto max-w-7xl px-5 pb-14 md:px-8'}>
        <div className="border border-[#7d5a2e] bg-[#181009] p-6 md:p-8">
          <div className="flex items-center gap-3 text-[#e2aa4a]">
            <UploadCloud className="h-6 w-6" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em]">Developer Asset Hub</span>
          </div>
          <h2 className="mt-4 font-serif text-2xl text-[#fff1c7]">Asset hub needs a refresh</h2>
          <p className="mt-3 text-sm leading-6 text-[#c7b288]">
            {loadError ?? 'The developer asset hub did not finish loading yet.'}
          </p>
          <Button
            className="mt-5 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]"
            onClick={() => void loadProgram()}
            disabled={isLoading}
          >
            {isLoading ? 'Reloading...' : 'Retry asset hub'}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <TooltipProvider>
    <section className={compact ? '' : 'mx-auto max-w-7xl px-5 pb-14 md:px-8'}>
      <div className="border border-[#7d5a2e] bg-[#15100a] p-6 md:p-8">
        <div className="flex items-center gap-3 text-[#e2aa4a]">
          <UploadCloud className="h-6 w-6" />
          <span className="text-sm font-semibold uppercase tracking-[0.2em]">Developer Asset Hub</span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <Stat label="Submitted this month" value={program.developerStats.submitted} help="Assets you uploaded into the site pipeline this calendar month." />
          <Stat label="Published this month" value={program.developerStats.published} help="Your assets that reached published status this calendar month." />
          <Stat label="Requirement" value={program.settings.monthlyPublishedRequirement} help="Owner-set monthly published asset expectation for active developers." />
          <Stat label="Submissions left" value={program.remainingSubmissions} help="Uploads remaining before your monthly site-submission cap is reached." />
        </div>

        <Tabs defaultValue="submit" className="mt-6">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-none border border-[#5f4526] bg-[#100c08] p-2">
            <TabsTrigger value="submit" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Submit</TabsTrigger>
            <TabsTrigger value="voting" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Voting Queue</TabsTrigger>
            <TabsTrigger value="pipeline" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">My Pipeline</TabsTrigger>
            <TabsTrigger value="program" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Program</TabsTrigger>
          </TabsList>

          <TabsContent value="submit" className="mt-4">
            <div className="border border-[#5f4526] bg-[#100c08] p-4">
            <h3 className="font-serif text-xl text-[#fff1c7]">Submit an asset</h3>
            <p className="mt-2 text-sm leading-6 text-[#c7b288]">
              Site submissions enter the shared CardForge review pipeline. Local browser uploads remain private in your own workspace.
            </p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Type
                  <FieldHelp text="Choose the accepted asset folder/type this submission belongs to so owners can cap and publish it correctly." />
                </span>
                <select
                  className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]"
                  value={assetType}
                  onChange={(event) => setAssetType(event.target.value as DeveloperAssetType)}
                >
                  {DEVELOPER_ASSET_TYPES.map((type) => (
                    <option key={type} value={type}>{assetTypeLabels[type]}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Name
                  <FieldHelp text="Use a short library-facing name. This is what owners and peer reviewers see in queues." />
                </span>
                <input className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Source file
                  <FieldHelp text="Upload the file that can become part of the shared CardForge library after voting and owner review." />
                </span>
                <input
                  key={fileInputKey}
                  type="file"
                  accept=".svg,.png,.jpg,.jpeg,.webp,.json,image/svg+xml,image/png,image/jpeg,image/webp,application/json"
                  className="border border-dashed border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] file:mr-3 file:border-0 file:bg-[#e4aa43] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#140f0a]"
                  onChange={handleFileChange}
                />
                <span className="text-xs text-[#a98a55]">
                  {selectedFile
                    ? `${selectedFile.name} - ${Math.ceil(selectedFile.size / 1024)} KB selected`
                    : uploadedAsset
                      ? `${uploadedAsset.fileName} uploaded`
                      : 'Accepted: SVG, PNG, JPG, WEBP, and JSON up to 10 MB.'}
                </span>
              </label>
              <label className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Preview override
                  <FieldHelp text="Optional. Leave blank to use the uploaded source file as the visual preview." />
                </span>
                <input className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={previewUrl} onChange={(event) => setPreviewUrl(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Notes
                  <FieldHelp text="Mention intended use, style, licensing/source context, and anything reviewers need to know." />
                </span>
                <textarea className="min-h-24 border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={description} onChange={(event) => setDescription(event.target.value)} />
              </label>
              <Button className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={isSaving || program.remainingSubmissions <= 0} onClick={submitAsset}>
                {isSaving ? 'Uploading...' : 'Submit to voting'}
              </Button>
            </div>
          </div>
          </TabsContent>

          <TabsContent value="voting" className="mt-4">
            <div className="border border-[#5f4526] bg-[#100c08] p-4">
              <h3 className="font-serif text-xl text-[#fff1c7]">Peer voting queue</h3>
              <div className="mt-4 space-y-3">
                {program.votingQueue.length === 0 ? (
                  <p className="text-sm text-[#c7b288]">No peer submissions need your vote right now.</p>
                ) : program.votingQueue.map((submission) => (
                  <AssetRow key={submission.id} submission={submission}>
                    <Button size="sm" variant="outline" className="border-[#5f7f54] bg-transparent text-[#bde3a8]" onClick={() => vote(submission.id, 'positive')}>
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="border-[#7d3d32] bg-transparent text-[#ffd0c6]" onClick={() => vote(submission.id, 'negative')}>
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </AssetRow>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pipeline" className="mt-4">
            <div className="border border-[#5f4526] bg-[#100c08] p-4">
              <h3 className="font-serif text-xl text-[#fff1c7]">Your pipeline</h3>
              <div className="mt-4 space-y-3">
                {ownSubmissions.length === 0 ? (
                  <p className="text-sm text-[#c7b288]">Your submitted assets will appear here.</p>
                ) : ownSubmissions.slice(0, 8).map((submission) => (
                  <AssetRow key={submission.id} submission={submission} />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="program" className="mt-4">
            <div className="grid gap-3 md:grid-cols-3">
              <ProgramRule label="Monthly uploads" value={program.settings.monthlySubmissionLimit} body="Site-library candidates each developer can submit per calendar month." />
              <ProgramRule label="Monthly published goal" value={program.settings.monthlyPublishedRequirement} body="Owner-set monthly expectation for active developers." />
              <ProgramRule label="Minimum tier votes" value={program.settings.minimumVotesForTierAssignment} body="Votes required before an asset can move beyond Forge Review." />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
    </TooltipProvider>
  );
}

function FieldHelp({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="grid h-6 w-6 shrink-0 place-items-center border border-[#5f4526] text-[#d7b469] hover:border-[#d8b365] hover:text-[#fff1c7]"
          aria-label="More information"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-[#6d4f2b] bg-[#15100a] text-[#f7ead0]">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function Stat({ label, value, help }: { label: string; value: number; help: string }) {
  return (
    <div className="border border-[#5f4526] bg-[#100c08] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{label}</p>
        <FieldHelp text={help} />
      </div>
      <p className="mt-2 text-2xl font-semibold text-[#ffe7ad]">{value}</p>
    </div>
  );
}

function ProgramRule({ label, value, body }: { label: string; value: number; body: string }) {
  return (
    <div className="border border-[#5f4526] bg-[#100c08] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#ffe7ad]">{value}</p>
      <p className="mt-2 text-sm leading-5 text-[#c7b288]">{body}</p>
    </div>
  );
}

function AssetRow({
  submission,
  children,
}: {
  submission: DeveloperAssetProgramView['submissions'][number];
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-3 border border-[#4a3823] bg-[#0c0b09] p-3 sm:grid-cols-[4rem_1fr_auto] sm:items-center">
      <div className="grid h-16 w-16 place-items-center overflow-hidden border border-[#5f4526] bg-[#15100a]">
        {submission.previewUrl ? (
          <img src={submission.previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Archive className="h-5 w-5 text-[#a98a55]" />
        )}
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-[#ffe7ad]">{submission.name}</p>
          <span className="border border-[#5f4526] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#d7b469]">
            {submission.status.replace('_', ' ')}
          </span>
          <span className="border border-[#35445a] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#b9d5ff]">
            Submitted
          </span>
          <span className={`border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${tierClasses[submission.calculatedAccessTier]}`}>
            {tierLabels[submission.calculatedAccessTier]}
          </span>
        </div>
        <p className="mt-1 text-xs text-[#c7b288]">
          {assetTypeLabels[submission.assetType]} - +{submission.positiveVotes} / -{submission.negativeVotes} - quality {submission.qualityScore}%
        </p>
        <p className="mt-1 text-xs text-[#a98a55]">
          {(submission.tierDecisionReason ?? submission.decisionReason ?? 'developer_review').replaceAll('_', ' ')}
        </p>
      </div>
      <div className="flex gap-2">
        {children ?? (submission.status === 'published' ? <Check className="h-5 w-5 text-[#8be0a4]" /> : null)}
      </div>
    </div>
  );
}
