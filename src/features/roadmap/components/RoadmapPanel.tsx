"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  CalendarDays,
  DollarSign,
  History,
  Mail,
  Send,
  Target,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { createRoadmapDeveloperRequestMailto } from '@/features/contact/client/links';
import { RoadmapDeveloperControls } from '@/features/roadmap/components/RoadmapDeveloperControls';
import {
  createRoadmapDeveloperFormState,
  type RoadmapDeveloperFormState,
} from '@/features/roadmap/components/RoadmapDeveloperControlsModel';
import {
  FeatureCard,
  FinancialMetric,
  HorizontalTimeline,
  formatMonthlyCurrency,
  sortLabels,
  voteTotal,
} from '@/features/roadmap/components/RoadmapPresentation';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import {
  ROADMAP_OPERATING_COST_COVERAGE_MULTIPLIER,
  buildRoadmapTimelineCheckpoints,
  findNextRoadmapIncomeCheckpoint,
  isChronicleTimelineItem,
  sortRoadmapFeatures,
  type RoadmapPayload,
  type RoadmapSortMode,
  type RoadmapVoteValue,
} from '@/features/roadmap/model/roadmap';

interface RoadmapPanelProps {
  isDeveloper: boolean;
  isOwner: boolean;
  isSignedIn: boolean;
  accountEmail: string | null;
  supportEmail?: string | null;
}

