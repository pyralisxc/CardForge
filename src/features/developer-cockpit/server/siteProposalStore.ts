import { getSiteContentBlocks } from '@/features/public-site/server';
import {
  normalizeSiteProposalInput,
  type SiteContentProposal,
} from '@/features/developer-cockpit/model';
import type { DeveloperCockpitAccess } from '@/features/developer-cockpit/server/access';
import {
  cleanReviewNote,
  DeveloperCockpitStoreError,
  mapProposalRow,
  normalizeExpectedVersion,
  PROPOSAL_COLUMNS,
  readFirstDatabaseRow,
  requireCockpitDatabase,
  throwCockpitDatabaseError,
  type SiteProposalRow,
} from './storeShared';

const getSiteProposal = async (proposalId: string): Promise<SiteContentProposal> => {
  const supabase = requireCockpitDatabase();
  const { data, error } = await supabase
    .from('cardforge_site_content_proposals')
    .select(PROPOSAL_COLUMNS)
    .eq('id', proposalId)
    .limit(1);
  if (error) throwCockpitDatabaseError('Unable to load the site-copy proposal.', error);
  const row = readFirstDatabaseRow<SiteProposalRow>(data);
  if (!row) throw new DeveloperCockpitStoreError('Site-copy proposal not found.', 404);
  return mapProposalRow(row);
};

const requireProposalOwnership = (
  proposal: SiteContentProposal,
  access: DeveloperCockpitAccess,
) => {
  if (!access.isOwner && proposal.contributorId !== access.user.id) {
    throw new DeveloperCockpitStoreError('You can only change your own site-copy proposals.', 403);
  }
};

export const createSiteContentProposal = async (
  access: DeveloperCockpitAccess,
  input: Parameters<typeof normalizeSiteProposalInput>[0],
): Promise<SiteContentProposal> => {
  const supabase = requireCockpitDatabase();
  const normalized = normalizeSiteProposalInput(input);
  if (!normalized.ok) throw new DeveloperCockpitStoreError(normalized.message, 400);
  const blocks = await getSiteContentBlocks();
  const current = blocks.find((block) => block.slug === normalized.value.slug);
  if (!current) throw new DeveloperCockpitStoreError('Public-site copy block not found.', 404);
  if (normalized.value.proposedBody === current.body) {
    throw new DeveloperCockpitStoreError('Proposed copy must differ from the current live copy.', 400);
  }
  const { data, error } = await supabase
    .from('cardforge_site_content_proposals')
    .insert({
      contributor_id: access.user.id,
      contributor_email: access.email,
      contributor_name: access.displayName,
      slug: normalized.value.slug,
      base_body: current.body,
      proposed_body: normalized.value.proposedBody,
      rationale: normalized.value.rationale,
      status: 'draft',
    })
    .select(PROPOSAL_COLUMNS)
    .limit(1);
  if (error) throwCockpitDatabaseError('Unable to create the site-copy proposal.', error);
  const row = readFirstDatabaseRow<SiteProposalRow>(data);
  if (!row) {
    throw new DeveloperCockpitStoreError(
      'Site-copy proposal creation did not return a resource.',
    );
  }
  return mapProposalRow(row);
};

export const saveSiteContentProposal = async ({
  access,
  proposalId,
  expectedVersion,
  input,
}: {
  access: DeveloperCockpitAccess;
  proposalId: string;
  expectedVersion: unknown;
  input: Parameters<typeof normalizeSiteProposalInput>[0];
}): Promise<SiteContentProposal> => {
  const supabase = requireCockpitDatabase();
  const proposal = await getSiteProposal(proposalId);
  requireProposalOwnership(proposal, access);
  if (proposal.status !== 'draft' && proposal.status !== 'changes_requested') {
    throw new DeveloperCockpitStoreError('Only draft or changes-requested proposals can be edited.', 409);
  }
  const normalized = normalizeSiteProposalInput(input);
  if (!normalized.ok) throw new DeveloperCockpitStoreError(normalized.message, 400);
  if (normalized.value.slug !== proposal.slug) {
    throw new DeveloperCockpitStoreError('Create a new proposal to target a different site-copy block.', 409);
  }
  if (normalized.value.proposedBody === proposal.baseBody) {
    throw new DeveloperCockpitStoreError('Proposed copy must differ from the captured live copy.', 400);
  }
  const version = normalizeExpectedVersion(expectedVersion);
  const { data, error } = await supabase
    .from('cardforge_site_content_proposals')
    .update({
      proposed_body: normalized.value.proposedBody,
      rationale: normalized.value.rationale,
      status: proposal.status === 'changes_requested' ? 'draft' : proposal.status,
      version: version + 1,
    })
    .eq('id', proposal.id)
    .eq('version', version)
    .select(PROPOSAL_COLUMNS)
    .limit(1);
  if (error) throwCockpitDatabaseError('Unable to save the site-copy proposal.', error);
  const row = readFirstDatabaseRow<SiteProposalRow>(data);
  if (!row) throw new DeveloperCockpitStoreError('This proposal changed elsewhere. Reload before saving.', 409);
  return mapProposalRow(row);
};

