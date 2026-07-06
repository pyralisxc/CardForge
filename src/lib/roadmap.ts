import {
  DEFAULT_SITE_MECHANICS_SETTINGS,
  type SiteMechanicsSettings,
} from '@/lib/ownerConsole';

export const MAX_ROADMAP_SUGGESTION_LENGTH = 200;
export const MAX_ACTIVE_USER_ROADMAP_ITEMS = 50;
export const ROADMAP_NEGATIVE_SIGNAL_MIN_TOTAL_VOTES = 20;

export interface RoadmapVotingRules {
  negativeSignalMinTotalVotes: number;
  negativeSignalMinDownvotePercent: number;
}

export const DEFAULT_ROADMAP_VOTING_RULES: RoadmapVotingRules = {
  negativeSignalMinTotalVotes: DEFAULT_SITE_MECHANICS_SETTINGS.roadmapNegativeSignalMinTotalVotes,
  negativeSignalMinDownvotePercent: DEFAULT_SITE_MECHANICS_SETTINGS.roadmapNegativeSignalMinDownvotePercent,
};

export type RoadmapStatus =
  | 'planned'
  | 'in_progress'
  | 'testing'
  | 'shipped'
  | 'archived_negative_signal';

export type RoadmapSource = 'official' | 'user';
export type RoadmapVoteValue = 'up' | 'down';
export type RoadmapItemType = 'roi_checkpoint' | 'feature' | 'shipped_update';
export type RoadmapSortMode = 'most_votes' | 'least_votes' | 'newest' | 'oldest';

export interface RoadmapItem {
  id: string;
  title: string;
  description: string | null;
  itemType: RoadmapItemType;
  status: RoadmapStatus;
  source: RoadmapSource;
  visibleMonth: string;
  targetMrrCents: number | null;
  monthlyCostCents: number | null;
  shippedAt: string | null;
  createdAt: string;
  upVotes: number;
  downVotes: number;
  userVote: RoadmapVoteValue | null;
}

export interface RoadmapPayload {
  configured: boolean;
  items: RoadmapItem[];
  activeUserSuggestionCount: number;
  maxActiveUserSuggestions: number;
  maxSuggestionLength: number;
  currentProfitCents: number;
  developerRequestEmail: string;
}

export type RoadmapSuggestionResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

export const normalizeRoadmapSuggestion = (
  value: unknown,
  settings: Pick<SiteMechanicsSettings, 'maxRoadmapSuggestionLength'> = DEFAULT_SITE_MECHANICS_SETTINGS
): RoadmapSuggestionResult => {
  if (typeof value !== 'string') {
    return { ok: false, message: 'Feature suggestion is required.' };
  }

  const normalized = value.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return { ok: false, message: 'Feature suggestion is required.' };
  }

  if (normalized.length > settings.maxRoadmapSuggestionLength) {
    return {
      ok: false,
      message: `Feature suggestion must be ${settings.maxRoadmapSuggestionLength} characters or fewer.`,
    };
  }

  return { ok: true, value: normalized };
};

export const shouldArchiveUserRoadmapItem = ({
  source,
  upVotes,
  downVotes,
  rules = DEFAULT_ROADMAP_VOTING_RULES,
}: {
  source: RoadmapSource;
  upVotes: number;
  downVotes: number;
  rules?: RoadmapVotingRules;
}) => {
  if (source !== 'user') return false;
  const totalVotes = upVotes + downVotes;
  if (totalVotes < rules.negativeSignalMinTotalVotes) return false;
  return (downVotes / totalVotes) * 100 >= rules.negativeSignalMinDownvotePercent;
};

export const calculateMonthlyUnlockTargetCents = (monthlyCostCents: number): number =>
  Math.max(0, Math.round(monthlyCostCents * 12));

export const calculateMrrUnlockTargetCents = calculateMonthlyUnlockTargetCents;

export interface RoadmapTimelineCheckpoint<Item> {
  item: Item;
  cumulativeMonthlyCostCents: number;
  monthlyUnlockTargetCents: number;
}

