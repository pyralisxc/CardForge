import { clerkClient } from '@clerk/nextjs/server';

import { mapOwnerAccountSummary, resolveAccountEntitlement } from '@/features/account/server';
import { resolveOwnerAccess } from '@/domain/entitlements';
import {
  fetchDeveloperProfileRowsForOwner,
  type DeveloperProfileRow,
} from '@/features/developer-access/server';
import type {
  OwnerPeoplePage,
  OwnerPerson,
} from '@/features/owner/model/ownerConsoleClient';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

type SubmissionRow = { developer_id: string; status: string };

const DATABASE_PAGE_SIZE = 1_000;

const profileName = (profile: DeveloperProfileRow): string => (
  [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
  || profile.email
  || profile.clerk_user_id
);

const normalizeProfileStatus = (value: DeveloperProfileRow['status']): NonNullable<OwnerPerson['profileStatus']> => (
  value === 'active' || value === 'invited' || value === 'suspended' ? value : 'inactive'
);

const readSubmissions = async (): Promise<SubmissionRow[]> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error('CardForge people storage is not configured.');
  const rows: SubmissionRow[] = [];
  for (let from = 0; ; from += DATABASE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('cardforge_developer_asset_submissions')
      .select('developer_id,status')
      .range(from, from + DATABASE_PAGE_SIZE - 1);
    if (error) {
      console.error('Failed to load contributor counts for owner people:', error);
      throw new Error('Unable to load contributor counts.');
    }
    const page = (data ?? []) as SubmissionRow[];
    rows.push(...page);
    if (page.length < DATABASE_PAGE_SIZE) return rows;
  }
};

const loadClerkUsers = async () => {
  const client = await clerkClient();
  const users = [];
  let offset = 0;
  let totalCount = 0;
  do {
    const page = await client.users.getUserList({ limit: 100, offset });
    users.push(...page.data);
    totalCount = page.totalCount;
    if (page.data.length === 0) break;
    offset += page.data.length;
  } while (offset < totalCount);
  return users;
};

const getSubmissionCounts = (rows: SubmissionRow[]) => ({
  total: rows.length,
  published: rows.filter((row) => row.status === 'published').length,
  inReview: rows.filter((row) => row.status !== 'published' && row.status !== 'rejected').length,
});

const needsAttention = (person: OwnerPerson): boolean => (
  person.identityState === 'history_only'
  || (person.access === 'dev' && person.profileStatus === null)
  || (person.profileStatus === 'active' && person.access !== 'dev' && !person.isOwner)
);

export const getOwnerPeople = async ({
  query = '',
  filter = 'all',
  page = 1,
  pageSize = 12,
}: {
  query?: string;
  filter?: 'all' | 'developers' | 'active' | 'needs_attention';
  page?: number;
  pageSize?: number;
} = {}): Promise<OwnerPeoplePage> => {
  const [users, profiles, submissions] = await Promise.all([
    loadClerkUsers(),
    fetchDeveloperProfileRowsForOwner(),
    readSubmissions(),
  ]);
  const profilesById = new Map(profiles.map((profile) => [profile.clerk_user_id, profile]));
  const submissionsByDeveloper = new Map<string, SubmissionRow[]>();
  submissions.forEach((submission) => submissionsByDeveloper.set(
    submission.developer_id,
    [...(submissionsByDeveloper.get(submission.developer_id) ?? []), submission],
  ));

  const people: OwnerPerson[] = users.map((user) => {
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
    const profile = profilesById.get(user.id);
    if (profile) profilesById.delete(user.id);
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
      canProposeSiteContent: Boolean(profile?.can_propose_site_content),
      monthlySubmissionLimitOverride: profile?.monthly_submission_limit_override ?? null,
      monthlyPublishedRequirementOverride: profile?.monthly_published_requirement_override ?? null,
      developerNote: profile?.owner_note ?? '',
      submissions: getSubmissionCounts(submissionsByDeveloper.get(user.id) ?? []),
    };
  });

  profilesById.forEach((profile) => people.push({
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
    canProposeSiteContent: Boolean(profile.can_propose_site_content),
    monthlySubmissionLimitOverride: profile.monthly_submission_limit_override ?? null,
    monthlyPublishedRequirementOverride: profile.monthly_published_requirement_override ?? null,
    developerNote: profile.owner_note ?? '',
    submissions: getSubmissionCounts(submissionsByDeveloper.get(profile.clerk_user_id) ?? []),
  }));

  const summary = {
    accounts: users.length,
    activeDevelopers: people.filter((person) => person.profileStatus === 'active' && (person.access === 'dev' || person.isOwner)).length,
    historyOnly: people.filter((person) => person.identityState === 'history_only').length,
    needsAttention: people.filter(needsAttention).length,
  };
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = people.filter((person) => {
    if (normalizedQuery && ![person.name, person.email, person.id].some((value) => value?.toLowerCase().includes(normalizedQuery))) return false;
    if (filter === 'developers' && person.profileStatus === null && person.access !== 'dev' && !person.isOwner) return false;
    if (filter === 'active' && person.profileStatus !== 'active') return false;
    if (filter === 'needs_attention' && !needsAttention(person)) return false;
    return true;
  }).sort((left, right) => {
    const attention = Number(needsAttention(right)) - Number(needsAttention(left));
    if (attention) return attention;
    return left.name.localeCompare(right.name);
  });
  const safePageSize = Math.min(50, Math.max(5, Math.trunc(pageSize)));
  const totalPages = Math.max(1, Math.ceil(filtered.length / safePageSize));
  const safePage = Math.min(totalPages, Math.max(1, Math.trunc(page)));
  const start = (safePage - 1) * safePageSize;
  return {
    items: filtered.slice(start, start + safePageSize),
    total: filtered.length,
    page: safePage,
    pageSize: safePageSize,
    summary,
  };
};
