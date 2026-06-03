"use client";

import { useCallback, useEffect, useState } from 'react';
import { Crown, Save, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { FieldHelp } from '@/features/developer-assets/components/DeveloperAssetHubUi';
import {
  CompactNumberField,
  DecisionCard,
  NumberField,
  ProfileOverrideField,
  ToggleField,
  VoteWeightSelector,
} from '@/features/developer-assets/components/OwnerDeveloperProgramControls';
import {
  DEVELOPER_ASSET_TYPES,
  DEVELOPER_ASSET_STATUSES,
  buildDeveloperVotingPresetSettings,
  estimateDeveloperAssetStorage,
  getDeveloperVotingPresetLabel,
  type DeveloperAssetAccessTier,
  type DeveloperAssetAccessTierOverride,
  type DeveloperAssetStatus,
  type DeveloperProgramSettings,
  type DeveloperVotingPreset,
} from '@/lib/developerAssets';
import type { DeveloperAssetProgramView } from '@/lib/developerAssetStore';
import {
  getDeveloperAssetStatusLabel,
  getDeveloperAssetTierLabel,
  getDeveloperAssetTypeLabel,
} from '@/lib/pipelineAssetTaxonomy';

interface DeveloperAssetsResponse {
  program: DeveloperAssetProgramView;
}

interface DeveloperProfileDraft {
  status: 'invited' | 'active' | 'inactive' | 'suspended';
  monthlySubmissionLimitOverride: string;
  monthlyPublishedRequirementOverride: string;
  profitShareEligible: boolean;
  ownerNote: string;
}

const tierClasses: Record<DeveloperAssetAccessTier, string> = {
  hidden: 'border-[#4a3823] text-[#8f95a3]',
  free: 'border-[#5f7f54] text-[#bde3a8]',
  paid: 'border-[#8a642f] text-[#f0c568]',
  developer: 'border-[#35445a] text-[#b9d5ff]',
};

const profileStatusLabels: Record<DeveloperProfileDraft['status'], string> = {
  invited: 'Invited',
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
};

const getApiErrorMessage = async (response: Response, fallback: string) => {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
};

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** exponent;
  return `${amount >= 10 || exponent === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[exponent]}`;
};

const getContributorLabel = (developerId: string, developerEmail: string | null, developerName?: string | null) => {
  if (developerName) return developerName;
  return developerEmail ?? developerId;
};

