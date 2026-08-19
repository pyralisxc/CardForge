import {
  normalizeSiteContentBlockInput,
  type SiteContentBlock,
  type SiteContentBlockSlug,
} from '@/features/public-site/client';
import type { DeveloperAccessProfile, DeveloperContributionScope } from '@/features/developer-access/client';
import type { MarketingStrategy } from '@/domain/marketing';
import type { MarketingContentWorkspaceView } from '@/features/marketing-content/client';

export interface SiteContentProposal {
  id: string;
  contributorId: string;
  contributorEmail: string | null;
  contributorName: string | null;
  slug: SiteContentBlockSlug;
  baseBody: string;
  proposedBody: string;
  rationale: string;
  status: 'draft' | 'submitted' | 'changes_requested' | 'published' | 'rejected' | 'cancelled';
  reviewNote: string;
  reviewedBy: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeveloperCockpitBootstrap {
  configured: boolean;
  extendedContributionsEnabled: boolean;
  currentUserId: string;
  isDeveloper: boolean;
  isOwner: boolean;
  scopes: DeveloperContributionScope[];
  marketingStrategy: MarketingStrategy;
}

export type DeveloperCampaignWorkspaceView = MarketingContentWorkspaceView;

export interface DeveloperSiteWorkspaceView {
  currentUserId: string;
  isOwner: boolean;
  scopes: DeveloperContributionScope[];
  siteProposals: SiteContentProposal[];
  siteContentBlocks: SiteContentBlock[];
  profiles: DeveloperAccessProfile[];
}

/** Legacy combined view retained for compatibility at feature boundaries that still need every slice. */
export interface DeveloperCockpitView extends MarketingContentWorkspaceView {
  configured: boolean;
  extendedContributionsEnabled: boolean;
  isDeveloper: boolean;
  siteProposals: SiteContentProposal[];
  siteContentBlocks: SiteContentBlock[];
  profiles: DeveloperAccessProfile[];
}

export type SiteProposalInputResult =
  | { ok: true; value: { slug: SiteContentBlockSlug; proposedBody: string; rationale: string } }
  | { ok: false; message: string };

const cleanLongText = (value: unknown): string => (
  typeof value === 'string' ? value.trim().replace(/\r\n/gu, '\n') : ''
);

export const normalizeSiteProposalInput = (
  input: { slug?: unknown; proposedBody?: unknown; rationale?: unknown },
): SiteProposalInputResult => {
  const normalized = normalizeSiteContentBlockInput({ slug: input.slug, body: input.proposedBody });
  if (!normalized.ok) {
    return {
      ok: false,
      message: normalized.message === 'Unknown site copy block.'
        ? 'Choose a supported public-site copy block.'
        : normalized.message,
    };
  }
  const rationale = cleanLongText(input.rationale);
  if (!rationale) return { ok: false, message: 'Explain why this site-copy change helps.' };
  if (rationale.length > 800) return { ok: false, message: 'Proposal rationale must be 800 characters or fewer.' };
  return { ok: true, value: { slug: normalized.value.slug, proposedBody: normalized.value.body, rationale } };
};
