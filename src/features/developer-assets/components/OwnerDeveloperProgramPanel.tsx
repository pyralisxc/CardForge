"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Crown, Save, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { FieldHelp } from '@/features/developer-assets/components/DeveloperAssetHubUi';
import {
  OwnerAssetLibraryPanel,
  type OwnerAssetOverrideInput,
} from '@/features/developer-assets/components/OwnerAssetLibraryPanel';
import { OwnerDeveloperProgramOverview } from '@/features/developer-assets/components/OwnerDeveloperProgramOverview';
import { OwnerStudioRoutingPanel } from '@/features/developer-assets/components/OwnerStudioRoutingPanel';
import {
  CompactNumberField,
  DecisionCard,
  NumberField,
  ToggleField,
  VoteWeightSelector,
} from '@/features/developer-assets/components/OwnerDeveloperProgramControls';
import {
  DEVELOPER_ASSET_TYPES,
  buildDeveloperVotingPresetSettings,
  getDeveloperVotingPresetLabel,
  type DeveloperProgramSettings,
  type DeveloperVotingPreset,
  type DeveloperAssetStatus,
  type DeveloperAssetType,
} from '@/features/developer-assets/lib/developerAssets';
import type { DeveloperAssetProgramView } from '@/features/developer-assets/lib/developerAssetProgram';
import { getDeveloperAssetTypeLabel } from '@/features/developer-assets/lib/pipelineAssetTaxonomy';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

interface DeveloperAssetsResponse {
  program: DeveloperAssetProgramView;
}

