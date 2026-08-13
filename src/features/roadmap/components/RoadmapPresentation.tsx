import type { ReactNode } from 'react';
import { ExternalLink, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';

import {
  ROADMAP_OPERATING_COST_COVERAGE_MULTIPLIER,
  type RoadmapItem,
  type RoadmapItemType,
  type RoadmapSortMode,
  type RoadmapStatus,
  type RoadmapTimelineCheckpoint,
  type RoadmapVoteValue,
} from '@/features/roadmap/model/roadmap';

const statusLabels: Record<RoadmapStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  testing: 'Testing',
  shipped: 'Shipped',
  archived_negative_signal: 'Archived',
};

const itemTypeLabels: Record<RoadmapItemType, string> = {
  roi_checkpoint: 'Service upgrade',
  feature: 'Feature goal',
  shipped_update: 'Shipped progress',
};

export const sortLabels: Record<RoadmapSortMode, string> = {
  most_votes: 'Most votes',
  least_votes: 'Least votes',
  newest: 'Newest',
  oldest: 'Oldest',
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

export const formatMonthlyCurrency = (cents: number | null) => {
  const value = formatCurrency(cents);
  return value ? `${value}/mo` : null;
};

export const voteTotal = (item: RoadmapItem) => item.upVotes + item.downVotes;

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
export function FeatureCard({
  item,
  rank,
  isSignedIn,
  isSaving,
  onVote,
}: {
  item: RoadmapItem;
  rank: number;
  isSignedIn: boolean;
  isSaving: boolean;
  onVote: (itemId: string, vote: RoadmapVoteValue) => void;
}) {
  return (
    <article className="border border-[#5f4526] bg-[#100c08] p-3 transition hover:border-[#8f6b39]">
      <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3">
        <span className="grid h-8 w-8 place-items-center border border-[#6d4f2b] bg-[#0c0b09] text-xs font-semibold text-[#e2aa4a]">
          {rank}
        </span>
        <div className="min-w-0">
          <span className="text-[10px] uppercase tracking-[0.16em] text-[#a98a55]">
            {item.source === 'official' ? 'CardForge plan' : 'Community suggestion'} · {statusLabels[item.status]} · {voteTotal(item)} votes
          </span>
          <h3 className="mt-1 text-sm font-semibold leading-5 text-[#ffe7ad]">{item.title}</h3>
          {item.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#a98a55]">{item.description}</p> : null}
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
  cumulativeMonthlyCostCents,
  requiredRoadmapIncomeCents,
  isSignedIn,
  isSaving,
  isDeveloper,
  onVote,
  onDelete,
}: {
  item: RoadmapItem;
  index: number;
  cumulativeMonthlyCostCents: number;
  requiredRoadmapIncomeCents: number;
  isSignedIn: boolean;
  isSaving: boolean;
  isDeveloper: boolean;
  onVote: (itemId: string, vote: RoadmapVoteValue) => void;
  onDelete: (itemId: string) => void;
}) {
  const target = cumulativeMonthlyCostCents > 0
    ? formatMonthlyCurrency(requiredRoadmapIncomeCents)
    : null;
  const newCost = formatMonthlyCurrency(item.monthlyCostCents);
  const runningCost = cumulativeMonthlyCostCents > 0
    ? formatMonthlyCurrency(cumulativeMonthlyCostCents)
    : null;

  return (
    <article className="w-60 shrink-0">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full border-2 border-[#ffe0a0] bg-[#0c0b09] text-sm font-bold text-[#ffe7ad] shadow-[0_0_24px_rgba(228,170,67,0.22)]">
        {index + 1}
      </div>
      <div className="mt-3 border border-[#6d4f2b] bg-[#120d08] p-3 shadow-[inset_0_0_0_1px_rgba(255,224,157,0.05)]">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.12em]">
          <span className="text-[#e2aa4a]">{formatMonth(item.visibleMonth)}</span>
          <span className="border border-[#6f522f] px-1.5 py-0.5 text-[#d9c08c]">{statusLabels[item.status]}</span>
        </div>
        <h4 className="mt-2 font-serif text-lg leading-5 text-[#fff1c7]">{item.title}</h4>
        {item.expenseProvider && item.expensePlan ? (
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#e2aa4a]">
            {item.expenseProvider} · {item.expensePlan}
          </p>
        ) : null}
        {item.description ? (
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#c7b288]">{item.description}</p>
        ) : null}
        <div className="mt-3 grid gap-1 text-[11px] leading-4">
          {target ? (
            <div className="flex items-center justify-between gap-2 border border-[#5f4526] bg-[#0c0b09] px-2 py-1">
              <span className="uppercase tracking-[0.12em] text-[#a98a55]">
                Income needed ({ROADMAP_OPERATING_COST_COVERAGE_MULTIPLIER}×)
              </span>
              <span className="text-[#ffe7ad]">{target}</span>
            </div>
          ) : null}
          {newCost ? (
            <div className="flex items-center justify-between gap-2 border border-[#5f4526] bg-[#0c0b09] px-2 py-1">
              <span className="uppercase tracking-[0.12em] text-[#a98a55]">New cost</span>
              <span className="text-[#d9c08c]">{newCost}</span>
            </div>
          ) : null}
          {runningCost ? (
            <div className="flex items-center justify-between gap-2 border border-[#6f522f] bg-[#17110b] px-2 py-1">
              <span className="uppercase tracking-[0.12em] text-[#a98a55]">Running cost</span>
              <span className="text-[#e2aa4a]">{runningCost}</span>
            </div>
          ) : null}
          {!target && !newCost && !runningCost ? (
            <span className="text-xs text-[#e2aa4a]">{itemTypeLabels[item.itemType]}</span>
          ) : null}
          {item.expenseSourceUrl && item.expenseVerifiedAt ? (
            <a
              className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-[#d8b365] underline decoration-[#6d4f2b] underline-offset-4 hover:text-[#ffe7ad]"
              href={item.expenseSourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Pricing verified {item.expenseVerifiedAt}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
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

export function HorizontalTimeline({
  items,
  isLoading,
  isDeveloper,
  isSignedIn,
  isSaving,
  onDelete,
  onVote,
}: {
  items: Array<RoadmapTimelineCheckpoint<RoadmapItem>>;
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
          ? 'Loading planned service upgrades...'
          : 'Planned service upgrades will appear here as they are published. For now, add or vote on a focused improvement above.'}
      </div>
    );
  }

  const width = Math.max(980, items.length * 245);
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
      <div className="relative min-h-[30rem]" style={{ width }}>
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
          {items.map((checkpoint, index) => (
            <div key={checkpoint.item.id} className={index % 2 === 0 ? 'pt-12' : 'pt-0'}>
              <TimelineNodeCard
                item={checkpoint.item}
                index={index}
                cumulativeMonthlyCostCents={checkpoint.cumulativeMonthlyCostCents}
                requiredRoadmapIncomeCents={checkpoint.requiredRoadmapIncomeCents}
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

export function FinancialMetric({
  label,
  value,
  detail,
  icon,
  emphasis = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className={`border p-3 ${
      emphasis
        ? 'border-[#d8b365] bg-[#211609] shadow-[inset_0_0_0_1px_rgba(255,224,157,0.07)]'
        : 'border-[#5f4526] bg-[#0c0b09]'
    }`}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#a98a55]">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-serif text-2xl leading-none text-[#fff1c7]">{value}</div>
      <p className="mt-2 text-xs leading-5 text-[#c7b288]">{detail}</p>
    </div>
  );
}
