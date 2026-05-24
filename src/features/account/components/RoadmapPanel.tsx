"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  CalendarDays,
  Database,
  History,
  Mail,
  Plus,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  isChronicleTimelineItem,
  sortRoadmapFeatures,
  type RoadmapItem,
  type RoadmapItemType,
  type RoadmapPayload,
  type RoadmapSortMode,
  type RoadmapStatus,
  type RoadmapVoteValue,
} from '@/lib/roadmap';

interface RoadmapPanelProps {
  isDeveloper: boolean;
  isSignedIn: boolean;
  accountEmail: string | null;
}

const statusLabels: Record<RoadmapStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  testing: 'Testing',
  shipped: 'Shipped',
  archived_negative_signal: 'Archived',
};

const itemTypeLabels: Record<RoadmapItemType, string> = {
  roi_checkpoint: 'ROI checkpoint',
  feature: 'Feature goal',
  shipped_update: 'Shipped progress',
};

const sortLabels: Record<RoadmapSortMode, string> = {
  most_votes: 'Most votes',
  least_votes: 'Least votes',
  newest: 'Newest',
  oldest: 'Oldest',
};

const getApiErrorMessage = async (response: Response, fallback: string) => {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
};

const createDeveloperRequestMailto = (accountEmail: string | null) => {
  const subject = 'Card Forge developer account request';
  const body = [
    'Card Forge developer account request',
    '',
    `Account email: ${accountEmail ?? ''}`,
    'Reason for developer access:',
    '',
    'What I want to help test or build:',
    '',
    'Relevant links or notes:',
  ].join('\n');

  return `mailto:Cameron.r.locke96@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

const formatMonth = (value: string) => {
  const date = new Date(`${value}-01T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
};

const formatCurrency = (cents: number | null) => {
  if (cents === null) return null;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
};

const voteTotal = (item: RoadmapItem) => item.upVotes + item.downVotes;