export function OwnerDeveloperProgramPanel({
  initialStatusFilter = 'all',
}: {
  initialStatusFilter?: DeveloperAssetStatus | 'all';
}) {
  const { toast } = useToast();
  const [program, setProgram] = useState<DeveloperAssetProgramView | null>(null);
  const [settings, setSettings] = useState<DeveloperProgramSettings | null>(null);
  const [updatingSubmissionId, setUpdatingSubmissionId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryAssetType, setLibraryAssetType] = useState<DeveloperAssetType | 'all'>('all');
  const [libraryStatus, setLibraryStatus] = useState<DeveloperAssetStatus | 'all'>(initialStatusFilter);
  const [libraryPage, setLibraryPage] = useState(1);
  const hasLoadedRef = useRef(false);

  const loadProgram = useCallback(async () => {
    if (!hasLoadedRef.current) setIsLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        query: libraryQuery,
        assetType: libraryAssetType,
        status: libraryStatus,
        page: String(libraryPage),
        pageSize: '12',
      });
      const response = await fetch(`/api/developer-assets?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load developer program.'));
      const body = await response.json() as DeveloperAssetsResponse;
      setProgram(body.program);
      setSettings(body.program.settings);
      hasLoadedRef.current = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load developer program.';
      setLoadError(message);
      toast({
        title: 'Contributor program unavailable',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [libraryAssetType, libraryPage, libraryQuery, libraryStatus, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProgram(), 250);
    return () => window.clearTimeout(timer);
  }, [loadProgram]);

  const saveSettings = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/developer-assets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to save developer program.'));
      const body = await response.json() as DeveloperAssetsResponse;
      setSettings(body.program.settings);
      await loadProgram();
      setLastSavedAt(new Date().toISOString());
      toast({ title: 'Contributor program saved', description: 'Roster, voting, and publish rules are updated.' });
    } catch (error) {
      toast({
        title: 'Contributor program not saved',
        description: error instanceof Error ? error.message : 'Unable to save developer program.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateOverride = async (
    submissionId: string,
    input: OwnerAssetOverrideInput,
    success?: { title: string; description: string },
  ): Promise<boolean> => {
    setUpdatingSubmissionId(submissionId);
    try {
      const response = await fetch(`/api/developer-assets/${submissionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to update asset status.'));
      await response.json() as DeveloperAssetsResponse;
      await loadProgram();
      setLastSavedAt(new Date().toISOString());
      toast(success ?? { title: 'Asset control saved', description: 'The owner override and automatic recommendation are now synchronized.' });
      return true;
    } catch (error) {
      toast({
        title: 'Asset control not saved',
        description: error instanceof Error ? error.message : 'Unable to update asset control.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setUpdatingSubmissionId(null);
    }
  };

  const deletePermanently = async (submissionId: string, confirmationName: string) => {
    setUpdatingSubmissionId(submissionId);
    try {
      const response = await fetch(`/api/developer-assets/${submissionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationName }),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to permanently delete this asset.'));
      await response.json() as DeveloperAssetsResponse;
      await loadProgram();
      setLastSavedAt(new Date().toISOString());
      toast({ title: 'Asset permanently deleted', description: 'The registry entry, revision lineage, votes, and managed storage were removed.' });
    } catch (error) {
      toast({
        title: 'Asset was not deleted',
        description: error instanceof Error ? error.message : 'Unable to permanently delete this asset.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingSubmissionId(null);
    }
  };

  const applyVotingPreset = (preset: DeveloperVotingPreset) => {
    if (!settings) return;
    setSettings(buildDeveloperVotingPresetSettings(settings, preset, program?.activeDeveloperCount ?? 1));
  };

  if (isLoading) {
    return (
      <section className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-6 text-[var(--cf-text-muted)]">
        Loading developer program...
      </section>
    );
  }

  if (loadError || !program || !settings) {
    return (
      <section className="border border-[var(--cf-danger-border)] bg-[var(--cf-danger-surface-muted)] p-6 text-[var(--cf-danger)]">
        <div className="flex items-center gap-3 text-[#ffb8a8]">
          <Crown className="h-5 w-5" />
          <h2 className="font-serif text-2xl text-[#ffe1d8]">Developer asset program unavailable</h2>
        </div>
        <p className="mt-3 text-sm leading-6">
          {loadError ?? 'Unable to load developer program.'}
        </p>
        <p className="mt-3 text-sm leading-6 text-[#e7b3a8]">
          Confirm the developer asset Supabase migration has been applied, then refresh this page.
        </p>
        <Button
          className="mt-5 border-[#ffb8a8] bg-transparent text-[#ffe1d8] hover:bg-[#2a120d]"
          variant="outline"
          onClick={loadProgram}
        >
          Retry
        </Button>
      </section>
    );
  }

  const lastSavedLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'No changes saved in this session';

  return (
    <TooltipProvider>
    <section className="border border-[var(--cf-warning-border)] bg-[var(--cf-surface)] p-6">
      <OwnerDeveloperProgramOverview program={program} settings={settings} lastSavedLabel={lastSavedLabel} />

      <Tabs defaultValue="library" className="mt-5 space-y-5">
        <TabsList className="flex h-auto flex-wrap justify-start rounded-none border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-1">
          <TabsTrigger value="library" className="rounded-none border-b-2 border-transparent px-3 py-2 text-sm text-[var(--cf-text-subtle)] data-[state=active]:border-[var(--cf-accent)] data-[state=active]:bg-[#1b140c] data-[state=active]:text-[var(--cf-accent-text)]">Asset library</TabsTrigger>
          <TabsTrigger value="studio-map" className="rounded-none border-b-2 border-transparent px-3 py-2 text-sm text-[var(--cf-text-subtle)] data-[state=active]:border-[var(--cf-accent)] data-[state=active]:bg-[#1b140c] data-[state=active]:text-[var(--cf-accent-text)]">Studio map</TabsTrigger>
          <TabsTrigger value="rules" className="rounded-none border-b-2 border-transparent px-3 py-2 text-sm text-[var(--cf-text-subtle)] data-[state=active]:border-[var(--cf-accent)] data-[state=active]:bg-[#1b140c] data-[state=active]:text-[var(--cf-accent-text)]">Pipeline rules</TabsTrigger>
        </TabsList>
        <TabsContent value="library" className="mt-0">
          <OwnerAssetLibraryPanel
            program={program}
            query={libraryQuery}
            assetTypeFilter={libraryAssetType}
            statusFilter={libraryStatus}
            page={libraryPage}
            onQueryChange={(value) => { setLibraryQuery(value); setLibraryPage(1); }}
            onAssetTypeFilterChange={(value) => { setLibraryAssetType(value); setLibraryPage(1); }}
            onStatusFilterChange={(value) => { setLibraryStatus(value); setLibraryPage(1); }}
            onPageChange={setLibraryPage}
            updatingSubmissionId={updatingSubmissionId}
            onUpdateOverride={updateOverride}
            onDeletePermanently={deletePermanently}
          />
        </TabsContent>
        <TabsContent value="studio-map" className="mt-0">
          <OwnerStudioRoutingPanel />
        </TabsContent>
        <TabsContent value="rules" className="mt-0">

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <div className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">Monthly developer contract</h3>
            <FieldHelp text="These controls define who can participate, how often developers can upload, and the monthly contribution expectation." />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <NumberField label="Max developers" help="Total active developer slots in the curated program." value={settings.maxActiveDevelopers} onChange={(value) => setSettings({ ...settings, maxActiveDevelopers: value })} />
            <NumberField label="Submission allowance" help="Maximum site-submitted assets one developer can upload each calendar month. Submissions left is calculated from this." value={settings.monthlySubmissionLimit} onChange={(value) => setSettings({ ...settings, monthlySubmissionLimit: value })} />
            <NumberField label="Source file ceiling (MB)" help="Maximum size of one Forge Review media or font upload. Large files upload directly to managed storage; local browser projects are not affected." value={settings.maxSubmissionFileSizeMb} onChange={(value) => setSettings({ ...settings, maxSubmissionFileSizeMb: value })} />
            <NumberField label="Required published" help="Minimum published assets expected from each active developer per calendar month." value={settings.monthlyPublishedRequirement} onChange={(value) => setSettings({ ...settings, monthlyPublishedRequirement: value })} />
          </div>
        </div>

        <div className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">Voting impact</h3>
            <FieldHelp text="One vote threshold starts automatic ranking. Starter and Creator Pass percentages then decide the tier, while capacity decides whether the asset is live or waiting." />
          </div>
          <div className="mt-4 border border-[#342719] bg-[var(--cf-surface)] p-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--cf-text-subtle)]">
              <Users className="h-3.5 w-3.5 text-[var(--cf-accent)]" />
              Voting presets
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--cf-text-muted)]">
              Start with solo review while you are the only developer, then raise vote gates as the roster grows.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(['solo', 'currentRoster', 'launchRoster', 'fullCouncil'] as DeveloperVotingPreset[]).map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="justify-start rounded-none border-[var(--cf-border)] bg-transparent text-[var(--cf-accent-text)] hover:border-[var(--cf-accent)] hover:bg-[var(--cf-surface-hover)]"
                  onClick={() => applyVotingPreset(preset)}
                >
                  {getDeveloperVotingPresetLabel(preset, program.activeDeveloperCount)}
                </Button>
              ))}
            </div>
          </div>
          <VoteWeightSelector
            value={settings.ownerVoteWeight}
            onChange={(value) => setSettings({ ...settings, ownerVoteWeight: value })}
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <NumberField label="Votes to decide" help="Votes required before automatic status and tier selection begins." value={settings.minimumVotesForGrading} onChange={(value) => setSettings({ ...settings, minimumVotesForGrading: value })} />
            <NumberField label="Starter %" help="Minimum positive vote percentage for automatic Starter placement." value={settings.freeAssetMinimumPositiveVotePercent} onChange={(value) => setSettings({ ...settings, freeAssetMinimumPositiveVotePercent: value })} />
            <NumberField label="Creator Pass %" help="Minimum positive vote percentage for automatic Creator Pass placement." value={settings.paidAssetMinimumPositiveVotePercent} onChange={(value) => setSettings({ ...settings, paidAssetMinimumPositiveVotePercent: value })} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:max-w-xl">
        <ToggleField
          label="Contributor self-voting"
          help="Allow contributors, including the owner alias for site defaults, to vote on their own assets. Useful while the active review roster is small."
          checked={settings.allowContributorSelfVoting}
          onChange={(checked) => setSettings({ ...settings, allowContributorSelfVoting: checked })}
        />
      </div>

      <div className="mt-6 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">Asset type caps</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">
              Set Starter and Creator Pass capacity in one row per accepted asset type. Publish Total is computed from both tiers.
            </p>
          </div>
          <FieldHelp text="Publish Total is Starter cap plus Creator Pass cap, which prevents conflicting live-library limits." />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--cf-border)] text-left text-xs uppercase tracking-[0.14em] text-[var(--cf-text-subtle)]">
                <th className="py-3 pr-3 font-medium">Asset family</th>
                <th className="px-3 py-3 font-medium">Starter cap</th>
                <th className="px-3 py-3 font-medium">Creator Pass cap</th>
                <th className="px-3 py-3 font-medium">Publish Total</th>
              </tr>
            </thead>
            <tbody>
              {DEVELOPER_ASSET_TYPES.map((type) => (
                <tr key={type} className="border-b border-[#342719] last:border-b-0">
                  <td className="py-3 pr-3 text-[var(--cf-accent-text)]">{getDeveloperAssetTypeLabel(type)}</td>
                  <td className="px-3 py-3">
                    <CompactNumberField
                      ariaLabel={`${getDeveloperAssetTypeLabel(type)} starter cap`}
                      value={settings.tierCapsByType[type].free}
                      onChange={(value) => setSettings({
                        ...settings,
                        publishCapsByType: {
                          ...settings.publishCapsByType,
                          [type]: value + settings.tierCapsByType[type].paid,
                        },
                        tierCapsByType: {
                          ...settings.tierCapsByType,
                          [type]: { ...settings.tierCapsByType[type], free: value },
                        },
                      })}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <CompactNumberField
                      ariaLabel={`${getDeveloperAssetTypeLabel(type)} creator pass cap`}
                      value={settings.tierCapsByType[type].paid}
                      onChange={(value) => setSettings({
                        ...settings,
                        publishCapsByType: {
                          ...settings.publishCapsByType,
                          [type]: settings.tierCapsByType[type].free + value,
                        },
                        tierCapsByType: {
                          ...settings.tierCapsByType,
                          [type]: { ...settings.tierCapsByType[type], paid: value },
                        },
                      })}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="grid h-10 min-w-24 place-items-center border border-[#3d3324] bg-[var(--cf-surface)] px-3 text-[var(--cf-accent-text)]">
                      {settings.tierCapsByType[type].free + settings.tierCapsByType[type].paid}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 grid gap-5">
        <div className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4">
          <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">Live library cap pressure</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">
            Caps control which free and paid assets can remain live in Studio libraries. Reducing a cap moves the lowest-signal live assets back into candidate review; failed assets move to archive.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--cf-border)] text-left text-xs uppercase tracking-[0.14em] text-[var(--cf-text-subtle)]">
                  <th className="py-3 pr-3 font-medium">Asset family</th>
                  <th className="px-3 py-3 font-medium">Live</th>
                  <th className="px-3 py-3 font-medium">Cap</th>
                  <th className="px-3 py-3 font-medium">Open</th>
                  <th className="px-3 py-3 font-medium">Candidates</th>
                  <th className="px-3 py-3 font-medium">Archive</th>
                </tr>
              </thead>
              <tbody>
                {program.assetTypeSummaries.map((summary) => (
                  <tr key={summary.assetType} className="border-b border-[#342719] last:border-b-0">
                    <td className="py-3 pr-3 text-[var(--cf-accent-text)]">{getDeveloperAssetTypeLabel(summary.assetType)}</td>
                    <td className="px-3 py-3 text-[var(--cf-text-muted)]">{summary.publishedCount} live / {summary.starterCount} starter / {summary.creatorPassCount} creator</td>
                    <td className="px-3 py-3 text-[var(--cf-text-muted)]">{summary.publishCap}</td>
                    <td className={`px-3 py-3 ${summary.overPublishCapBy > 0 ? 'text-[var(--cf-danger)]' : 'text-[var(--cf-success)]'}`}>
                      {summary.overPublishCapBy > 0 ? `${summary.overPublishCapBy} over` : `${summary.openPublishSlots} open`}
                    </td>
                    <td className="px-3 py-3 text-[var(--cf-text-muted)]">{summary.candidateCount}</td>
                    <td className="px-3 py-3 text-[var(--cf-text-muted)]">{summary.archiveCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <DecisionCard label="Gathering signal" body={`Under ${settings.minimumVotesForGrading} votes stays in review.`} />
        <DecisionCard label="Automatic retire" body={`Below ${settings.freeAssetMinimumPositiveVotePercent}% positive retires until stronger recovery votes arrive.`} />
        <DecisionCard label="Automatic Starter" body={`${settings.freeAssetMinimumPositiveVotePercent}-${settings.paidAssetMinimumPositiveVotePercent - 1}% positive competes for Starter capacity.`} />
        <DecisionCard label="Automatic Creator Pass" body={`${settings.paidAssetMinimumPositiveVotePercent}%+ positive competes for Creator Pass capacity.`} />
      </div>

      <Button className="mt-5 bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]" disabled={isSaving} onClick={saveSettings}>
        <Save className="mr-2 h-4 w-4" />
        {isSaving ? 'Saving developer program...' : 'Save developer program'}
      </Button>
        </TabsContent>
      </Tabs>

    </section>
    </TooltipProvider>
  );
}
