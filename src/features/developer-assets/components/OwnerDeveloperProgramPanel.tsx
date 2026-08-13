"use client";

import { useCallback, useEffect, useState } from 'react';
import { Crown, Save, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { FieldHelp } from '@/features/developer-assets/components/DeveloperAssetHubUi';
import { OwnerAssetLibraryPanel } from '@/features/developer-assets/components/OwnerAssetLibraryPanel';
import { OwnerAssetStorageForecast } from '@/features/developer-assets/components/OwnerAssetStorageForecast';
import { OwnerDeveloperLedger, type DeveloperProfileDraft } from '@/features/developer-assets/components/OwnerDeveloperLedger';
import { OwnerDeveloperProgramOverview } from '@/features/developer-assets/components/OwnerDeveloperProgramOverview';
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
  type DeveloperAssetAccessTierOverride,
  type DeveloperAssetStatus,
  type DeveloperProgramSettings,
  type DeveloperVotingPreset,
} from '@/features/developer-assets/lib/developerAssets';
import type { DeveloperAssetProgramView } from '@/features/developer-assets/lib/developerAssetProgram';
import { getDeveloperAssetTypeLabel } from '@/features/developer-assets/lib/pipelineAssetTaxonomy';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

interface DeveloperAssetsResponse {
  program: DeveloperAssetProgramView;
}