export function RoadmapPanel({ isDeveloper, isOwner, isSignedIn, accountEmail, supportEmail }: RoadmapPanelProps) {
  const { toast } = useToast();
  const [payload, setPayload] = useState<RoadmapPayload | null>(null);
  const [suggestion, setSuggestion] = useState('');
  const [sortMode, setSortMode] = useState<RoadmapSortMode>('most_votes');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [devForm, setDevForm] = useState<RoadmapDeveloperFormState>(() => (
    createRoadmapDeveloperFormState(isOwner)
  ));
  const developerRequestMailto = useMemo(
    () => createRoadmapDeveloperRequestMailto({ accountEmail, supportEmail }),
    [accountEmail, supportEmail]
  );

  const chronicleItems = useMemo(() => payload?.items.filter(isChronicleTimelineItem) ?? [], [payload]);
  const featureBoardItems = useMemo(() => payload?.items.filter((item) => (
    item.itemType === 'feature' && item.status !== 'shipped'
  )) ?? [], [payload]);
  const featureItems = useMemo(() => sortRoadmapFeatures(featureBoardItems, sortMode), [featureBoardItems, sortMode]);
  const sortedOfficialItems = useMemo(() => [...chronicleItems].sort((left, right) => {
    if (left.visibleMonth !== right.visibleMonth) return left.visibleMonth.localeCompare(right.visibleMonth);
    return left.createdAt.localeCompare(right.createdAt);
  }), [chronicleItems]);
  const timelineCheckpoints = useMemo(
    () => buildRoadmapTimelineCheckpoints(sortedOfficialItems),
    [sortedOfficialItems]
  );
  const creatorPassIncome = payload?.creatorPassIncome ?? null;
  const revenueAvailable = creatorPassIncome?.available === true;
  const roadmapAvailable = payload?.configured === true;
  const planningComparisonAvailable = revenueAvailable && roadmapAvailable;
  const roadmapIncomeCents = creatorPassIncome?.roadmapIncomeCents ?? 0;
  const nextFundingCheckpoint = useMemo(
    () => findNextRoadmapIncomeCheckpoint(timelineCheckpoints, roadmapIncomeCents),
    [roadmapIncomeCents, timelineCheckpoints]
  );
  const latestFundingCheckpoint = timelineCheckpoints.length > 0
    ? timelineCheckpoints[timelineCheckpoints.length - 1]
    : null;
  const nextRequiredIncomeCents = nextFundingCheckpoint?.requiredRoadmapIncomeCents ?? 0;
  const nextFundingGapCents = planningComparisonAvailable
    ? Math.max(0, nextRequiredIncomeCents - roadmapIncomeCents)
    : null;
  const fullRoadmapMonthlyCostCents = latestFundingCheckpoint?.cumulativeMonthlyCostCents ?? 0;
  const fullRoadmapRequiredIncomeCents = latestFundingCheckpoint?.requiredRoadmapIncomeCents ?? 0;
  const totalDeductionsCents = creatorPassIncome
    ? creatorPassIncome.estimatedTaxCents + creatorPassIncome.operatingReserveCents
    : 0;
  const maxSuggestionLength = payload?.maxSuggestionLength ?? 200;
  const activeUserSuggestionCount = payload?.activeUserSuggestionCount ?? 0;
  const maxActiveUserSuggestions = payload?.maxActiveUserSuggestions ?? 50;
  const boardHasSpace = activeUserSuggestionCount < maxActiveUserSuggestions;
  const remainingSuggestionSlots = Math.max(0, maxActiveUserSuggestions - activeUserSuggestionCount);
  const featureVoteCount = featureBoardItems.reduce((total, item) => total + voteTotal(item), 0);

  const loadRoadmap = useCallback(async () => {
    try {
      const response = await fetch('/api/roadmap', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Unable to load roadmap.'));
      }
      setPayload(await response.json() as RoadmapPayload);
    } catch (error) {
      toast({
        title: 'Roadmap unavailable',
        description: error instanceof Error ? error.message : 'Unable to load roadmap.',
        variant: 'destructive',
      });
      setPayload(null);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadRoadmap();
  }, [loadRoadmap]);

  const saveVote = async (itemId: string, vote: RoadmapVoteValue) => {
    if (!isSignedIn) {
      toast({
        title: 'Sign in to vote',
        description: 'Roadmap votes are tied to one account so the board stays clean.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/roadmap/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, vote }),
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Unable to save vote.'));
      }
      setPayload(await response.json() as RoadmapPayload);
    } catch (error) {
      toast({
        title: 'Vote not saved',
        description: error instanceof Error ? error.message : 'Unable to save vote.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const submitSuggestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSignedIn) {
      toast({
        title: 'Sign in to suggest a feature',
        description: 'Feature suggestions use your account so each beta voice stays accountable.',
      });
      return;
    }
    if (!boardHasSpace) {
      toast({
        title: 'Feature board is full',
        description: 'Use the email option for detailed feedback while we clear space.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: suggestion }),
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Unable to create feature suggestion.'));
      }
      setPayload(await response.json() as RoadmapPayload);
      setSuggestion('');
      toast({
        title: 'Feature added',
        description: 'Your idea is now ready for votes.',
      });
    } catch (error) {
      toast({
        title: 'Feature not added',
        description: error instanceof Error ? error.message : 'Unable to create feature suggestion.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const submitDeveloperItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch('/api/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developerItem: true,
          title: devForm.title,
          description: devForm.description,
          itemType: devForm.itemType,
          status: devForm.status,
          visibleMonth: devForm.visibleMonth,
          monthlyCostCents: devForm.monthlyCostDollars ? Number(devForm.monthlyCostDollars) * 100 : undefined,
          expenseProvider: devForm.expenseProvider,
          expensePlan: devForm.expensePlan,
          expenseSourceUrl: devForm.expenseSourceUrl,
          expenseVerifiedAt: devForm.expenseVerifiedAt,
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Unable to add timeline item.'));
      }
      setPayload(await response.json() as RoadmapPayload);
      setDevForm((current) => ({
        ...current,
        title: '',
        description: '',
        monthlyCostDollars: '',
        expenseProvider: '',
        expensePlan: '',
        expenseSourceUrl: '',
      }));
      toast({
        title: 'Roadmap updated',
        description: 'The CardForge-authored roadmap item has been added.',
      });
    } catch (error) {
      toast({
        title: 'Timeline item not added',
        description: error instanceof Error ? error.message : 'Unable to add timeline item.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteItem = async (itemId: string) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/roadmap/items/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Unable to delete timeline item.'));
      }
      setPayload(await response.json() as RoadmapPayload);
      toast({
        title: 'Roadmap entry deleted',
        description: 'The timeline item has been removed from the public board.',
      });
    } catch (error) {
      toast({
        title: 'Timeline item not deleted',
        description: error instanceof Error ? error.message : 'Unable to delete timeline item.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 pb-10 md:px-6">
      <div className="border border-[#6d4f2b] bg-[#15100a] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3 text-[#e2aa4a]">
              <History className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Roadmap</span>
            </div>
            <h2 className="mt-3 font-serif text-3xl text-[#fff1c7] md:text-4xl">Help choose what CardForge improves next</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c7b288]">
              Vote on focused improvements and follow the real service upgrades CardForge can plan around as Creator Pass grows.
            </p>
          </div>
          <Button asChild variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
            <a href={developerRequestMailto}>
              <Mail className="mr-2 h-4 w-4" />
              Share detailed feedback
            </a>
          </Button>
        </div>

        {!payload?.configured && !isLoading ? (
          <div className="mt-6 border border-[#7d5a2e] bg-[#181009] p-4 text-sm leading-6 text-[#f0c27a]">
            The public roadmap is temporarily unavailable. Please try again later.
          </div>
        ) : null}

        <div className="mt-6 border border-[#5f4526] bg-[#100c08] p-4 md:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="font-serif text-2xl text-[#fff1c7]">Feature requests</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c7b288]">
                Signed-in creators can suggest one focused improvement at a time and vote on the requests that matter most.
              </p>
            </div>
            <div className="grid grid-cols-3 border border-[#6d4f2b] bg-[#0c0b09] text-center">
              <div className="border-r border-[#5f4526] px-3 py-2">
                <span className="block text-lg font-semibold text-[#ffe7ad]">{featureItems.length}</span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-[#a98a55]">ideas</span>
              </div>
              <div className="border-r border-[#5f4526] px-3 py-2">
                <span className="block text-lg font-semibold text-[#ffe7ad]">{featureVoteCount}</span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-[#a98a55]">votes</span>
              </div>
              <div className="px-3 py-2">
                <span className="block text-lg font-semibold text-[#ffe7ad]">{remainingSuggestionSlots}</span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-[#a98a55]">slots</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[0.64fr_1fr]">
            <div className="self-start border border-[#5f4526] bg-[#0c0b09] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="font-serif text-lg text-[#fff1c7]">Add one request</h4>
                <p className="mt-2 text-sm leading-5 text-[#c7b288]">
                  Keep it small enough that people can vote yes or no quickly.
                </p>
              </div>
              <span className="text-sm text-[#c7b288]">
                {activeUserSuggestionCount}/{maxActiveUserSuggestions}
              </span>
            </div>
            <form className="mt-4 space-y-3" onSubmit={submitSuggestion}>
              <label className="sr-only" htmlFor="roadmap-suggestion">Suggest a feature</label>
              <textarea
                id="roadmap-suggestion"
                className="min-h-20 w-full resize-none border border-[#5f4526] bg-[#0c0b09] p-3 text-sm text-[#ffe7ad] outline-none transition placeholder:text-[#8c7651] focus:border-[#d8b365]"
                maxLength={maxSuggestionLength}
                value={suggestion}
                placeholder={boardHasSpace ? 'Example: easier foil border controls' : 'Feature board is full. Send detailed feedback by email.'}
                disabled={!boardHasSpace || isSaving}
                onChange={(event) => setSuggestion(event.target.value)}
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-[#a98a55]">
                  {suggestion.length}/{maxSuggestionLength}
                </span>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]"
                  disabled={!boardHasSpace || isSaving || suggestion.trim().length === 0}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Add feature
                </Button>
              </div>
            </form>
          </div>

          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="font-serif text-lg text-[#fff1c7]">Vote the queue</h4>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                {(Object.keys(sortLabels) as RoadmapSortMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`border px-3 py-2 text-xs transition ${
                      sortMode === mode
                        ? 'border-[#e6b85c] bg-[#2b1d0e] text-[#ffe7ad]'
                        : 'border-[#5f4526] bg-[#100c08] text-[#c7b288] hover:border-[#b68a44] hover:text-[#fff1c7]'
                    }`}
                    onClick={() => setSortMode(mode)}
                  >
                    {sortLabels[mode]}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {featureItems.map((item, index) => (
                <FeatureCard
                  key={item.id}
                  item={item}
                  rank={index + 1}
                  isSignedIn={isSignedIn}
                  isSaving={isSaving}
                  onVote={saveVote}
                />
              ))}
              {!isLoading && featureItems.length === 0 ? (
                <p className="border border-[#5f4526] bg-[#100c08] p-4 text-sm text-[#c7b288]">
                  No public beta suggestions yet. Add a compact request to start the board.
                </p>
              ) : null}
            </div>
          </div>
        </div>
        </div>

        <div className="mt-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-1 h-5 w-5 text-[#e2aa4a]" />
              <div>
                <h3 className="font-serif text-2xl text-[#fff1c7]">Planned service upgrades</h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[#c7b288]">
                  Verified service upgrades with their monthly cost, official pricing source, and the {ROADMAP_OPERATING_COST_COVERAGE_MULTIPLIER}× income buffer CardForge requires before taking on each increase.
                </p>
              </div>
            </div>
            <span className="border border-[#5f4526] bg-[#100c08] px-3 py-2 text-xs uppercase tracking-[0.16em] text-[#d9c08c]">
              {sortedOfficialItems.length} checkpoints
            </span>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FinancialMetric
              label="Est. roadmap income"
              value={revenueAvailable ? formatMonthlyCurrency(roadmapIncomeCents) ?? '$0/mo' : 'Unavailable'}
              detail={creatorPassIncome
                ? `Listed-price run rate after ${creatorPassIncome.estimatedTaxPercent}% estimated tax and a ${creatorPassIncome.operatingReservePercent}% post-tax reserve.`
                : 'Waiting for the current Creator Pass subscription summary.'}
              icon={<DollarSign className="h-3.5 w-3.5" />}
              emphasis
            />
            <FinancialMetric
              label="Gross Creator Pass MRR"
              value={revenueAvailable ? formatMonthlyCurrency(creatorPassIncome?.grossMonthlyRevenueCents ?? 0) ?? '$0/mo' : 'Unavailable'}
              detail={revenueAvailable && creatorPassIncome
                ? `${creatorPassIncome.activeSubscriberCount} active Creator Pass subscription${creatorPassIncome.activeSubscriberCount === 1 ? '' : 's'} at current listed prices; trials and support excluded.`
                : 'Current funding progress is temporarily unavailable.'}
              icon={<Target className="h-3.5 w-3.5" />}
            />
            <FinancialMetric
              label="Planning deductions"
              value={revenueAvailable ? `-${formatMonthlyCurrency(totalDeductionsCents) ?? '$0/mo'}` : 'Unavailable'}
              detail="Estimated income tax plus the requested operating reserve; this is planning, not filed tax accounting."
              icon={<Target className="h-3.5 w-3.5" />}
            />
            <FinancialMetric
              label={!roadmapAvailable ? 'Expense roadmap' : nextFundingCheckpoint ? 'Next planning gap' : 'Planning comparison'}
              value={!roadmapAvailable || !revenueAvailable
                ? 'Unavailable'
                : nextFundingCheckpoint
                  ? formatMonthlyCurrency(nextFundingGapCents) ?? '$0/mo'
                  : 'No planning gap'}
              detail={roadmapAvailable
                ? `Verified fixed upgrades total ${formatMonthlyCurrency(fullRoadmapMonthlyCostCents) ?? '$0/mo'}, requiring ${formatMonthlyCurrency(fullRoadmapRequiredIncomeCents) ?? '$0/mo'} of post-deduction roadmap income at the ${ROADMAP_OPERATING_COST_COVERAGE_MULTIPLIER}× rule.`
                : 'Waiting for the verified expense roadmap.'}
              icon={<DollarSign className="h-3.5 w-3.5" />}
            />
          </div>
          <p className="mb-4 text-xs leading-5 text-[#a98a55]">
            Revenue figures are planning estimates from active Creator Pass subscriptions at their listed recurring prices. Upgrade checkpoints require that post-tax, post-reserve estimate to reach {ROADMAP_OPERATING_COST_COVERAGE_MULTIPLIER}× the running verified monthly cost. Figures do not deduct Stripe fees, discounts, credits, refunds, or prove that an invoice was paid.
          </p>
          <div className="relative border border-[#5f4526] bg-[#100c08] p-4 md:p-5">
            <HorizontalTimeline
              items={timelineCheckpoints}
              isLoading={isLoading}
              isDeveloper={isDeveloper}
              isSignedIn={isSignedIn}
              isSaving={isSaving}
              onDelete={deleteItem}
              onVote={saveVote}
            />
          </div>
        </div>

        <RoadmapDeveloperControls
          form={devForm}
          isDeveloper={isDeveloper}
          isOwner={isOwner}
          isSaving={isSaving}
          onChange={setDevForm}
          onSubmit={submitDeveloperItem}
        />
      </div>
    </section>
  );
}