export function OwnerDeveloperProgramPanel() {
  const { toast } = useToast();
  const [program, setProgram] = useState<DeveloperAssetProgramView | null>(null);
  const [settings, setSettings] = useState<DeveloperProgramSettings | null>(null);
  const [ownerNote, setOwnerNote] = useState('');
  const [ownerStatusFilter, setOwnerStatusFilter] = useState<DeveloperAssetStatus | 'all'>('all');
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
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to load developer program.'));
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
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to save developer program.'));
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
    status: string,
    ownerAccessTierOverride?: DeveloperAssetAccessTierOverride | null,
  ) => {
    setUpdatingSubmissionId(submissionId);
    try {
      const response = await fetch(`/api/developer-assets/${submissionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ownerNote, ownerAccessTierOverride }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to update asset status.'));
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
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to save developer profile rules.'));
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

  const storageForecast = estimateDeveloperAssetStorage(settings, program.activeDeveloperCount);
  const overCapSummaries = program.assetTypeSummaries.filter((summary) => summary.overPublishCapBy > 0);
  const liveDefaultCount = program.assetTypeSummaries.reduce((total, summary) => total + summary.publishedCount, 0);
  const candidateCount = program.assetTypeSummaries.reduce((total, summary) => total + summary.candidateCount, 0);
  const archiveCount = program.assetTypeSummaries.reduce((total, summary) => total + summary.archiveCount, 0);
  const ownerStatusCounts = DEVELOPER_ASSET_STATUSES.reduce<Record<DeveloperAssetStatus, number>>((counts, status) => {
    counts[status] = program.submissions.filter((submission) => submission.status === status).length;
    return counts;
  }, {} as Record<DeveloperAssetStatus, number>);
  const ownerVisibleSubmissions = ownerStatusFilter === 'all'
    ? program.submissions
    : program.submissions.filter((submission) => submission.status === ownerStatusFilter);
  const lastSavedLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'No changes saved in this session';

  return (
    <TooltipProvider>
    <section className="border border-[#7d5a2e] bg-[#15100a] p-6">
      <div className="flex items-center gap-3 text-[#e2aa4a]">
        <Crown className="h-5 w-5" />
        <h2 className="font-serif text-2xl text-[#fff1c7]">Asset Pipeline Command</h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#c7b288]">
        Control developer slots, monthly contribution rules, vote thresholds, free/paid published visibility, archive visibility, and per-type caps before financial launch. Published assets are the only assets loaded into creator-facing Studio libraries; everything else remains managed in the pipeline.
      </p>
      <div className="mt-4 border border-[#5f4526] bg-[#100c08] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">Owner control map</p>
            <h3 className="mt-1 font-serif text-xl text-[#fff1c7]">These rules change the live pipeline after you save.</h3>
            <p className="mt-2 text-sm leading-6 text-[#c7b288]">
              Saving updates developer limits, vote thresholds, self-voting, tier caps, and review behavior. It does not delete contribution history; assets move between pipeline-only, published free/paid, and archive states according to the same rules.
            </p>
          </div>
          <div className="min-w-48 border border-[#3c2c1b] bg-[#15100a] p-3 text-sm text-[#c7b288]">
            <p className="text-xs uppercase tracking-[0.14em] text-[#a98a55]">Save state</p>
            <p className="mt-2 text-[#ffe7ad]">{lastSavedLabel}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <DecisionCard label="Program status" body={program.configured ? 'Supabase developer tables are connected and accepting submissions.' : 'Developer tables are not configured yet.'} />
        <DecisionCard label="Submissions" body={`${program.submissions.length} total developer asset submission${program.submissions.length === 1 ? '' : 's'} in the review system.`} />
        <DecisionCard label="Voting lane" body={`${program.votingQueue.length} active asset${program.votingQueue.length === 1 ? '' : 's'} remain open for developer voting, with owner archive/recover controls available below.`} />
        <DecisionCard label="Active developers" body={`${program.activeDeveloperCount} active developer${program.activeDeveloperCount === 1 ? '' : 's'} currently count toward voting presets.`} />
        <DecisionCard label="Published policy" body="Creator-facing assets are published pipeline rows with a free or paid tier. If voting or cap rules push them out, they move back through candidate/archive states." />
        <DecisionCard label="Cap pressure" body={overCapSummaries.length === 0 ? 'All published asset types are inside current caps.' : `${overCapSummaries.length} asset type${overCapSummaries.length === 1 ? '' : 's'} are over cap; rebalance moves lowest-signal live assets back to candidates.`} />
        <DecisionCard label="Self voting" body={settings.allowContributorSelfVoting ? 'Contributors can vote on their own uploads during solo/demo review.' : 'Only peer votes count; own assets stay out of the review queue for that contributor.'} />
        <DecisionCard label="Owner vote mode" body={settings.ownerVoteWeight === 1 ? 'Owner votes count like one developer vote.' : `Owner votes count as ${settings.ownerVoteWeight}x signal in asset grading.`} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <DecisionCard label="Live library" body={`${liveDefaultCount} published assets currently feed creator-facing libraries and remain open to developer voting.`} />
        <DecisionCard label="Waiting for signal" body={`${candidateCount} candidate assets are waiting for votes, owner review, or open caps before they become live library assets.`} />
        <DecisionCard label="Recoverable archive" body={`${archiveCount} archived assets remain visible for owner review and can be recovered when signal improves.`} />
      </div>

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

        <div className="border border-[#5f4526] bg-[#100c08] p-4">
          <h3 className="font-serif text-xl text-[#fff1c7]">Developer monthly ledger</h3>
          <p className="mt-2 text-sm leading-6 text-[#c7b288]">
            Start with the base monthly contract, then adjust specific developer accounts when someone needs a different submission cap, published requirement, or future creator-pool eligibility.
          </p>
          <div className="mt-4 space-y-2">
            {program.developerContributions.map((contribution) => {
              const draft = profileDrafts[contribution.developerId] ?? {
                status: contribution.profileStatus,
                monthlySubmissionLimitOverride: contribution.submissionLimitOverride === null ? '' : String(contribution.submissionLimitOverride),
                monthlyPublishedRequirementOverride: contribution.publishedRequirementOverride === null ? '' : String(contribution.publishedRequirementOverride),
                profitShareEligible: contribution.profitShareEligible,
                ownerNote: contribution.ownerNote ?? '',
              };
              const contributorLabel = getContributorLabel(contribution.developerId, contribution.developerEmail, contribution.developerName);

              return (
                <div key={contribution.developerId} className="border border-[#3c2c1b] bg-[#15100a] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-[#ffe7ad]">{contributorLabel}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#a98a55]">
                        {profileStatusLabels[contribution.profileStatus]} - {contribution.profitShareEligible ? 'Future creator pool eligible' : 'Future creator pool paused'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {contribution.submissionLimitOverride !== null || contribution.publishedRequirementOverride !== null ? (
                        <span className="border border-[#5f7f54] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#bde3a8]">Account override</span>
                      ) : (
                        <span className="border border-[#5f4526] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#d7b469]">Base contract</span>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#c7b288]">
                    {contribution.submitted} submitted / {contribution.remainingSubmissions} left from {contribution.effectiveSubmissionLimit} allowed - {contribution.published} published / {contribution.requiredPublished} required
                  </p>
                  {contribution.missingPublished > 0 ? (
                    <p className="mt-1 text-xs text-[#f0bd75]">{contribution.missingPublished} more published asset{contribution.missingPublished === 1 ? '' : 's'} needed this month.</p>
                  ) : (
                    <p className="mt-1 text-xs text-[#bde3a8]">Monthly published requirement met.</p>
                  )}
                      <div className="mt-3 grid gap-2 border border-[#3c2c1b] bg-[#100c08] p-3">
                      <label className="grid gap-1 text-xs text-[#c7b288]">
                        Profile status
                        <select
                          className="border border-[#3c2c1b] bg-[#15100a] p-2 text-[#ffe7ad]"
                          value={draft.status}
                          onChange={(event) => updateProfileDraft(contribution.developerId, { status: event.target.value as DeveloperProfileDraft['status'] })}
                        >
                          {(['active', 'invited', 'inactive', 'suspended'] as const).map((status) => (
                            <option key={status} value={status}>{profileStatusLabels[status]}</option>
                          ))}
                        </select>
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <ProfileOverrideField
                          label="Submission override"
                          ariaLabel={`Submission allowance override for ${contributorLabel}`}
                          placeholder={`Base ${settings.monthlySubmissionLimit}`}
                          value={draft.monthlySubmissionLimitOverride}
                          onChange={(value) => updateProfileDraft(contribution.developerId, { monthlySubmissionLimitOverride: value })}
                        />
                        <ProfileOverrideField
                          label="Published override"
                          ariaLabel={`Required published override for ${contributorLabel}`}
                          placeholder={`Base ${settings.monthlyPublishedRequirement}`}
                          value={draft.monthlyPublishedRequirementOverride}
                          onChange={(value) => updateProfileDraft(contribution.developerId, { monthlyPublishedRequirementOverride: value })}
                        />
                      </div>
                      <label className="flex items-center justify-between gap-3 border border-[#3c2c1b] bg-[#15100a] p-2 text-xs text-[#ffe7ad]">
                        <span>
                          Future creator-pool eligible
                          <span className="mt-1 block text-[#a98a55]">Planning flag only. No payout automation is live yet.</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={draft.profitShareEligible}
                          onChange={(event) => updateProfileDraft(contribution.developerId, { profitShareEligible: event.target.checked })}
                        />
                      </label>
                      <label className="grid gap-1 text-xs text-[#c7b288]">
                        Owner note
                        <textarea
                          className="min-h-16 border border-[#3c2c1b] bg-[#15100a] p-2 text-[#ffe7ad]"
                          value={draft.ownerNote}
                          onChange={(event) => updateProfileDraft(contribution.developerId, { ownerNote: event.target.value })}
                        />
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        className="justify-self-start bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]"
                        disabled={savingProfileId === contribution.developerId}
                        onClick={() => void saveDeveloperProfile(contribution.developerId)}
                      >
                        {savingProfileId === contribution.developerId ? 'Saving...' : 'Save account contract'}
                      </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <DecisionCard label="Pipeline only" body={`Under ${settings.minimumVotesForTierAssignment} votes stays out of creator-facing libraries.`} />
        <DecisionCard label="Archive path" body={`Below ${settings.freeAssetMinimumPositiveVotePercent}% positive stays pipeline-only or moves to archive.`} />
        <DecisionCard label="Starter" body={`${settings.freeAssetMinimumPositiveVotePercent}-${settings.paidAssetMinimumPositiveVotePercent - 1}% positive can enter Starter Library.`} />
        <DecisionCard label="Creator Pass" body={`${settings.paidAssetMinimumPositiveVotePercent}%+ positive can enter Creator Pass Library.`} />
      </div>

      <div className="mt-5 border border-[#5f4526] bg-[#100c08] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-serif text-xl text-[#fff1c7]">Asset storage forecast</h3>
            <p className="mt-2 text-sm leading-6 text-[#c7b288]">
              Estimate managed asset storage if published slots, one month of voting submissions, and visible archive capacity are all full.
            </p>
          </div>
          <FieldHelp text="This is planning math, not a billing meter. Actual files should live in object storage; database rows store metadata and source pointers." />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <DecisionCard label="Publish slots" body={`${storageForecast.publishSlotCount} slots / ${formatBytes(storageForecast.estimatedPublishedBytes)} estimated`} />
          <DecisionCard label="Voting month" body={`${storageForecast.monthlyVotingSlotCount} possible uploads / ${formatBytes(storageForecast.estimatedMonthlyVotingBytes)}`} />
          <DecisionCard label="Archive reserve" body={`${storageForecast.archiveSlotCount} visible archived assets / ${formatBytes(storageForecast.estimatedArchiveBytes)}`} />
          <DecisionCard label="Max managed" body={`${formatBytes(storageForecast.estimatedMaximumManagedBytes)} at current settings`} />
        </div>
        <p className="mt-3 text-xs leading-5 text-[#a98a55]">
          Average estimate: {formatBytes(storageForecast.averageAssetBytes)} per asset. Largest default estimate: {formatBytes(storageForecast.largestEstimatedAssetBytes)}.
        </p>
      </div>

      <Button className="mt-5 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={isSaving} onClick={saveSettings}>
        <Save className="mr-2 h-4 w-4" />
        {isSaving ? 'Saving developer program...' : 'Save developer program'}
      </Button>

      <div className="mt-7 grid gap-3 lg:grid-cols-[1fr_18rem]">
        <div>
          <h3 className="font-serif text-xl text-[#fff1c7]">Owner review lane</h3>
          <p className="mt-2 text-sm leading-6 text-[#c7b288]">
            Use Archive as the normal remove-from-active-use path. Reject is for closed owner decisions, spam, rights problems, or unusable submissions.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`rounded-none border-[#5f4526] bg-transparent text-[#ffe7ad] ${ownerStatusFilter === 'all' ? 'border-[#d8b365] bg-[#2a1b0d]' : ''}`}
              onClick={() => setOwnerStatusFilter('all')}
            >
              All ({program.submissions.length})
            </Button>
            {DEVELOPER_ASSET_STATUSES.map((status) => (
              <Button
                key={status}
                type="button"
                size="sm"
                variant="outline"
                className={`rounded-none border-[#5f4526] bg-transparent text-[#ffe7ad] ${ownerStatusFilter === status ? 'border-[#d8b365] bg-[#2a1b0d]' : ''}`}
                onClick={() => setOwnerStatusFilter(status)}
              >
                {getDeveloperAssetStatusLabel(status)} ({ownerStatusCounts[status]})
              </Button>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {ownerVisibleSubmissions.length === 0 ? (
              <p className="text-sm text-[#c7b288]">No developer submissions match this owner review view.</p>
            ) : ownerVisibleSubmissions.slice(0, 12).map((submission) => {
              const isUpdatingSubmission = updatingSubmissionId === submission.id;

              return (
              <div key={submission.id} className="grid gap-3 border border-[#4a3823] bg-[#0c0b09] p-3 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[#ffe7ad]">{submission.name}</p>
                    <span className="border border-[#5f4526] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#d7b469]">
                      {getDeveloperAssetStatusLabel(submission.status)}
                    </span>
                    <span className="border border-[#35445a] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#b9d5ff]">
                      {getDeveloperAssetTypeLabel(submission.assetType, { plural: false })}
                    </span>
                    <span className={`border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${tierClasses[submission.calculatedAccessTier]}`}>
                      {getDeveloperAssetTierLabel(submission.calculatedAccessTier)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#c7b288]">
                    {submission.developerDisplayName ?? getContributorLabel(submission.developerId, submission.developerEmail)} - +{submission.positiveVotes} / -{submission.negativeVotes} - quality {submission.qualityScore}%
                  </p>
                  <p className="mt-1 text-xs text-[#a98a55]">
                    {(submission.tierDecisionReason ?? submission.decisionReason ?? 'developer_review').replaceAll('_', ' ')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {submission.status === 'archived' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#5f7f54] bg-transparent text-[#bde3a8]"
                      disabled={isUpdatingSubmission}
                      onClick={() => updateStatus(submission.id, 'voting')}
                      aria-label={`Recover ${submission.name} to review`}
                    >
                      {isUpdatingSubmission ? 'Updating...' : 'Recover to Review'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#8c6436] bg-transparent text-[#f0bd75]"
                      disabled={isUpdatingSubmission}
                      onClick={() => updateStatus(submission.id, 'archived')}
                      aria-label={`Archive ${submission.name}`}
                    >
                      {isUpdatingSubmission ? 'Updating...' : 'Archive'}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="border-[#5f7f54] bg-transparent text-[#bde3a8]" disabled={isUpdatingSubmission} onClick={() => updateStatus(submission.id, 'published')} aria-label={`Publish ${submission.name}`}>Publish Live</Button>
                  <Button size="sm" variant="outline" className="border-[#7d3d32] bg-transparent text-[#ffd0c6]" disabled={isUpdatingSubmission} onClick={() => updateStatus(submission.id, 'rejected')} aria-label={`Reject and close ${submission.name}`}>Reject / Close</Button>
                  <Button size="sm" variant="outline" className="border-[#5f7f54] bg-transparent text-[#bde3a8]" disabled={isUpdatingSubmission} onClick={() => updateStatus(submission.id, submission.status, 'free')} aria-label={`Set ${submission.name} to Starter tier`}>Set Starter</Button>
                  <Button size="sm" variant="outline" className="border-[#8a642f] bg-transparent text-[#f0c568]" disabled={isUpdatingSubmission} onClick={() => updateStatus(submission.id, submission.status, 'paid')} aria-label={`Set ${submission.name} to Creator Pass tier`}>Set Creator Pass</Button>
                  <Button size="sm" variant="outline" className="border-[#4a3823] bg-transparent text-[#8f95a3]" disabled={isUpdatingSubmission} onClick={() => updateStatus(submission.id, submission.status, 'hidden')} aria-label={`Set ${submission.name} to Not Live tier`}>Set Not Live</Button>
                  {submission.ownerAccessTierOverride ? (
                    <Button size="sm" variant="outline" className="border-[#5f4526] bg-transparent text-[#c7b288]" disabled={isUpdatingSubmission} onClick={() => updateStatus(submission.id, submission.status, null)} aria-label={`Clear tier override for ${submission.name}`}>Clear Override</Button>
                  ) : null}
                </div>
              </div>
              );
            })}
          </div>
        </div>
        <label className="grid content-start gap-2 text-sm text-[#c7b288]">
          Owner note for status changes
          <textarea
            className="min-h-32 border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]"
            value={ownerNote}
            onChange={(event) => setOwnerNote(event.target.value)}
          />
        </label>
      </div>
    </section>
    </TooltipProvider>
  );
}
