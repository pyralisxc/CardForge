import { clerkClient } from '@clerk/nextjs/server';

import { mapOwnerAccountSummary, resolveAccountEntitlement } from '@/features/account/server';
import { resolveOwnerAccess } from '@/domain/entitlements';
import {
  fetchContributorProfileRowsForOwner,
  type ContributorProfileRow,
} from '@/features/contributor-access/server';
import type {
  OwnerPeoplePage,
  OwnerPerson,
} from '@/features/owner/model/ownerConsoleClient';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

type ClerkBackendClient = Awaited<ReturnType<typeof clerkClient>>;
type ClerkUser = Awaited<ReturnType<ClerkBackendClient['users']['getUserList']>>['data'][number];
type SubmissionCounts = OwnerPerson['submissions'];

const CLERK_PAGE_LIMIT = 100;

const profileName = (profile: ContributorProfileRow): string => (
  [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
  || profile.email
  || profile.clerk_user_id
);

const normalizeProfileStatus = (value: ContributorProfileRow['status']): NonNullable<OwnerPerson['profileStatus']> => (
  value === 'active' || value === 'invited' || value === 'suspended' ? value : 'inactive'
);

const emptySubmissionCounts = (): SubmissionCounts => ({ total: 0, published: 0, inReview: 0 });

const readSubmissionCounts = async (contributorIds: string[]): Promise<Map<string, SubmissionCounts>> => {
  const counts = new Map<string, SubmissionCounts>();
  const uniqueIds = [...new Set(contributorIds.filter(Boolean))];
  if (uniqueIds.length === 0) return counts;
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error('CardForge people storage is not configured.');

  for (let offset = 0; offset < uniqueIds.length; offset += CLERK_PAGE_LIMIT) {
    const ids = uniqueIds.slice(offset, offset + CLERK_PAGE_LIMIT);
    const { data, error } = await supabase
      .rpc('cardforge_get_contributor_submission_counts', { p_contributor_ids: ids });
    if (error) {
      console.error('Failed to load contributor counts for owner people:', error);
      throw new Error('Unable to load contributor counts.');
    }
    ids.forEach((id) => counts.set(id, emptySubmissionCounts()));
    ((data ?? []) as Array<{
      contributor_id: string;
      total_count: number | string;
      published_count: number | string;
      in_review_count: number | string;
    }>).forEach((row) => counts.set(row.contributor_id, {
      total: Number(row.total_count) || 0,
      published: Number(row.published_count) || 0,
      inReview: Number(row.in_review_count) || 0,
    }));
  }
  return counts;
};

const loadClerkUsersByIds = async (userIds: string[]): Promise<ClerkUser[]> => {
  const client = await clerkClient();
  const users: ClerkUser[] = [];
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  for (let offset = 0; offset < uniqueIds.length; offset += CLERK_PAGE_LIMIT) {
    const page = await client.users.getUserList({
      limit: CLERK_PAGE_LIMIT,
      userId: uniqueIds.slice(offset, offset + CLERK_PAGE_LIMIT),
    });
    users.push(...page.data);
  }
  return users;
};

const needsAttention = (person: OwnerPerson): boolean => (
  person.identityState === 'history_only'
  || (person.access === 'contributor' && person.profileStatus === null)
  || (person.profileStatus === 'active' && person.access !== 'contributor' && !person.isOwner)
);

const mapPerson = (
  user: ClerkUser,
  profile: ContributorProfileRow | undefined,
  submissionCounts: Map<string, SubmissionCounts>,
): OwnerPerson => {
  const account = mapOwnerAccountSummary(user);
  const emailAddresses = user.emailAddresses.map((address) => address.emailAddress).filter(Boolean);
  const ownerAccess = resolveOwnerAccess({
    authConfigured: true,
    isSignedIn: true,
    emailAddresses,
    publicMetadata: user.publicMetadata,
    privateMetadata: user.privateMetadata,
  });
  const effectiveAccess = resolveAccountEntitlement({
    authConfigured: true,
    isSignedIn: true,
    emailAddresses,
    privateMetadata: user.privateMetadata,
    ownerAccess,
  }).accessMode;
  return {
    id: user.id,
    email: account.email,
    name: account.name || profile?.email || account.email || user.id,
    identityState: profile ? 'connected' : 'account_only',
    access: effectiveAccess,
    isOwner: ownerAccess.isOwner,
    ownerSource: ownerAccess.source,
    createdAt: account.createdAt,
    lastSignInAt: account.lastSignInAt,
    stripeCustomerId: account.stripeCustomerId,
    stripeSubscriptionId: account.stripeSubscriptionId,
    accountNote: account.note,
    profileStatus: profile ? normalizeProfileStatus(profile.status) : null,
    canDraftCampaigns: Boolean(profile?.can_draft_campaigns),
    monthlySubmissionLimitOverride: profile?.monthly_submission_limit_override ?? null,
    monthlyPublishedRequirementOverride: profile?.monthly_published_requirement_override ?? null,
    contributorNote: profile?.owner_note ?? '',
    submissions: submissionCounts.get(user.id) ?? emptySubmissionCounts(),
  };
};

const mapHistoryPerson = (
  profile: ContributorProfileRow,
  submissionCounts: Map<string, SubmissionCounts>,
): OwnerPerson => ({
  id: profile.clerk_user_id,
  email: profile.email,
  name: profileName(profile),
  identityState: 'history_only',
  access: 'free',
  isOwner: false,
  ownerSource: 'none',
  createdAt: null,
  lastSignInAt: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  accountNote: '',
  profileStatus: normalizeProfileStatus(profile.status),
  canDraftCampaigns: Boolean(profile.can_draft_campaigns),
  monthlySubmissionLimitOverride: profile.monthly_submission_limit_override ?? null,
  monthlyPublishedRequirementOverride: profile.monthly_published_requirement_override ?? null,
  contributorNote: profile.owner_note ?? '',
  submissions: submissionCounts.get(profile.clerk_user_id) ?? emptySubmissionCounts(),
});

const matchesQuery = (person: OwnerPerson, query: string): boolean => (
  !query || [person.name, person.email, person.id].some((value) => value?.toLowerCase().includes(query))
);

export const getOwnerPeople = async ({
  query = '',
  filter = 'all',
  page = 1,
  pageSize = 12,
}: {
  query?: string;
  filter?: 'all' | 'contributors' | 'active' | 'needs_attention';
  page?: number;
  pageSize?: number;
} = {}): Promise<OwnerPeoplePage> => {
  const normalizedQuery = query.trim().toLowerCase();
  const safePageSize = Math.min(50, Math.max(5, Math.trunc(pageSize)));
  const requestedPage = Math.max(1, Math.trunc(page));
  const client = await clerkClient();
  const profiles = await fetchContributorProfileRowsForOwner();
  const profileUsers = await loadClerkUsersByIds(profiles.map((profile) => profile.clerk_user_id));
  const profileUsersById = new Map(profileUsers.map((user) => [user.id, user]));
  const profilesById = new Map(profiles.map((profile) => [profile.clerk_user_id, profile]));
  const historyProfiles = profiles.filter((profile) => !profileUsersById.has(profile.clerk_user_id));
  const profileSubmissionCounts = await readSubmissionCounts(profiles.map((profile) => profile.clerk_user_id));
  const connectedProfilePeople = profileUsers.map((user) => mapPerson(user, profilesById.get(user.id), profileSubmissionCounts));
  const historyPeople = historyProfiles.map((profile) => mapHistoryPerson(profile, profileSubmissionCounts));
  const summaryPeople = [...connectedProfilePeople, ...historyPeople];
  const accountSummaryPage = await client.users.getUserList({ limit: 1 });
  const summary = {
    accounts: accountSummaryPage.totalCount,
    activeContributors: summaryPeople.filter((person) => person.profileStatus === 'active' && (person.access === 'contributor' || person.isOwner)).length,
    historyOnly: historyPeople.length,
    needsAttention: summaryPeople.filter(needsAttention).length,
  };

  if (filter === 'all') {
    const matchingHistoryPeople = historyPeople.filter((person) => matchesQuery(person, normalizedQuery));
    const accountCountPage = await client.users.getUserList({
      limit: 1,
      ...(normalizedQuery ? { query: normalizedQuery } : {}),
    });
    const total = accountCountPage.totalCount + matchingHistoryPeople.length;
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const safePage = Math.min(totalPages, requestedPage);
    const start = (safePage - 1) * safePageSize;
    const historySlice = matchingHistoryPeople.slice(start, start + safePageSize);
    const remaining = safePageSize - historySlice.length;
    const accountOffset = Math.max(0, start - matchingHistoryPeople.length);
    const accountPage = remaining > 0
      ? await client.users.getUserList({
        limit: remaining,
        offset: accountOffset,
        orderBy: '+first_name',
        ...(normalizedQuery ? { query: normalizedQuery } : {}),
      })
      : { data: [] as ClerkUser[] };
    const pageCounts = await readSubmissionCounts(accountPage.data.map((user) => user.id));
    const items = [
      ...historySlice,
      ...accountPage.data.map((user) => mapPerson(user, profilesById.get(user.id), pageCounts)),
    ];
    return { items, total, page: safePage, pageSize: safePageSize, summary };
  }

  const contributorPeople = summaryPeople
    .filter((person) => {
      if (!matchesQuery(person, normalizedQuery)) return false;
      if (filter === 'active' && person.profileStatus !== 'active') return false;
      if (filter === 'needs_attention' && !needsAttention(person)) return false;
      return true;
    })
    .sort((left, right) => Number(needsAttention(right)) - Number(needsAttention(left)) || left.name.localeCompare(right.name));
  const total = contributorPeople.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(totalPages, requestedPage);
  const start = (safePage - 1) * safePageSize;
  return {
    items: contributorPeople.slice(start, start + safePageSize),
    total,
    page: safePage,
    pageSize: safePageSize,
    summary,
  };
};
