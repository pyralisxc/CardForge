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
}

export class ContributorAccessStoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

const PROFILE_COLUMNS =
  'clerk_user_id,email,status,first_name,last_name,monthly_submission_limit_override,monthly_published_requirement_override,owner_note,can_draft_campaigns';
const normalizeShortText = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ').slice(0, maxLength) : '';

const normalizeStatus = (value: unknown): ContributorProfileStatus =>
  typeof value === 'string' && CONTRIBUTOR_PROFILE_STATUSES.includes(value as ContributorProfileStatus)
    ? value as ContributorProfileStatus
    : 'inactive';

export const fetchContributorProfileRow = async (
  contributorId: string,
): Promise<ContributorProfileRow | null> => {
  const supabase = getSupabaseServerClient();
  if (!contributorId) return null;
  if (!supabase) throw new ContributorAccessStoreError('Contributor profile storage is not configured.', 503);

  const { data, error } = await supabase
    .from('cardforge_contributor_profiles')
    .select(PROFILE_COLUMNS)
    .eq('clerk_user_id', contributorId)
    .limit(1);
  if (error) {
    console.error('Failed to load Contributor profile:', error);
    throw new ContributorAccessStoreError('Contributor profile is temporarily unavailable.', 503);
  }
  return (data?.[0] as ContributorProfileRow | undefined) ?? null;
};

const readProfileRows = async (): Promise<ContributorProfileRow[]> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new ContributorAccessStoreError('Contributor profile storage is not configured.', 503);
  const rows: ContributorProfileRow[] = [];
  const pageSize = 1_000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('cardforge_contributor_profiles')
      .select(PROFILE_COLUMNS)
      .order('clerk_user_id')
      .range(from, from + pageSize - 1);
    if (error) {
      console.error('Failed to load Contributor profiles for owner people:', error);
      throw new ContributorAccessStoreError('Contributor profiles are temporarily unavailable.', 503);
    }
    const page = (data ?? []) as unknown as ContributorProfileRow[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
};

export const fetchContributorProfileRows = readProfileRows;
export const fetchContributorProfileRowsForOwner = readProfileRows;

export const countActiveContributors = async (): Promise<number> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new ContributorAccessStoreError('Contributor roster capacity is unavailable.', 503);

  const { count, error } = await supabase
    .from('cardforge_contributor_profiles')
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
  if (!contributorId) return null;
  if (!supabase) throw new ContributorAccessStoreError('Contributor profile storage is not configured.', 503);

  const { data, error } = await supabase
    .from('cardforge_contributor_profiles')
    .select('email,first_name,last_name')
    .eq('clerk_user_id', contributorId)
    .limit(1);
  if (error) {
    console.error('Failed to load Contributor identity profile:', error);
    throw new ContributorAccessStoreError('Contributor identity is temporarily unavailable.', 503);
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
  if (!normalizedEmail) return null;
  if (!supabase) throw new ContributorAccessStoreError('Contributor profile storage is not configured.', 503);

  const { data, error } = await supabase
    .from('cardforge_contributor_profiles')
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
  };
  if (!contributorId) return failClosed;
  if (!supabase) {
    throw new ContributorAccessStoreError('Contributor access storage is not configured.', 503);
  }

  const { data, error } = await supabase
    .from('cardforge_contributor_profiles')
    .select('status,can_draft_campaigns')
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
  if (!contributorId) throw new ContributorAccessStoreError('A Contributor identity is required.', 400);
  if (!supabase) throw new ContributorAccessStoreError('Contributor profile storage is not configured.', 503);

  const { error } = await supabase
    .from('cardforge_contributor_profiles')
    .upsert({
      clerk_user_id: contributorId,
      email,
      first_name: normalizeShortText(firstName, 80) || null,
      last_name: normalizeShortText(lastName, 80) || null,
    }, { onConflict: 'clerk_user_id' });
  if (error) {
    console.error('Failed to upsert Contributor profile:', error);
    throw new ContributorAccessStoreError('Contributor identity could not be saved.', 503);
  }
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
    .from('cardforge_contributor_profiles')
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
  monthlySubmissionLimitOverride,
  monthlyPublishedRequirementOverride,
  ownerNote,
}: {
  contributorId: string;
  status: ContributorProfileStatus;
  canDraftCampaigns: boolean;
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
    .from('cardforge_contributor_profiles')
    .update({
      status,
      can_draft_campaigns: status === 'active' && canDraftCampaigns,
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
