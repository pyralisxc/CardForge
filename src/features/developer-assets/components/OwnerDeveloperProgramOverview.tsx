import { Crown } from 'lucide-react';

import { DecisionCard } from '@/features/developer-assets/components/OwnerDeveloperProgramControls';
import type { DeveloperAssetProgramView } from '@/features/developer-assets/lib/developerAssetProgram';
import type { DeveloperProgramSettings } from '@/features/developer-assets/lib/developerAssets';

export function OwnerDeveloperProgramOverview({
  program,
  settings,
  lastSavedLabel,
}: {
  program: DeveloperAssetProgramView;
  settings: DeveloperProgramSettings;
  lastSavedLabel: string;
}) {
  const overCapCount = program.assetTypeSummaries.filter((summary) => summary.overPublishCapBy > 0).length;
  const publishedCount = program.assetTypeSummaries.reduce((total, summary) => total + summary.publishedCount, 0);
  const candidateCount = program.assetTypeSummaries.reduce((total, summary) => total + summary.candidateCount, 0);
  const archiveCount = program.assetTypeSummaries.reduce((total, summary) => total + summary.archiveCount, 0);

  return (
    <>
      <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]">
        <Crown className="h-5 w-5" />
        <h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Asset Pipeline Command</h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--cf-text-muted)]">
        Control developer slots, contribution rules, vote thresholds, library visibility, and per-type caps. Published assets are the only rows loaded into creator-facing Studio libraries; everything else remains visible in the pipeline.
      </p>
      <div className="mt-4 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-text-subtle)]">Owner control map</p>
            <h3 className="mt-1 font-serif text-xl text-[var(--cf-text-strong)]">These rules change the live pipeline after you save.</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">Saving updates limits, voting, tier caps, and review behavior without deleting contribution history.</p>
          </div>
          <div className="min-w-48 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-3 text-sm text-[var(--cf-text-muted)]">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--cf-text-subtle)]">Save state</p>
            <p className="mt-2 text-[var(--cf-accent-text)]">{lastSavedLabel}</p>
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <DecisionCard label="Program status" body={program.configured ? 'Supabase developer tables are connected and accepting submissions.' : 'Developer tables are not configured yet.'} />
        <DecisionCard label="Submissions" body={`${program.totalSubmissionCount} total developer asset submission${program.totalSubmissionCount === 1 ? '' : 's'} in the review system.`} />
        <DecisionCard label="Voteable assets" body={`${program.totalVoteableCount} asset${program.totalVoteableCount === 1 ? '' : 's'} can still receive developer votes, including live assets whose automatic signal remains active.`} />
        <DecisionCard label="Active developers" body={`${program.activeDeveloperCount} active developer${program.activeDeveloperCount === 1 ? '' : 's'} currently count toward voting presets.`} />
        <DecisionCard label="Published policy" body="Creator-facing assets are published pipeline rows with a free or paid tier." />
        <DecisionCard label="Cap pressure" body={overCapCount === 0 ? 'All published asset types are inside current caps.' : `${overCapCount} asset ${overCapCount === 1 ? 'type is' : 'types are'} over cap.`} />
        <DecisionCard label="Self voting" body={settings.allowContributorSelfVoting ? 'Contributors can vote on their own uploads.' : "Only peer votes count for a contributor's assets."} />
        <DecisionCard label="Owner vote mode" body={settings.ownerVoteWeight === 1 ? 'Owner votes count like one developer vote.' : `Owner votes count as ${settings.ownerVoteWeight}x signal.`} />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <DecisionCard label="Live library" body={`${publishedCount} published assets feed creator-facing libraries.`} />
        <DecisionCard label="Waiting for signal" body={`${candidateCount} candidate assets are waiting for votes, owner review, or open caps.`} />
        <DecisionCard label="Recoverable archive" body={`${archiveCount} archived assets remain visible for owner review.`} />
      </div>
    </>
  );
}
