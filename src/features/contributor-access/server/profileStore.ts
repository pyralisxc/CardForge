import {
  CONTRIBUTOR_PROFILE_STATUSES,
  type ContributorAccessProfile,
  type ContributorProfileStatus,
} from '@/features/contributor-access/model';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

export interface ContributorProfileRow {
  clerk_user_id: string;
  email: string | null;
  status?: ContributorProfileStatus | null;
  first_name?: string | null;
  last_name?: string | null;
  monthly_submission_limit_override?: number | null;
  monthly_published_requirement_override?: number | null;
  owner_note?: string | null;
  can_draft_campaigns?: boolean | null;
  can_propose_site_content?: boolean | null;
}

export interface ContributorProfileIdentity {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface ContributorProfileReference {
  contributorId: string;
  email: string | null;
}

export interface ContributorProfileCapabilities {
  status: ContributorProfileStatus;
  canDraftCampaigns: boolean;
  canProposeSiteContent: boolean;
}

export class ContributorAccessStoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

const PROFILE_COLUMNS =
  'clerk_user_id,email,status,first_name,last_name,monthly_submission_limit_override,monthly_published_requirement_override,owner_note,can_draft_campaigns,can_propose_site_content';
const normalizeShortText = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ').slice(0, maxLength) : '';

const normalizeStatus = (value: unknown): ContributorProfileStatus =>
  typeof value === 'string' && CONTRIBUTOR_PROFILE_STATUSES.includes(value as ContributorProfileStatus)
    ? value as ContributorProfileStatus
    : 'inactive';

const readProfileRows = async (): Promise<ContributorProfileRow[]> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('cardforge_developer_profiles')
    .select(PROFILE_COLUMNS);
  if (!error) return (data ?? []) as ContributorProfileRow[];
  console.error('Failed to load Contributor profiles:', error);
  throw new ContributorAccessStoreError('Contributor profiles are temporarily unavailable.', 503);
};

export const fetchContributorProfileRows = readProfileRows;

export const fetchContributorProfileRow = async (
  contributorId: string,
): Promise<ContributorProfileRow | null> => {
  const supabase = getSupabaseServerClient();
  if (!supabase || !contributorId) return null;

  const { data, error } = await supabase
    .from('cardforge_developer_profiles')
    .select(PROFILE_COLUMNS)
    .eq('clerk_user_id', contributorId)
    .limit(1);
  if (error) {
    console.error('Failed to load Contributor profile:', error);
    throw new ContributorAccessStoreError('Contributor profile is temporarily unavailable.', 503);
  }
  return (data?.[0] as ContributorProfileRow | undefined) ?? null;
};

export const fetchContributorProfileRowsForOwner = async (): Promise<ContributorProfileRow[]> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new ContributorAccessStoreError('Contributor profile storage is not configured.', 503);
  const rows: ContributorProfileRow[] = [];
  const pageSize = 1_000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('cardforge_developer_profiles')
      .select(PROFILE_COLUMNS)
      .range(from, from + pageSize - 1);
    if (error) {
      console.error('Failed to load Contributor profiles for owner people:', error);
      throw new ContributorAccessStoreError('Unable to load Contributor profiles.');
    }
    const page = (data ?? []) as unknown as ContributorProfileRow[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
};

export const countActiveContributors = async (): Promise<number> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return 1;

  const { count, error } = await supabase
    .from('cardforge_developer_profiles')
    .select('clerk_user_id', { count: 'exact', head: true })
    .eq('status', 'active');
  if (error) {
    console.error('Failed to count active Contributors:', error);
    throw new ContributorAccessStoreError('Contributor roster capacity is temporarily unavailable.', 503);
  }
  return Math.max(1, count ?? 0);
};

export const getContributorProfileIdentity = async (
  contributorId: string,
): Promise<ContributorProfileIdentity | null> => {
  const supabase = getSupabaseServerClient();
  if (!supabase || !contributorId) return null;

  const { data, error } = await supabase
    .from('cardforge_developer_profiles')
    .select('email,first_name,last_name')
    .eq('clerk_user_id', contributorId)
    .limit(1);
  if (error) {
    console.error('Failed to load Contributor identity profile:', error);
    return null;
  }
  const row = data?.[0] as ContributorProfileRow | undefined;
  return row
    ? {
      email: row.email,
      firstName: row.first_name ?? null,
      lastName: row.last_name ?? null,
    }
    : null;
};

export const getUniqueActiveContributorProfileReferenceByEmail = async (
  email: string,
): Promise<ContributorProfileReference | null> => {
  const supabase = getSupabaseServerClient();
  const normalizedEmail = normalizeShortText(email, 320);
  if (!supabase || !normalizedEmail) return null;

  const { data, error } = await supabase
    .from('cardforge_developer_profiles')
    .select('clerk_user_id,email')
    .eq('email', normalizedEmail)
    .eq('status', 'active')
    .limit(2);
  if (error) {
    throw new ContributorAccessStoreError('Unable to verify the active Pipeline owner profile.', 503);
  }
  const rows = (data ?? []) as ContributorProfileRow[];
  if (rows.length !== 1) return null;
  const [row] = rows;
  return row
    ? { contributorId: row.clerk_user_id, email: row.email }
    : null;
};

