"use client";

import { Button } from '@/components/ui/button';
import { ProfileOverrideField } from '@/features/developer-assets/components/OwnerDeveloperProgramControls';
import type { DeveloperAssetProgramView } from '@/features/developer-assets/lib/developerAssetStore';
import type { DeveloperProgramSettings } from '@/features/developer-assets/lib/developerAssets';

export interface DeveloperProfileDraft {
  status: 'invited' | 'active' | 'inactive' | 'suspended';
  monthlySubmissionLimitOverride: string;
  monthlyPublishedRequirementOverride: string;
  profitShareEligible: boolean;
  ownerNote: string;
}

const profileStatusLabels: Record<DeveloperProfileDraft['status'], string> = {
  invited: 'Invited',
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
};

const getContributorLabel = (developerId: string, developerEmail: string | null, developerName?: string | null) => (
  developerName || developerEmail || developerId
);

interface OwnerDeveloperLedgerProps {
  program: DeveloperAssetProgramView;
  settings: DeveloperProgramSettings;
  profileDrafts: Record<string, DeveloperProfileDraft>;
  savingProfileId: string | null;
  onDraftChange: (developerId: string, patch: Partial<DeveloperProfileDraft>) => void;
  onSave: (developerId: string) => Promise<void>;
}

export function OwnerDeveloperLedger({
  program,
  settings,
  profileDrafts,
  savingProfileId,
  onDraftChange,
  onSave,
}: OwnerDeveloperLedgerProps) {
  return (
    <div className="border border-[#5f4526] bg-[#100c08] p-4">
      <h3 className="font-serif text-xl text-[#fff1c7]">Developer monthly ledger</h3>
      <p className="mt-2 text-sm leading-6 text-[#c7b288]">
        Start with the base monthly contract, then adjust a developer only when they need a different submission cap, published requirement, or future creator-pool eligibility.
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
                <span className={`border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${contribution.submissionLimitOverride !== null || contribution.publishedRequirementOverride !== null ? 'border-[#5f7f54] text-[#bde3a8]' : 'border-[#5f4526] text-[#d7b469]'}`}>
                  {contribution.submissionLimitOverride !== null || contribution.publishedRequirementOverride !== null ? 'Account override' : 'Base contract'}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#c7b288]">
                {contribution.submitted} submitted / {contribution.remainingSubmissions} left from {contribution.effectiveSubmissionLimit} allowed - {contribution.published} published / {contribution.requiredPublished} required
              </p>
              <p className={`mt-1 text-xs ${contribution.missingPublished > 0 ? 'text-[#f0bd75]' : 'text-[#bde3a8]'}`}>
                {contribution.missingPublished > 0
                  ? `${contribution.missingPublished} more published asset${contribution.missingPublished === 1 ? '' : 's'} needed this month.`
                  : 'Monthly published requirement met.'}
              </p>
              <div className="mt-3 grid gap-2 border border-[#3c2c1b] bg-[#100c08] p-3">
                <label className="grid gap-1 text-xs text-[#c7b288]">
                  Profile status
                  <select className="border border-[#3c2c1b] bg-[#15100a] p-2 text-[#ffe7ad]" value={draft.status} onChange={(event) => onDraftChange(contribution.developerId, { status: event.target.value as DeveloperProfileDraft['status'] })}>
                    {(['active', 'invited', 'inactive', 'suspended'] as const).map((status) => (
                      <option key={status} value={status}>{profileStatusLabels[status]}</option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ProfileOverrideField label="Submission override" ariaLabel={`Submission allowance override for ${contributorLabel}`} placeholder={`Base ${settings.monthlySubmissionLimit}`} value={draft.monthlySubmissionLimitOverride} onChange={(value) => onDraftChange(contribution.developerId, { monthlySubmissionLimitOverride: value })} />
                  <ProfileOverrideField label="Published override" ariaLabel={`Required published override for ${contributorLabel}`} placeholder={`Base ${settings.monthlyPublishedRequirement}`} value={draft.monthlyPublishedRequirementOverride} onChange={(value) => onDraftChange(contribution.developerId, { monthlyPublishedRequirementOverride: value })} />
                </div>
                <label className="flex items-center justify-between gap-3 border border-[#3c2c1b] bg-[#15100a] p-2 text-xs text-[#ffe7ad]">
                  <span>Future creator-pool eligible<span className="mt-1 block text-[#a98a55]">Planning flag only. No payout automation is live yet.</span></span>
                  <input type="checkbox" checked={draft.profitShareEligible} onChange={(event) => onDraftChange(contribution.developerId, { profitShareEligible: event.target.checked })} />
                </label>
                <label className="grid gap-1 text-xs text-[#c7b288]">
                  Owner note
                  <textarea className="min-h-16 border border-[#3c2c1b] bg-[#15100a] p-2 text-[#ffe7ad]" value={draft.ownerNote} onChange={(event) => onDraftChange(contribution.developerId, { ownerNote: event.target.value })} />
                </label>
                <Button type="button" size="sm" className="justify-self-start bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={savingProfileId === contribution.developerId} onClick={() => void onSave(contribution.developerId)}>
                  {savingProfileId === contribution.developerId ? 'Saving...' : 'Save account contract'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