export function OwnerDeveloperProgramPanel() {
  const { toast } = useToast();
  const [program, setProgram] = useState<DeveloperAssetProgramView | null>(null);
  const [settings, setSettings] = useState<DeveloperProgramSettings | null>(null);
  const [profileDrafts, setProfileDrafts] = useState<Record<string, DeveloperProfileDraft>>({});
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [updatingSubmissionId, setUpdatingSubmissionId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProgram = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/developer-assets', { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load developer program.'));
      const body = await response.json() as DeveloperAssetsResponse;
      setProgram(body.program);
      setSettings(body.program.settings);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load developer program.';
      setLoadError(message);
      toast({
        title: 'Developer program unavailable',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadProgram();
  }, [loadProgram]);

  useEffect(() => {
    if (!program) return;
    setProfileDrafts(Object.fromEntries(program.developerContributions.map((contribution) => [
      contribution.developerId,
      {
        status: contribution.profileStatus,
        monthlySubmissionLimitOverride: contribution.submissionLimitOverride === null
          ? ''
          : String(contribution.submissionLimitOverride),
        monthlyPublishedRequirementOverride: contribution.publishedRequirementOverride === null
          ? ''
          : String(contribution.publishedRequirementOverride),
        profitShareEligible: contribution.profitShareEligible,
        ownerNote: contribution.ownerNote ?? '',
      },
    ])));
  }, [program]);

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
      setProgram(body.program);
      setSettings(body.program.settings);
      setLastSavedAt(new Date().toISOString());
      toast({ title: 'Developer program saved', description: 'Roster, voting, and publish rules are updated.' });
    } catch (error) {
      toast({
        title: 'Developer program not saved',
        description: error instanceof Error ? error.message : 'Unable to save developer program.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (
    submissionId: string,
    status: DeveloperAssetStatus,
    ownerAccessTierOverride?: DeveloperAssetAccessTierOverride | null,
    ownerNote = '',
  ) => {
    setUpdatingSubmissionId(submissionId);
    try {
      const response = await fetch(`/api/developer-assets/${submissionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ownerNote, ownerAccessTierOverride }),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to update asset status.'));
      const body = await response.json() as DeveloperAssetsResponse;
      setProgram(body.program);
      setLastSavedAt(new Date().toISOString());
      toast({ title: 'Asset status updated', description: `Submission moved to ${status.replace('_', ' ')}.` });
    } catch (error) {
      toast({
        title: 'Asset status not updated',
        description: error instanceof Error ? error.message : 'Unable to update asset status.',
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

  const updateProfileDraft = (developerId: string, patch: Partial<DeveloperProfileDraft>) => {
    const emptyDraft: DeveloperProfileDraft = {
      status: 'active',
      monthlySubmissionLimitOverride: '',
      monthlyPublishedRequirementOverride: '',
      profitShareEligible: true,
      ownerNote: '',
    };
    setProfileDrafts((drafts) => ({
      ...drafts,
      [developerId]: { ...(drafts[developerId] ?? emptyDraft), ...patch },
    }));
  };

  const saveDeveloperProfile = async (developerId: string) => {
    const draft = profileDrafts[developerId];
    if (!draft) return;
    setSavingProfileId(developerId);
    try {
      const response = await fetch('/api/developer-assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developerId,
          profile: {
            status: draft.status,
            monthlySubmissionLimitOverride: draft.monthlySubmissionLimitOverride,
            monthlyPublishedRequirementOverride: draft.monthlyPublishedRequirementOverride,
            profitShareEligible: draft.profitShareEligible,
            ownerNote: draft.ownerNote,
          },
        }),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to save developer profile rules.'));
      const body = await response.json() as DeveloperAssetsResponse;
      setProgram(body.program);
      setSettings(body.program.settings);
      setLastSavedAt(new Date().toISOString());
      toast({ title: 'Developer profile saved', description: 'This contributor now uses the updated account-specific contract.' });
    } catch (error) {
      toast({
        title: 'Developer profile not saved',
        description: error instanceof Error ? error.message : 'Unable to save developer profile rules.',
        variant: 'destructive',
      });
    } finally {
      setSavingProfileId(null);
    }
  };

  if (isLoading) {
    return (
      <section className="border border-[#5f4526] bg-[#15100a] p-6 text-[#c7b288]">
        Loading developer program...
      </section>
    );
  }

  if (loadError || !program || !settings) {
    return (
      <section className="border border-[#7d3d32] bg-[#1b0d09] p-6 text-[#ffd0c6]">
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
    <section className="border border-[#7d5a2e] bg-[#15100a] p-6">
      <OwnerDeveloperProgramOverview program={program} settings={settings} lastSavedLabel={lastSavedLabel} />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <div className="border border-[#5f4526] bg-[#100c08] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-xl text-[#fff1c7]">Monthly developer contract</h3>
            <FieldHelp text="These controls define who can participate, how often developers can upload, and the monthly contribution expectation before payments launch." />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <NumberField label="Max developers" help="Total active developer slots in the curated program." value={settings.maxActiveDevelopers} onChange={(value) => setSettings({ ...settings, maxActiveDevelopers: value })} />
            <NumberField label="Submission allowance" help="Maximum site-submitted assets one developer can upload each calendar month. Submissions left is calculated from this." value={settings.monthlySubmissionLimit} onChange={(value) => setSettings({ ...settings, monthlySubmissionLimit: value })} />
            <NumberField label="Required published" help="Minimum published assets expected from each active developer per calendar month." value={settings.monthlyPublishedRequirement} onChange={(value) => setSettings({ ...settings, monthlyPublishedRequirement: value })} />
            <NumberField label="Creator pool %" help="Reserved future creator-pool placeholder for financial launch accounting." value={settings.profitSharePoolPercent} onChange={(value) => setSettings({ ...settings, profitSharePoolPercent: value })} />
          </div>
        </div>

        <div className="border border-[#5f4526] bg-[#100c08] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-xl text-[#fff1c7]">Voting impact</h3>
            <FieldHelp text="These settings decide when peer votes are strong enough to grade, archive, or assign Starter and Creator Pass access tiers." />
          </div>
          <div className="mt-4 border border-[#342719] bg-[#15100a] p-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#a98a55]">
              <Users className="h-3.5 w-3.5 text-[#d7b469]" />
              Voting presets
            </div>
            <p className="mt-2 text-xs leading-5 text-[#c7b288]">
              Start with solo review while you are the only developer, then raise vote gates as the roster grows.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(['solo', 'currentRoster', 'launchRoster', 'fullCouncil'] as DeveloperVotingPreset[]).map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="justify-start rounded-none border-[#5f4526] bg-transparent text-[#f8e3b0] hover:border-[#d8b365] hover:bg-[#2a1b0d]"
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
            <NumberField label="Grading votes" help="Votes required before an asset can be graded for publish candidacy." value={settings.minimumVotesForGrading} onChange={(value) => setSettings({ ...settings, minimumVotesForGrading: value })} />
            <NumberField label="Publish positive %" help="Positive vote percentage needed to become a publish candidate." value={settings.minimumPositiveVotePercent} onChange={(value) => setSettings({ ...settings, minimumPositiveVotePercent: value })} />
            <NumberField label="Starter %" help="Positive vote percentage needed for the Starter Library candidate tier." value={settings.freeAssetMinimumPositiveVotePercent} onChange={(value) => setSettings({ ...settings, freeAssetMinimumPositiveVotePercent: value })} />
            <NumberField label="Creator Pass %" help="Positive vote percentage needed for Creator Pass candidate tier." value={settings.paidAssetMinimumPositiveVotePercent} onChange={(value) => setSettings({ ...settings, paidAssetMinimumPositiveVotePercent: value })} />
            <NumberField label="Tier votes" help="Votes required before a calculated access tier can be assigned." value={settings.minimumVotesForTierAssignment} onChange={(value) => setSettings({ ...settings, minimumVotesForTierAssignment: value })} />
            <NumberField label="Archive visible" help="Maximum archived developer assets kept visible to owners for recent timeline review." value={settings.archiveVisibleLimit} onChange={(value) => setSettings({ ...settings, archiveVisibleLimit: value })} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <ToggleField
          label="Owner final review"
          help="Require owner review before a developer-voted asset can become published."
          checked={settings.ownerFinalReviewRequired}
          onChange={(checked) => setSettings({ ...settings, ownerFinalReviewRequired: checked })}
        />
        <ToggleField
          label="Paid previews"
          help="Allow free users to see tasteful Creator Pass previews without unlocking use."
          checked={settings.showPaidPreviewToFreeUsers}
          onChange={(checked) => setSettings({ ...settings, showPaidPreviewToFreeUsers: checked })}
        />
        <ToggleField
          label="Paid early access"
          help="Allow Creator Pass users to use paid-tier publish candidates before final publish."
          checked={settings.allowPaidEarlyAccessToCandidates}
          onChange={(checked) => setSettings({ ...settings, allowPaidEarlyAccessToCandidates: checked })}
        />
        <ToggleField
          label="Contributor self-voting"
          help="Allow contributors, including the owner alias for site defaults, to vote on their own assets. Useful for solo testing and demo-time pipeline seeding."
          checked={settings.allowContributorSelfVoting}
          onChange={(checked) => setSettings({ ...settings, allowContributorSelfVoting: checked })}
        />
      </div>

      <div className="mt-6 border border-[#5f4526] bg-[#100c08] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-serif text-xl text-[#fff1c7]">Asset type caps</h3>
            <p className="mt-2 text-sm leading-6 text-[#c7b288]">
              Set Starter and Creator Pass capacity in one row per accepted asset type. Publish Total is computed from both tiers.
            </p>
          </div>
          <FieldHelp text="Publish Total is Starter cap plus Creator Pass cap, which prevents conflicting live-library limits." />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#5f4526] text-left text-xs uppercase tracking-[0.14em] text-[#a98a55]">
                <th className="py-3 pr-3 font-medium">Asset family</th>
                <th className="px-3 py-3 font-medium">Starter cap</th>
                <th className="px-3 py-3 font-medium">Creator Pass cap</th>
                <th className="px-3 py-3 font-medium">Publish Total</th>
              </tr>
            </thead>
            <tbody>
              {DEVELOPER_ASSET_TYPES.map((type) => (
                <tr key={type} className="border-b border-[#342719] last:border-b-0">
                  <td className="py-3 pr-3 text-[#ffe7ad]">{getDeveloperAssetTypeLabel(type)}</td>
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
                    <div className="grid h-10 min-w-24 place-items-center border border-[#3d3324] bg-[#15100a] px-3 text-[#ffe7ad]">
                      {settings.tierCapsByType[type].free + settings.tierCapsByType[type].paid}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <div className="border border-[#5f4526] bg-[#100c08] p-4">
          <h3 className="font-serif text-xl text-[#fff1c7]">Live library cap pressure</h3>
          <p className="mt-2 text-sm leading-6 text-[#c7b288]">
            Caps control which free and paid assets can remain live in Studio libraries. Reducing a cap moves the lowest-signal live assets back into candidate review; failed assets move to archive.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#5f4526] text-left text-xs uppercase tracking-[0.14em] text-[#a98a55]">
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
                    <td className="py-3 pr-3 text-[#ffe7ad]">{getDeveloperAssetTypeLabel(summary.assetType)}</td>
                    <td className="px-3 py-3 text-[#c7b288]">{summary.publishedCount} live / {summary.starterCount} starter / {summary.creatorPassCount} creator</td>
                    <td className="px-3 py-3 text-[#c7b288]">{summary.publishCap}</td>
                    <td className={`px-3 py-3 ${summary.overPublishCapBy > 0 ? 'text-[#ffd0c6]' : 'text-[#bde3a8]'}`}>
                      {summary.overPublishCapBy > 0 ? `${summary.overPublishCapBy} over` : `${summary.openPublishSlots} open`}
                    </td>
                    <td className="px-3 py-3 text-[#c7b288]">{summary.candidateCount}</td>
                    <td className="px-3 py-3 text-[#c7b288]">{summary.archiveCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <OwnerDeveloperLedger
          program={program}
          settings={settings}
          profileDrafts={profileDrafts}
          savingProfileId={savingProfileId}
          onDraftChange={updateProfileDraft}
          onSave={saveDeveloperProfile}
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <DecisionCard label="Pipeline only" body={`Under ${settings.minimumVotesForTierAssignment} votes stays out of creator-facing libraries.`} />
        <DecisionCard label="Archive path" body={`Below ${settings.freeAssetMinimumPositiveVotePercent}% positive stays pipeline-only or moves to archive.`} />
        <DecisionCard label="Starter" body={`${settings.freeAssetMinimumPositiveVotePercent}-${settings.paidAssetMinimumPositiveVotePercent - 1}% positive can enter Starter Library.`} />
        <DecisionCard label="Creator Pass" body={`${settings.paidAssetMinimumPositiveVotePercent}%+ positive can enter Creator Pass Library.`} />
      </div>

      <OwnerAssetStorageForecast settings={settings} activeDeveloperCount={program.activeDeveloperCount} />

      <Button className="mt-5 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={isSaving} onClick={saveSettings}>
        <Save className="mr-2 h-4 w-4" />
        {isSaving ? 'Saving developer program...' : 'Save developer program'}
      </Button>

      <OwnerAssetLibraryPanel
        program={program}
        updatingSubmissionId={updatingSubmissionId}
        onUpdateStatus={updateStatus}
      />
    </section>
    </TooltipProvider>
  );
}