const getTimelinePath = (points: Array<{ x: number; y: number }>) => {
  if (points.length === 0) return '';
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const distance = point.x - previous.x;
    return `${path} C ${previous.x + distance * 0.35} ${previous.y}, ${point.x - distance * 0.35} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
};

function VoteButton({
  label,
  icon,
  active,
  disabled,
  size = 'md',
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  disabled: boolean;
  size?: 'sm' | 'md';
  onClick: () => void;
}) {
  const sizeClass = size === 'sm' ? 'h-8 gap-1.5 px-2 text-xs' : 'h-9 gap-2 px-3 text-sm';

  return (
    <button
      type="button"
      className={`flex items-center border transition ${sizeClass} ${
        active
          ? 'border-[#e6b85c] bg-[#2b1d0e] text-[#ffe7ad]'
          : 'border-[#5f4526] bg-[#100c08] text-[#c7b288] hover:border-[#b68a44] hover:text-[#fff1c7]'
      } disabled:cursor-not-allowed disabled:opacity-50`}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function FeatureCard({
  item,
  isSignedIn,
  isSaving,
  onVote,
}: {
  item: RoadmapItem;
  isSignedIn: boolean;
  isSaving: boolean;
  onVote: (itemId: string, vote: RoadmapVoteValue) => void;
}) {
  return (
    <article className="border border-[#5f4526] bg-[#100c08] p-3 transition hover:border-[#8f6b39]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">
            {voteTotal(item)} total votes
          </span>
          <h3 className="mt-1 text-sm font-semibold leading-5 text-[#ffe7ad]">{item.title}</h3>
        </div>
        <div className="flex shrink-0 gap-2">
          <VoteButton
            label={String(item.upVotes)}
            icon={<ThumbsUp className="h-4 w-4" />}
            active={item.userVote === 'up'}
            disabled={!isSignedIn || isSaving}
            size="sm"
            onClick={() => onVote(item.id, 'up')}
          />
          <VoteButton
            label={String(item.downVotes)}
            icon={<ThumbsDown className="h-4 w-4" />}
            active={item.userVote === 'down'}
            disabled={!isSignedIn || isSaving}
            size="sm"
            onClick={() => onVote(item.id, 'down')}
          />
        </div>
      </div>
    </article>
  );
}

function TimelineNodeCard({
  item,
  index,
  isSignedIn,
  isSaving,
  isDeveloper,
  onVote,
  onDelete,
}: {
  item: RoadmapItem;
  index: number;
  isSignedIn: boolean;
  isSaving: boolean;
  isDeveloper: boolean;
  onVote: (itemId: string, vote: RoadmapVoteValue) => void;
  onDelete: (itemId: string) => void;
}) {
  const target = formatCurrency(item.targetMrrCents);

  return (
    <article className="w-52 shrink-0">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full border-2 border-[#ffe0a0] bg-[#0c0b09] text-sm font-bold text-[#ffe7ad] shadow-[0_0_24px_rgba(228,170,67,0.22)]">
        {index + 1}
      </div>
      <div className="mt-3 border border-[#6d4f2b] bg-[#120d08] p-3 shadow-[inset_0_0_0_1px_rgba(255,224,157,0.05)]">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.12em]">
          <span className="text-[#e2aa4a]">{formatMonth(item.visibleMonth)}</span>
          <span className="border border-[#6f522f] px-1.5 py-0.5 text-[#d9c08c]">{statusLabels[item.status]}</span>
        </div>
        <h4 className="mt-2 font-serif text-lg leading-5 text-[#fff1c7]">{item.title}</h4>
        {item.description ? (
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#c7b288]">{item.description}</p>
        ) : null}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs text-[#e2aa4a]">{target ? `${target} unlock` : itemTypeLabels[item.itemType]}</span>
          <div className="flex shrink-0 gap-1.5">
            <VoteButton
              label={String(item.upVotes)}
            icon={<ThumbsUp className="h-3.5 w-3.5" />}
            active={item.userVote === 'up'}
            disabled={!isSignedIn || isSaving}
            size="sm"
            onClick={() => onVote(item.id, 'up')}
          />
          <VoteButton
            label={String(item.downVotes)}
            icon={<ThumbsDown className="h-3.5 w-3.5" />}
            active={item.userVote === 'down'}
            disabled={!isSignedIn || isSaving}
            size="sm"
            onClick={() => onVote(item.id, 'down')}
          />
            {isDeveloper ? (
              <button
                type="button"
                className="grid h-9 w-9 place-items-center border border-[#7d3d32] bg-[#1b0d09] text-[#f3a28f] transition hover:border-[#e27f69] hover:text-[#ffd0c6]"
                disabled={isSaving}
                onClick={() => onDelete(item.id)}
                aria-label={`Delete ${item.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function HorizontalTimeline({
  items,
  isLoading,
  isDeveloper,
  isSignedIn,
  isSaving,
  onDelete,
  onVote,
}: {
  items: RoadmapItem[];
  isLoading: boolean;
  isDeveloper: boolean;
  isSignedIn: boolean;
  isSaving: boolean;
  onDelete: (itemId: string) => void;
  onVote: (itemId: string, vote: RoadmapVoteValue) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="border border-[#5f4526] bg-[#0c0b09] p-4 text-sm leading-6 text-[#c7b288]">
        {isLoading
          ? 'Loading milestones...'
          : 'Milestones will appear here as launch checkpoints are published. For now, add or vote on a focused improvement above.'}
      </div>
    );
  }

  const width = Math.max(900, items.length * 205);
  const step = items.length > 1 ? (width - 160) / (items.length - 1) : 0;
  const points = items.map((_, index) => ({
    x: 80 + step * index,
    y: index % 2 === 0 ? 84 : 34,
  }));
  const path = getTimelinePath(points);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute bottom-2 right-0 top-0 z-10 w-16 bg-gradient-to-l from-[#100c08] to-transparent" aria-hidden="true" />
      <div className="overflow-x-auto pb-2 pr-6">
      <div className="relative min-h-[24rem]" style={{ width }}>
        <svg
          className="absolute left-0 top-0 h-32 w-full"
          viewBox={`0 0 ${width} 126`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={path} fill="none" stroke="#8b642f" strokeWidth="5" strokeLinecap="round" />
          <path d={path} fill="none" stroke="#e4aa43" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="8 12" opacity="0.85" />
        </svg>
        <div className="absolute left-0 right-0 top-5 flex justify-between gap-4 px-6">
          {items.map((item, index) => (
            <div key={item.id} className={index % 2 === 0 ? 'pt-12' : 'pt-0'}>
              <TimelineNodeCard
                item={item}
                index={index}
                isDeveloper={isDeveloper}
                isSignedIn={isSignedIn}
                isSaving={isSaving}
                onDelete={onDelete}
                onVote={onVote}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}

export function RoadmapPanel({ isDeveloper, isSignedIn, accountEmail }: RoadmapPanelProps) {
  const { toast } = useToast();
  const [payload, setPayload] = useState<RoadmapPayload | null>(null);
  const [suggestion, setSuggestion] = useState('');
  const [sortMode, setSortMode] = useState<RoadmapSortMode>('most_votes');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [devForm, setDevForm] = useState({
    title: '',
    description: '',
    itemType: 'roi_checkpoint' as Exclude<RoadmapItemType, 'feature'>,
    status: 'planned' as RoadmapStatus,
    visibleMonth: '2026-06',
    targetMrrDollars: '',
    monthlyCostDollars: '',
  });
  const developerRequestMailto = useMemo(() => createDeveloperRequestMailto(accountEmail), [accountEmail]);

  const chronicleItems = useMemo(() => payload?.items.filter(isChronicleTimelineItem) ?? [], [payload]);
  const featureBoardItems = useMemo(() => payload?.items.filter((item) => item.itemType === 'feature') ?? [], [payload]);
  const featureItems = useMemo(() => sortRoadmapFeatures(featureBoardItems, sortMode), [featureBoardItems, sortMode]);
  const sortedOfficialItems = useMemo(() => [...chronicleItems].sort((left, right) => {
    if (left.visibleMonth !== right.visibleMonth) return left.visibleMonth.localeCompare(right.visibleMonth);
    return left.createdAt.localeCompare(right.createdAt);
  }), [chronicleItems]);
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
        throw new Error(await getApiErrorMessage(response, 'Unable to load roadmap.'));
      }
      setPayload(await response.json() as RoadmapPayload);
    } catch (error) {
      toast({
        title: 'Chronicle unavailable',
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
        throw new Error(await getApiErrorMessage(response, 'Unable to save vote.'));
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
        throw new Error(await getApiErrorMessage(response, 'Unable to create feature suggestion.'));
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
          targetMrrCents: devForm.targetMrrDollars ? Number(devForm.targetMrrDollars) * 100 : undefined,
          monthlyCostCents: devForm.monthlyCostDollars ? Number(devForm.monthlyCostDollars) * 100 : undefined,
        }),
      });
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, 'Unable to add timeline item.'));
      }
      setPayload(await response.json() as RoadmapPayload);
      setDevForm((current) => ({ ...current, title: '', description: '', targetMrrDollars: '', monthlyCostDollars: '' }));
      toast({
        title: 'Chronicle updated',
        description: 'The official timeline item has been added.',
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
        throw new Error(await getApiErrorMessage(response, 'Unable to delete timeline item.'));
      }
      setPayload(await response.json() as RoadmapPayload);
      toast({
        title: 'Chronicle entry deleted',
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
            <h2 className="mt-3 font-serif text-3xl text-[#fff1c7] md:text-4xl">Help choose what becomes easier next</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c7b288]">
              Vote on small improvements, add a focused request, and follow the larger milestones as CardForge grows.
            </p>
          </div>
          <Button asChild variant="outline" className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]">
            <a href={developerRequestMailto}>
              <Mail className="mr-2 h-4 w-4" />
              Become a developer
            </a>
          </Button>
        </div>

        {!payload?.configured && !isLoading ? (
          <div className="mt-6 border border-[#7d5a2e] bg-[#181009] p-4 text-sm leading-6 text-[#f0c27a]">
            Supabase is connected in env, but the Chronicle tables are not ready yet. Run both Supabase migrations, then refresh this page.
          </div>
        ) : null}

        <div className="mt-6 border border-[#5f4526] bg-[#100c08] p-4 md:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="font-serif text-2xl text-[#fff1c7]">Feature board</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c7b288]">
                Signed-in makers can add compact requests and vote on what should get priority. Strong signals move into the roadmap instead of getting buried in feedback.
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

          <div className="mt-5 grid gap-4 lg:grid-cols-[0.78fr_1fr]">
            <div className="border border-[#5f4526] bg-[#0c0b09] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="font-serif text-lg text-[#fff1c7]">Add a focused request</h4>
                <p className="mt-2 text-sm leading-5 text-[#c7b288]">
                  One clear improvement gives everyone a cleaner vote.
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
                className="min-h-24 w-full resize-none border border-[#5f4526] bg-[#0c0b09] p-3 text-sm text-[#ffe7ad] outline-none transition placeholder:text-[#8c7651] focus:border-[#d8b365]"
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
              <h4 className="font-serif text-lg text-[#fff1c7]">Vote with the community</h4>
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
            <div className="mt-4 space-y-3">
              {featureItems.map((item) => (
                <FeatureCard
                  key={item.id}
                  item={item}
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
                <h3 className="font-serif text-2xl text-[#fff1c7]">Roadmap timeline</h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[#c7b288]">
                  A scrollable launch path for larger milestones, shipped progress, and business checkpoints.
                </p>
              </div>
            </div>
            <span className="border border-[#5f4526] bg-[#100c08] px-3 py-2 text-xs uppercase tracking-[0.16em] text-[#d9c08c]">
              {sortedOfficialItems.length} milestones
            </span>
          </div>
          <div className="relative border border-[#5f4526] bg-[#100c08] p-4 md:p-5">
            <HorizontalTimeline
              items={sortedOfficialItems}
              isLoading={isLoading}
              isDeveloper={isDeveloper}
              isSignedIn={isSignedIn}
              isSaving={isSaving}
              onDelete={deleteItem}
              onVote={saveVote}
            />
          </div>
        </div>

        {isDeveloper ? (
          <form className="mt-6 border border-[#7d5a2e] bg-[#181009] p-4" onSubmit={submitDeveloperItem}>
            <div className="flex items-center gap-3 text-[#e2aa4a]">
              <Database className="h-5 w-5" />
              <h3 className="font-serif text-xl text-[#fff1c7]">Developer milestone controls</h3>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                className="border border-[#5f4526] bg-[#0c0b09] p-3 text-sm text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                value={devForm.title}
                placeholder="Timeline title"
                maxLength={200}
                onChange={(event) => setDevForm((current) => ({ ...current, title: event.target.value }))}
              />
              <input
                className="border border-[#5f4526] bg-[#0c0b09] p-3 text-sm text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                value={devForm.visibleMonth}
                placeholder="YYYY-MM"
                pattern="\d{4}-\d{2}"
                onChange={(event) => setDevForm((current) => ({ ...current, visibleMonth: event.target.value }))}
              />
              <select
                className="border border-[#5f4526] bg-[#0c0b09] p-3 text-sm text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                value={devForm.itemType}
                onChange={(event) => setDevForm((current) => ({ ...current, itemType: event.target.value as Exclude<RoadmapItemType, 'feature'> }))}
              >
                <option value="roi_checkpoint">Chronicle ROI checkpoint</option>
                <option value="shipped_update">Chronicle shipped progress</option>
              </select>
              <select
                className="border border-[#5f4526] bg-[#0c0b09] p-3 text-sm text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                value={devForm.status}
                onChange={(event) => setDevForm((current) => ({ ...current, status: event.target.value as RoadmapStatus }))}
              >
                <option value="planned">Planned</option>
                <option value="in_progress">In progress</option>
                <option value="testing">Testing</option>
                <option value="shipped">Shipped</option>
              </select>
              <input
                className="border border-[#5f4526] bg-[#0c0b09] p-3 text-sm text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                value={devForm.targetMrrDollars}
                placeholder="MRR target dollars"
                inputMode="numeric"
                onChange={(event) => setDevForm((current) => ({ ...current, targetMrrDollars: event.target.value }))}
              />
              <input
                className="border border-[#5f4526] bg-[#0c0b09] p-3 text-sm text-[#ffe7ad] outline-none focus:border-[#d8b365]"
                value={devForm.monthlyCostDollars}
                placeholder="Monthly upgrade cost dollars"
                inputMode="numeric"
                onChange={(event) => setDevForm((current) => ({ ...current, monthlyCostDollars: event.target.value }))}
              />
              <textarea
                className="min-h-24 border border-[#5f4526] bg-[#0c0b09] p-3 text-sm text-[#ffe7ad] outline-none focus:border-[#d8b365] md:col-span-2"
                value={devForm.description}
                placeholder="Why this checkpoint matters"
                maxLength={420}
                onChange={(event) => setDevForm((current) => ({ ...current, description: event.target.value }))}
              />
            </div>
            <Button
              type="submit"
              className="mt-4 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]"
              disabled={isSaving || devForm.title.trim().length === 0}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Chronicle item
            </Button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