export const buildRoadmapTimelineCheckpoints = <Item extends { monthlyCostCents: number | null }>(
  items: Item[]
): Array<RoadmapTimelineCheckpoint<Item>> => {
  let cumulativeMonthlyCostCents = 0;

  return items.map((item) => {
    cumulativeMonthlyCostCents += item.monthlyCostCents ?? 0;
    return {
      item,
      cumulativeMonthlyCostCents,
      monthlyUnlockTargetCents: calculateMonthlyUnlockTargetCents(cumulativeMonthlyCostCents),
    };
  });
};

const getVoteTotal = (item: Pick<RoadmapItem, 'upVotes' | 'downVotes'>) => item.upVotes + item.downVotes;

const getTimeValue = (value: string | null | undefined): number => {
  if (!value) return 0;
  const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-01T00:00:00.000Z` : value;
  const time = new Date(normalized).getTime();
  return Number.isNaN(time) ? 0 : time;
};

export const sortRoadmapFeatures = <Item extends Pick<RoadmapItem, 'createdAt' | 'upVotes' | 'downVotes'>>(
  items: Item[],
  mode: RoadmapSortMode
): Item[] => [...items].sort((left, right) => {
  if (mode === 'most_votes') return getVoteTotal(right) - getVoteTotal(left);
  if (mode === 'least_votes') return getVoteTotal(left) - getVoteTotal(right);
  if (mode === 'oldest') return getTimeValue(left.createdAt) - getTimeValue(right.createdAt);
  return getTimeValue(right.createdAt) - getTimeValue(left.createdAt);
});

export const getCurrentMonthKey = (now: Date | string = new Date()): string => {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) return getCurrentMonthKey(new Date());
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const getCurrentTimelineWindow = <Item extends { visibleMonth: string; status: RoadmapStatus }>(
  items: Item[],
  now: Date | string = new Date()
): { past: Item[]; current: Item[]; future: Item[] } => {
  const currentMonth = getCurrentMonthKey(now);
  const sortedAscending = [...items].sort((left, right) => left.visibleMonth.localeCompare(right.visibleMonth));

  return {
    past: sortedAscending
      .filter((item) => item.visibleMonth < currentMonth || item.status === 'shipped')
      .sort((left, right) => right.visibleMonth.localeCompare(left.visibleMonth)),
    current: sortedAscending.filter((item) => item.visibleMonth === currentMonth && item.status !== 'shipped'),
    future: sortedAscending.filter((item) => item.visibleMonth > currentMonth && item.status !== 'shipped'),
  };
};

const monthLabelFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const shortMonthDayFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const toTimelineDate = (item: { visibleMonth: string; createdAt?: string }): Date => {
  const created = item.createdAt ? new Date(item.createdAt) : null;
  if (created && !Number.isNaN(created.getTime())) return created;
  const fallback = new Date(`${item.visibleMonth}-01T00:00:00.000Z`);
  return Number.isNaN(fallback.getTime()) ? new Date(0) : fallback;
};

export const groupRoadmapTimelineItems = <Item extends { visibleMonth: string; createdAt?: string }>(
  items: Item[]
): Array<{ key: string; label: string; items: Item[] }> => {
  const sorted = [...items].sort((left, right) => toTimelineDate(left).getTime() - toTimelineDate(right).getTime());
  const monthCounts = sorted.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.visibleMonth] = (accumulator[item.visibleMonth] ?? 0) + 1;
    return accumulator;
  }, {});

  const groups = new Map<string, { key: string; label: string; items: Item[] }>();

  for (const item of sorted) {
    const date = toTimelineDate(item);
    const denseMonth = (monthCounts[item.visibleMonth] ?? 0) > 1;
    const monthWeekIndex = Math.floor((date.getUTCDate() - 1) / 7);
    const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), monthWeekIndex * 7 + 1));
    const key = denseMonth ? `week-${item.visibleMonth}-${monthWeekIndex}` : `month-${item.visibleMonth}`;
    const label = denseMonth
      ? `Week of ${shortMonthDayFormatter.format(weekStart)}`
      : monthLabelFormatter.format(new Date(`${item.visibleMonth}-01T00:00:00.000Z`));
    const group = groups.get(key) ?? { key, label, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }

  return Array.from(groups.values());
};

export const isChronicleTimelineItem = (item: Pick<RoadmapItem, 'source' | 'itemType'>): boolean =>
  item.source === 'official' && item.itemType !== 'feature';