export const getContributorProfileCapabilities = async (
  contributorId: string,
): Promise<ContributorProfileCapabilities> => {
  const supabase = getSupabaseServerClient();
  const failClosed: ContributorProfileCapabilities = {
    status: 'inactive',
    canDraftCampaigns: false,
    canProposeSiteContent: false,
  };
  if (!contributorId) return failClosed;
  if (!supabase) {
    throw new ContributorAccessStoreError('Contributor access storage is not configured.', 503);
  }

  const { data, error } = await supabase
    .from('cardforge_developer_profiles')
    .select('status,can_draft_campaigns,can_propose_site_content')
    .eq('clerk_user_id', contributorId)
    .limit(1);
  if (error) {
    console.error('Failed to read Contributor capabilities:', error);
    throw new ContributorAccessStoreError('Contributor access could not be verified.', 503);
  }
  const row = data?.[0] as ContributorProfileRow | undefined;
  return {
    status: normalizeStatus(row?.status),
    canDraftCampaigns: Boolean(row?.can_draft_campaigns),
    canProposeSiteContent: Boolean(row?.can_propose_site_content),
  };
};

export const listContributorAccessProfiles = async (
  isOwner: boolean,
): Promise<ContributorAccessProfile[]> => {
  if (!isOwner) return [];
  const rows = await readProfileRows();
  return rows.map((row) => {
    const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    return {
      contributorId: row.clerk_user_id,
      email: row.email,
      displayName: name || row.email,
      status: normalizeStatus(row.status),
      canDraftCampaigns: Boolean(row.can_draft_campaigns),
      canProposeSiteContent: Boolean(row.can_propose_site_content),
    };
  });
};

export const upsertContributorProfile = async ({
  contributorId,
  email,
  firstName,
  lastName,
}: {
  contributorId: string;
  email: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!supabase || !contributorId) return;

  const { error } = await supabase
    .from('cardforge_developer_profiles')
    .upsert({
      clerk_user_id: contributorId,
      email,
      first_name: normalizeShortText(firstName, 80) || null,
      last_name: normalizeShortText(lastName, 80) || null,
    }, { onConflict: 'clerk_user_id' });
  if (error) {
    console.error('Failed to upsert Contributor profile:', error);
  }
};

export const updateContributorScopes = async ({
  contributorId,
  canDraftCampaigns,
  canProposeSiteContent,
}: {
  contributorId: unknown;
  canDraftCampaigns: unknown;
  canProposeSiteContent: unknown;
}): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new ContributorAccessStoreError('Contributor access database is not configured yet.', 503);
  const normalizedId = normalizeShortText(contributorId, 160);
  if (!normalizedId) throw new ContributorAccessStoreError('Choose a Contributor profile.', 400);

  const { data, error } = await supabase
    .from('cardforge_developer_profiles')
    .update({
      can_draft_campaigns: canDraftCampaigns === true,
      can_propose_site_content: canProposeSiteContent === true,
    })
    .eq('clerk_user_id', normalizedId)
    .select('clerk_user_id')
    .limit(1);
  if (error) throw new ContributorAccessStoreError('Unable to update Contributor scopes.');
  if (!data?.[0]) throw new ContributorAccessStoreError('Contributor profile not found.', 404);
};

export const updateContributorPipelineRules = async ({
  contributorId,
  rules,
}: {
  contributorId: string;
  rules: {
    status?: ContributorProfileStatus;
    monthly_submission_limit_override: number | null;
    monthly_published_requirement_override: number | null;
    owner_note: string;
  };
}): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new ContributorAccessStoreError('Contributor access database is not configured yet.', 503);
  const normalizedId = normalizeShortText(contributorId, 160);
  if (!normalizedId) throw new ContributorAccessStoreError('Choose a Contributor profile to update.', 400);

  const { error } = await supabase
    .from('cardforge_developer_profiles')
    .update(rules)
    .eq('clerk_user_id', normalizedId);
  if (error) {
    console.error('Failed to update Contributor profile rules:', error);
    throw new ContributorAccessStoreError('Unable to update Contributor profile rules.');
  }
};

export const updateContributorProfileControl = async ({
  contributorId,
  status,
  canDraftCampaigns,
  canProposeSiteContent,
  monthlySubmissionLimitOverride,
  monthlyPublishedRequirementOverride,
  ownerNote,
}: {
  contributorId: string;
  status: ContributorProfileStatus;
  canDraftCampaigns: boolean;
  canProposeSiteContent: boolean;
  monthlySubmissionLimitOverride: number | null;
  monthlyPublishedRequirementOverride: number | null;
  ownerNote: string;
}): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new ContributorAccessStoreError('Contributor access database is not configured yet.', 503);
  const normalizedId = normalizeShortText(contributorId, 160);
  if (!normalizedId) throw new ContributorAccessStoreError('Choose a Contributor profile.', 400);
  const normalizeOverride = (value: number | null, minimum: number, maximum: number): number | null => (
    value === null ? null : Math.min(maximum, Math.max(minimum, Math.trunc(value)))
  );
  const { data, error } = await supabase
    .from('cardforge_developer_profiles')
    .update({
      status,
      can_draft_campaigns: status === 'active' && canDraftCampaigns,
      can_propose_site_content: status === 'active' && canProposeSiteContent,
      monthly_submission_limit_override: normalizeOverride(monthlySubmissionLimitOverride, 1, 250),
      monthly_published_requirement_override: normalizeOverride(monthlyPublishedRequirementOverride, 0, 100),
      owner_note: normalizeShortText(ownerNote, 500),
    })
    .eq('clerk_user_id', normalizedId)
    .select('clerk_user_id')
    .limit(1);
  if (error) {
    console.error('Failed to update consolidated Contributor control:', error);
    throw new ContributorAccessStoreError('Unable to update Contributor controls.');
  }
  if (!data?.[0]) throw new ContributorAccessStoreError('Contributor profile not found.', 404);
};
