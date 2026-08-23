import {
  DEVELOPER_PROFILE_STATUSES,
  type DeveloperAccessProfile,
  type DeveloperProfileStatus,
} from '@/features/developer-access/model';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

export interface DeveloperProfileRow {
  clerk_user_id: string;
  email: string | null;
  status?: DeveloperProfileStatus | null;
  first_name?: string | null;
  last_name?: string | null;
  monthly_submission_limit_override?: number | null;
  monthly_published_requirement_override?: number | null;
  owner_note?: string | null;
  can_draft_campaigns?: boolean | null;
  can_propose_site_content?: boolean | null;
}

export interface DeveloperProfileIdentity {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface DeveloperProfileReference {
  developerId: string;
  email: string | null;
}

export interface DeveloperProfileCapabilities {
  status: DeveloperProfileStatus;
  canDraftCampaigns: boolean;
  canProposeSiteContent: boolean;
}

export class DeveloperAccessStoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

const PROFILE_COLUMNS =
  'clerk_user_id,email,status,first_name,last_name,monthly_submission_limit_override,monthly_published_requirement_override,owner_note,can_draft_campaigns,can_propose_site_content';
const normalizeShortText = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ').slice(0, maxLength) : '';

const normalizeStatus = (value: unknown): DeveloperProfileStatus =>
  typeof value === 'string' && DEVELOPER_PROFILE_STATUSES.includes(value as DeveloperProfileStatus)
    ? value as DeveloperProfileStatus
    : 'inactive';

const readProfileRows = async (): Promise<DeveloperProfileRow[]> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('cardforge_developer_profiles')
    .select(PROFILE_COLUMNS);
  if (!error) return (data ?? []) as DeveloperProfileRow[];
  console.error('Failed to load developer profiles:', error);
  throw new DeveloperAccessStoreError('Developer profiles are temporarily unavailable.', 503);
};

export const fetchDeveloperProfileRows = readProfileRows;

export const fetchDeveloperProfileRowsForOwner = async (): Promise<DeveloperProfileRow[]> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAccessStoreError('Developer profile storage is not configured.', 503);
  const rows: DeveloperProfileRow[] = [];
  const pageSize = 1_000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('cardforge_developer_profiles')
      .select(PROFILE_COLUMNS)
      .range(from, from + pageSize - 1);
    if (error) {
      console.error('Failed to load developer profiles for owner people:', error);
      throw new DeveloperAccessStoreError('Unable to load developer profiles.');
    }
    const page = (data ?? []) as unknown as DeveloperProfileRow[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
};

export const countActiveDevelopers = async (): Promise<number> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return 1;

  const { count, error } = await supabase
    .from('cardforge_developer_profiles')
    .select('clerk_user_id', { count: 'exact', head: true })
    .eq('status', 'active');
  if (error) {
    console.error('Failed to count active developers:', error);
    throw new DeveloperAccessStoreError('Developer roster capacity is temporarily unavailable.', 503);
  }
  return Math.max(1, count ?? 0);
};

export const getDeveloperProfileIdentity = async (
  developerId: string,
): Promise<DeveloperProfileIdentity | null> => {
  const supabase = getSupabaseServerClient();
  if (!supabase || !developerId) return null;

  const { data, error } = await supabase
    .from('cardforge_developer_profiles')
    .select('email,first_name,last_name')
    .eq('clerk_user_id', developerId)
    .limit(1);
  if (error) {
    console.error('Failed to load developer identity profile:', error);
    return null;
  }
  const row = data?.[0] as DeveloperProfileRow | undefined;
  return row
    ? {
      email: row.email,
      firstName: row.first_name ?? null,
      lastName: row.last_name ?? null,
    }
    : null;
};

export const getUniqueActiveDeveloperProfileReferenceByEmail = async (
  email: string,
): Promise<DeveloperProfileReference | null> => {
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
    throw new DeveloperAccessStoreError('Unable to verify the active Pipeline owner profile.', 503);
  }
  const rows = (data ?? []) as DeveloperProfileRow[];
  if (rows.length !== 1) return null;
  const [row] = rows;
  return row
    ? { developerId: row.clerk_user_id, email: row.email }
    : null;
};

