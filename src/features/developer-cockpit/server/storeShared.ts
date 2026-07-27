import type {
  SiteContentProposal,
  SocialCampaign,
  SocialCampaignStatus,
  SocialCampaignVariant,
  SocialPublishJob,
  SocialPublishJobStatus,
  SocialService,
} from '@/features/developer-cockpit/model';
import {
  getSupabaseServerClient,
} from '@/infrastructure/database/supabaseServer';

export class DeveloperCockpitStoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

export type CampaignRow = {
  id: string;
  contributor_id: string;
  contributor_email: string | null;
  contributor_name: string | null;
  title: string;
  objective: string;
  destination_url: string;
  source_reference: string;
  license_notes: string;
  variants: unknown;
  status: SocialCampaignStatus;
  requested_publish_at: string | null;
  review_note: string;
  reviewed_by: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type PublishJobRow = {
  id: string;
  campaign_id: string;
  provider: 'buffer';
  service: SocialService;
  provider_channel_id: string;
  provider_post_id: string | null;
  status: SocialPublishJobStatus;
  scheduled_for: string | null;
  error_message: string;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SiteProposalRow = {
  id: string;
  contributor_id: string;
  contributor_email: string | null;
  contributor_name: string | null;
  slug: SiteContentProposal['slug'];
  base_body: string;
  proposed_body: string;
  rationale: string;
  status: SiteContentProposal['status'];
  review_note: string;
  reviewed_by: string | null;
  submitted_at: string | null;
  published_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export const CAMPAIGN_COLUMNS = 'id,contributor_id,contributor_email,contributor_name,title,objective,destination_url,source_reference,license_notes,variants,status,requested_publish_at,review_note,reviewed_by,submitted_at,approved_at,version,created_at,updated_at';
export const JOB_COLUMNS = 'id,campaign_id,provider,service,provider_channel_id,provider_post_id,status,scheduled_for,error_message,last_checked_at,created_at,updated_at';
export const PROPOSAL_COLUMNS = 'id,contributor_id,contributor_email,contributor_name,slug,base_body,proposed_body,rationale,status,review_note,reviewed_by,submitted_at,published_at,version,created_at,updated_at';

export const mapCampaignRow = (row: CampaignRow): SocialCampaign => ({
  id: row.id,
  contributorId: row.contributor_id,
  contributorEmail: row.contributor_email,
  contributorName: row.contributor_name,
  title: row.title,
  objective: row.objective,
  destinationUrl: row.destination_url,
  sourceReference: row.source_reference,
  licenseNotes: row.license_notes,
  variants: Array.isArray(row.variants) ? row.variants as SocialCampaignVariant[] : [],
  status: row.status,
  requestedPublishAt: row.requested_publish_at,
  reviewNote: row.review_note,
  reviewedBy: row.reviewed_by,
  submittedAt: row.submitted_at,
  approvedAt: row.approved_at,
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapJobRow = (row: PublishJobRow): SocialPublishJob => ({
  id: row.id,
  campaignId: row.campaign_id,
  provider: row.provider,
  service: row.service,
  providerChannelId: row.provider_channel_id,
  providerPostId: row.provider_post_id,
  status: row.status,
  scheduledFor: row.scheduled_for,
  errorMessage: row.error_message,
  lastCheckedAt: row.last_checked_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapProposalRow = (row: SiteProposalRow): SiteContentProposal => ({
  id: row.id,
  contributorId: row.contributor_id,
  contributorEmail: row.contributor_email,
  contributorName: row.contributor_name,
  slug: row.slug,
  baseBody: row.base_body,
  proposedBody: row.proposed_body,
  rationale: row.rationale,
  status: row.status,
  reviewNote: row.review_note,
  reviewedBy: row.reviewed_by,
  submittedAt: row.submitted_at,
  publishedAt: row.published_at,
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const requireCockpitDatabase = () => {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new DeveloperCockpitStoreError('The contribution cockpit database is not configured yet.', 503);
  }
  return supabase;
};

export const cleanReviewNote = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\r\n/g, '\n').slice(0, 1200) : '';

export const normalizeExpectedVersion = (value: unknown): number => {
  const version = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(version) || version < 1) {
    throw new DeveloperCockpitStoreError('A valid contribution version is required.', 400);
  }
  return version;
};

export const throwCockpitDatabaseError = (message: string, error: unknown): never => {
  console.error(message, error);
  throw new DeveloperCockpitStoreError(message);
};

export const getCampaignRecord = async (campaignId: string): Promise<SocialCampaign> => {
  const supabase = requireCockpitDatabase();
  const { data, error } = await supabase
    .from('cardforge_social_campaigns')
    .select(CAMPAIGN_COLUMNS)
    .eq('id', campaignId)
    .limit(1);
  if (error) throwCockpitDatabaseError('Unable to load the campaign package.', error);
  const row = data?.[0] as CampaignRow | undefined;
  if (!row) throw new DeveloperCockpitStoreError('Campaign package not found.', 404);
  return mapCampaignRow(row);
};

export const fetchPublishJobs = async (campaignIds: string[]): Promise<SocialPublishJob[]> => {
  const supabase = getSupabaseServerClient();
  if (!supabase || campaignIds.length === 0) return [];
  const { data, error } = await supabase
    .from('cardforge_social_publish_jobs')
    .select(JOB_COLUMNS)
    .in('campaign_id', campaignIds)
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('Failed to load social publish jobs:', error);
    return [];
  }
  return (data ?? []).map((row) => mapJobRow(row as PublishJobRow));
};
