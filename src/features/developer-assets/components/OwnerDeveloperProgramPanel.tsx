"use client";

import { useCallback, useEffect, useState } from 'react';
import { Crown, Info, Save, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  DEVELOPER_ASSET_TYPES,
  buildDeveloperVotingPresetSettings,
  estimateDeveloperAssetStorage,
  getDeveloperVotingPresetLabel,
  type DeveloperAssetAccessTier,
  type DeveloperAssetAccessTierOverride,
  type DeveloperAssetType,
  type DeveloperProgramSettings,
  type DeveloperVotingPreset,
} from '@/lib/developerAssets';
import type { DeveloperAssetProgramView } from '@/lib/developerAssetStore';

interface DeveloperAssetsResponse {
  program: DeveloperAssetProgramView;
}

const assetTypeLabels: Record<DeveloperAssetType, string> = {
  templates: 'Templates',
  elementPresets: 'Element Presets',
  textures: 'Textures',
  dividers: 'Dividers',
  icons: 'Icons',
  imageAssets: 'Image Assets',
  parts: 'Parts',
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

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** exponent;
  return `${amount >= 10 || exponent === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[exponent]}`;
};

export function OwnerDeveloperProgramPanel() {
  const { toast } = useToast();
  const [program, setProgram] = useState<DeveloperAssetProgramView | null>(null);
  const [settings, setSettings] = useState<DeveloperProgramSettings | null>(null);
  const [ownerNote, setOwnerNote] = useState('');
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
    try {
      const response = await fetch(`/api/developer-assets/${submissionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ownerNote, ownerAccessTierOverride }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to update asset status.'));
      const body = await response.json() as DeveloperAssetsResponse;
      setProgram(body.program);
      toast({ title: 'Asset status updated', description: `Submission moved to ${status.replace('_', ' ')}.` });
    } catch (error) {
      toast({
        title: 'Asset status not updated',
        description: error instanceof Error ? error.message : 'Unable to update asset status.',
        variant: 'destructive',
      });
    }
  };

  const applyVotingPreset = (preset: DeveloperVotingPreset) => {
    if (!settings) return;
    setSettings(buildDeveloperVotingPresetSettings(settings, preset, program?.activeDeveloperCount ?? 1));
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

  return (
    <TooltipProvider>
    <section className="border border-[#7d5a2e] bg-[#15100a] p-6">
      <div className="flex items-center gap-3 text-[#e2aa4a]">
        <Crown className="h-5 w-5" />
        <h2 className="font-serif text-2xl text-[#fff1c7]">Developer asset program</h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#c7b288]">
        Control developer slots, monthly contribution rules, vote thresholds, tier visibility, archive visibility, and per-type caps before financial launch.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <DecisionCard label="Program status" body={program.configured ? 'Supabase developer tables are connected and accepting submissions.' : 'Developer tables are not configured yet.'} />
        <DecisionCard label="Submissions" body={`${program.submissions.length} total developer asset submission${program.submissions.length === 1 ? '' : 's'} in the review system.`} />
        <DecisionCard label="Voting queue" body={`${program.votingQueue.length} asset${program.votingQueue.length === 1 ? '' : 's'} currently need peer review.`} />
        <DecisionCard label="Active developers" body={`${program.activeDeveloperCount} active developer${program.activeDeveloperCount === 1 ? '' : 's'} currently count toward voting presets.`} />
        <DecisionCard label="Asset registry" body="Official shipped assets are visible without votes; developer assets publish into the same registry after approval." />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <div className="border border-[#5f4526] bg-[#100c08] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-xl text-[#fff1c7]">Roster and contribution rules</h3>
            <FieldHelp text="These controls define who can participate, how often developers can upload, and the monthly contribution expectation before payments launch." />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <NumberField label="Max developers" help="Total active developer slots in the curated program." value={settings.maxActiveDevelopers} onChange={(value) => setSettings({ ...settings, maxActiveDevelopers: value })} />
            <NumberField label="Monthly uploads" help="Maximum site-submitted assets one developer can upload each month." value={settings.monthlySubmissionLimit} onChange={(value) => setSettings({ ...settings, monthlySubmissionLimit: value })} />
            <NumberField label="Monthly published goal" help="Minimum monthly published assets expected from an active developer." value={settings.monthlyPublishedRequirement} onChange={(value) => setSettings({ ...settings, monthlyPublishedRequirement: value })} />
            <NumberField label="Creator pool %" help="Reserved profit-share pool placeholder for financial launch accounting." value={settings.profitSharePoolPercent} onChange={(value) => setSettings({ ...settings, profitSharePoolPercent: value })} />
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
                <th className="py-3 pr-3 font-medium">Asset type</th>
                <th className="px-3 py-3 font-medium">Starter cap</th>
                <th className="px-3 py-3 font-medium">Creator Pass cap</th>
                <th className="px-3 py-3 font-medium">Publish Total</th>
              </tr>
            </thead>
            <tbody>
              {DEVELOPER_ASSET_TYPES.map((type) => (
                <tr key={type} className="border-b border-[#342719] last:border-b-0">
                  <td className="py-3 pr-3 text-[#ffe7ad]">{assetTypeLabels[type]}</td>
                  <td className="px-3 py-3">
                    <CompactNumberField
                      ariaLabel={`${assetTypeLabels[type]} starter cap`}
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
                      ariaLabel={`${assetTypeLabels[type]} creator pass cap`}
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

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <DecisionCard label="Review only" body={`Under ${settings.minimumVotesForTierAssignment} votes stays in Forge Review.`} />
        <DecisionCard label="Hidden/archive" body={`Below ${settings.freeAssetMinimumPositiveVotePercent}% positive stays hidden or moves to archive.`} />
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
        Save developer program
      </Button>

      <div className="mt-7 grid gap-3 lg:grid-cols-[1fr_18rem]">
        <div>
          <h3 className="font-serif text-xl text-[#fff1c7]">Review queue</h3>
          <div className="mt-4 space-y-3">
            {program.submissions.length === 0 ? (
              <p className="text-sm text-[#c7b288]">Developer submissions will appear here after the migration is applied and developers submit assets.</p>
            ) : program.submissions.slice(0, 12).map((submission) => (
              <div key={submission.id} className="grid gap-3 border border-[#4a3823] bg-[#0c0b09] p-3 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[#ffe7ad]">{submission.name}</p>
                    <span className="border border-[#5f4526] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#d7b469]">
                      {submission.status.replace('_', ' ')}
                    </span>
                    <span className="border border-[#35445a] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#b9d5ff]">
                      {assetTypeLabels[submission.assetType]}
                    </span>
                    <span className={`border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${tierClasses[submission.calculatedAccessTier]}`}>
                      {tierLabels[submission.calculatedAccessTier]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#c7b288]">
                    {submission.developerEmail ?? submission.developerId} - +{submission.positiveVotes} / -{submission.negativeVotes} - quality {submission.qualityScore}%
                  </p>
                  <p className="mt-1 text-xs text-[#a98a55]">
                    {(submission.tierDecisionReason ?? submission.decisionReason ?? 'developer_review').replaceAll('_', ' ')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="border-[#5f7f54] bg-transparent text-[#bde3a8]" onClick={() => updateStatus(submission.id, 'published')}>Publish</Button>
                  <Button size="sm" variant="outline" className="border-[#8c6436] bg-transparent text-[#f0bd75]" onClick={() => updateStatus(submission.id, 'archived')}>Archive</Button>
                  <Button size="sm" variant="outline" className="border-[#7d3d32] bg-transparent text-[#ffd0c6]" onClick={() => updateStatus(submission.id, 'rejected')}>Reject</Button>
                  <Button size="sm" variant="outline" className="border-[#5f7f54] bg-transparent text-[#bde3a8]" onClick={() => updateStatus(submission.id, submission.status, 'free')}>Force Starter</Button>
                  <Button size="sm" variant="outline" className="border-[#8a642f] bg-transparent text-[#f0c568]" onClick={() => updateStatus(submission.id, submission.status, 'paid')}>Force Pass</Button>
                  <Button size="sm" variant="outline" className="border-[#d8b365] bg-transparent text-[#ffe7ad]" onClick={() => updateStatus(submission.id, submission.status, 'official')}>Force Official</Button>
                  <Button size="sm" variant="outline" className="border-[#4a3823] bg-transparent text-[#8f95a3]" onClick={() => updateStatus(submission.id, submission.status, 'hidden')}>Hide</Button>
                  {submission.ownerAccessTierOverride ? (
                    <Button size="sm" variant="outline" className="border-[#5f4526] bg-transparent text-[#c7b288]" onClick={() => updateStatus(submission.id, submission.status, null)}>Clear Tier</Button>
                  ) : null}
                </div>
              </div>
            ))}
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

function NumberField({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2 text-sm text-[#c7b288]">
      <span className="flex items-center justify-between gap-2">
        {label}
        <FieldHelp text={help} />
      </span>
      <input
        className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </label>
  );
}

function CompactNumberField({
  ariaLabel,
  value,
  onChange,
}: {
  ariaLabel: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      aria-label={ariaLabel}
      className="h-10 w-full min-w-24 border border-[#5f4526] bg-[#0c0b09] px-3 text-[#ffe7ad]"
      inputMode="numeric"
      value={value}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
    />
  );
}

function ToggleField({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 border border-[#5f4526] bg-[#100c08] p-3 text-sm text-[#ffe7ad]">
      <span className="flex items-center gap-2">
        {label}
        <FieldHelp text={help} />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function DecisionCard({ label, body }: { label: string; body: string }) {
  return (
    <div className="border border-[#4a3823] bg-[#100c08] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[#d9c28f]">{body}</p>
    </div>
  );
}