export const getDeveloperProfileCapabilities = async (
  developerId: string,
): Promise<DeveloperProfileCapabilities> => {
  const supabase = getSupabaseServerClient();
  const failClosed: DeveloperProfileCapabilities = {
    status: 'inactive',
    canDraftCampaigns: false,
    canProposeSiteContent: false,
  };
  if (!developerId) return failClosed;
  if (!supabase) {
    throw new DeveloperAccessStoreError('Developer access storage is not configured.', 503);
  }

  const { data, error } = await supabase
    .from('cardforge_developer_profiles')
    .select('status,can_draft_campaigns,can_propose_site_content')
    .eq('clerk_user_id', developerId)
    .limit(1);
  if (error) {
    console.error('Failed to read developer contribution capabilities:', error);
    throw new DeveloperAccessStoreError('Developer access could not be verified.', 503);
  }
  const row = data?.[0] as DeveloperProfileRow | undefined;
  return {
    status: normalizeStatus(row?.status),
    canDraftCampaigns: Boolean(row?.can_draft_campaigns),
    canProposeSiteContent: Boolean(row?.can_propose_site_content),
  };
};

export const listDeveloperAccessProfiles = async (
  isOwner: boolean,
): Promise<DeveloperAccessProfile[]> => {
  if (!isOwner) return [];
  const rows = await readProfileRows();
  return rows.map((row) => {
    const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    return {
      developerId: row.clerk_user_id,
      email: row.email,
      displayName: name || row.email,
      status: normalizeStatus(row.status),
      canDraftCampaigns: Boolean(row.can_draft_campaigns),
      canProposeSiteContent: Boolean(row.can_propose_site_content),
    };
  });
};

export const upsertDeveloperProfile = async ({
  developerId,
  email,
  firstName,
  lastName,
}: {
  developerId: string;
  email: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!supabase || !developerId) return;

  const { error } = await supabase
    .from('cardforge_developer_profiles')
    .upsert({
      clerk_user_id: developerId,
      email,
      first_name: normalizeShortText(firstName, 80) || null,
      last_name: normalizeShortText(lastName, 80) || null,
    }, { onConflict: 'clerk_user_id' });
  if (error) {
    console.error('Failed to upsert developer profile:', error);
  }
};

export const updateDeveloperContributionScopes = async ({
  developerId,
  canDraftCampaigns,
  canProposeSiteContent,
}: {
  developerId: unknown;
  canDraftCampaigns: unknown;
  canProposeSiteContent: unknown;
}): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAccessStoreError('Developer access database is not configured yet.', 503);
  const normalizedId = normalizeShortText(developerId, 160);
  if (!normalizedId) throw new DeveloperAccessStoreError('Choose a developer profile.', 400);

  const { data, error } = await supabase
    .from('cardforge_developer_profiles')
    .update({
      can_draft_campaigns: canDraftCampaigns === true,
      can_propose_site_content: canProposeSiteContent === true,
    })
    .eq('clerk_user_id', normalizedId)
    .select('clerk_user_id')
    .limit(1);
  if (error) throw new DeveloperAccessStoreError('Unable to update developer contribution scopes.');
  if (!data?.[0]) throw new DeveloperAccessStoreError('Developer profile not found.', 404);
};

export const updateDeveloperAssetProfileRules = async ({
  developerId,
  rules,
}: {
  developerId: string;
  rules: {
    status?: DeveloperProfileStatus;
    monthly_submission_limit_override: number | null;
    monthly_published_requirement_override: number | null;
    owner_note: string;
  };
}): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAccessStoreError('Developer access database is not configured yet.', 503);
  const normalizedId = normalizeShortText(developerId, 160);
  if (!normalizedId) throw new DeveloperAccessStoreError('Choose a developer profile to update.', 400);

  const { error } = await supabase
    .from('cardforge_developer_profiles')
    .update(rules)
    .eq('clerk_user_id', normalizedId);
  if (error) {
    console.error('Failed to update developer profile rules:', error);
    throw new DeveloperAccessStoreError('Unable to update developer profile rules.');
  }
};

export const updateDeveloperProfileControl = async ({
  developerId,
  status,
  canDraftCampaigns,
  canProposeSiteContent,
  monthlySubmissionLimitOverride,
  monthlyPublishedRequirementOverride,
  ownerNote,
}: {
  developerId: string;
  status: DeveloperProfileStatus;
  canDraftCampaigns: boolean;
  canProposeSiteContent: boolean;
  monthlySubmissionLimitOverride: number | null;
  monthlyPublishedRequirementOverride: number | null;
  ownerNote: string;
}): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new DeveloperAccessStoreError('Developer access database is not configured yet.', 503);
  const normalizedId = normalizeShortText(developerId, 160);
  if (!normalizedId) throw new DeveloperAccessStoreError('Choose a developer profile.', 400);
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
    console.error('Failed to update consolidated developer control:', error);
    throw new DeveloperAccessStoreError('Unable to update developer controls.');
  }
  if (!data?.[0]) throw new DeveloperAccessStoreError('Developer profile not found.', 404);
};