export const transitionSiteContentProposal = async ({
  access,
  proposalId,
  expectedVersion,
  to,
  reviewNote,
}: {
  access: DeveloperCockpitAccess;
  proposalId: string;
  expectedVersion: unknown;
  to: 'submitted' | 'changes_requested' | 'rejected' | 'cancelled';
  reviewNote?: unknown;
}): Promise<SiteContentProposal> => {
  const supabase = requireCockpitDatabase();
  const proposal = await getSiteProposal(proposalId);
  requireProposalOwnership(proposal, access);
  const contributorAllowed = (
    (to === 'submitted' && (proposal.status === 'draft' || proposal.status === 'changes_requested'))
    || (to === 'cancelled' && ['draft', 'changes_requested', 'submitted'].includes(proposal.status))
  );
  const ownerAllowed = access.isOwner && (
    (to === 'changes_requested' || to === 'rejected') && proposal.status === 'submitted'
  );
  if (!contributorAllowed && !ownerAllowed) {
    throw new DeveloperCockpitStoreError(`A ${proposal.status} proposal cannot move to ${to}.`, 409);
  }
  const version = normalizeExpectedVersion(expectedVersion);
  const { data, error } = await supabase
    .from('cardforge_site_content_proposals')
    .update({
      status: to,
      version: version + 1,
      ...(to === 'submitted' ? { submitted_at: new Date().toISOString(), review_note: '' } : {}),
      ...(to !== 'submitted'
        ? { review_note: cleanReviewNote(reviewNote), reviewed_by: access.isOwner ? access.user.id : null }
        : {}),
    })
    .eq('id', proposal.id)
    .eq('version', version)
    .select(PROPOSAL_COLUMNS)
    .limit(1);
  if (error) throwCockpitDatabaseError('Unable to update the site-copy proposal workflow.', error);
  const row = readFirstDatabaseRow<SiteProposalRow>(data);
  if (!row) throw new DeveloperCockpitStoreError('This proposal changed elsewhere. Reload before reviewing.', 409);
  return mapProposalRow(row);
};

export const publishSiteContentProposal = async (
  access: DeveloperCockpitAccess,
  proposalId: string,
  expectedVersion: unknown,
  reviewNote: unknown,
): Promise<void> => {
  if (!access.isOwner) throw new DeveloperCockpitStoreError('Owner publishing access is required.', 403);
  const supabase = requireCockpitDatabase();
  const proposal = await getSiteProposal(proposalId);
  if (proposal.status !== 'submitted') {
    throw new DeveloperCockpitStoreError('Only a submitted site-copy proposal can be published.', 409);
  }
  const version = normalizeExpectedVersion(expectedVersion);
  const { error } = await supabase.rpc('cardforge_publish_site_content_proposal', {
    proposal_id: proposal.id,
    expected_version: version,
    reviewer_id: access.user.id,
    owner_review_note: cleanReviewNote(reviewNote),
  });
  if (error) {
    const message = error.message?.toLowerCase() ?? '';
    if (message.includes('changed') || message.includes('current site copy')) {
      throw new DeveloperCockpitStoreError('The proposal or live site copy changed. Reload and update the proposal from the latest live copy before publishing.', 409);
    }
    throwCockpitDatabaseError('Unable to publish the site-copy proposal.', error);
  }
};
