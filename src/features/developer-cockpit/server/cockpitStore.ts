import { getSiteContentBlocks } from '@/features/public-site/server';
import type {
  DeveloperSiteWorkspaceView,
  SiteContentProposal,
} from '@/features/developer-cockpit/model';
import type { DeveloperCockpitAccess } from '@/features/developer-cockpit/server/access';
import { listDeveloperAccessProfiles } from '@/features/developer-access/server';
import { isMissingSupabaseTableError } from '@/infrastructure/database/supabaseErrors';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import {
  mapProposalRow,
  PROPOSAL_COLUMNS,
  readDatabaseRows,
  type SiteProposalRow,
} from './siteProposalRows';

const fetchSiteProposals = async (
  access: DeveloperCockpitAccess,
): Promise<{ configured: boolean; proposals: SiteContentProposal[] }> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { configured: false, proposals: [] };
  let query = supabase
    .from('cardforge_site_content_proposals')
    .select(PROPOSAL_COLUMNS)
    .order('updated_at', { ascending: false })
    .limit(access.isOwner ? 200 : 100);
  if (!access.isOwner) query = query.eq('contributor_id', access.user.id);
  const { data, error } = await query;
  if (error) {
    if (!isMissingSupabaseTableError(error)) console.error('Failed to load site proposals:', error);
    return { configured: false, proposals: [] };
  }
  return { configured: true, proposals: readDatabaseRows<SiteProposalRow>(data).map(mapProposalRow) };
};

export const getDeveloperSiteWorkspace = async (
  access: DeveloperCockpitAccess,
): Promise<DeveloperSiteWorkspaceView> => {
  const [proposalResult, siteContentBlocks, profiles] = await Promise.all([
    fetchSiteProposals(access),
    getSiteContentBlocks(),
    listDeveloperAccessProfiles(access.isOwner),
  ]);
  return {
    currentUserId: access.user.id,
    isOwner: access.isOwner,
    scopes: access.scopes,
    siteProposals: proposalResult.proposals,
    siteContentBlocks,
    profiles,
  };
};
