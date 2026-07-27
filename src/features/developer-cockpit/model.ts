import {
  normalizeSiteContentBlockInput,
  type SiteContentBlock,
  type SiteContentBlockSlug,
} from '@/features/public-site/client';
import type {
  DeveloperAccessProfile,
  DeveloperContributionScope,
} from '@/features/developer-access/client';
import {
  SOCIAL_SERVICES,
  SOCIAL_SERVICE_LABELS,
  type SocialPublishJobStatus,
  type SocialService,
} from '@/features/social-publishing/client';

export {
  SOCIAL_SERVICES,
  SOCIAL_SERVICE_LABELS,
  type SocialPublishJobStatus,
  type SocialService,
} from '@/features/social-publishing/client';

export type SocialCampaignStatus =
  | 'draft'
  | 'submitted'
  | 'changes_requested'
  | 'approved'
  | 'provider_draft'
  | 'scheduled'
  | 'published'
  | 'failed'
  | 'cancelled';

export interface SocialCampaignMedia {
  sourceBucket: string | null;
  sourcePath: string | null;
  publicUrl: string | null;
  alt: string;
}

export interface SocialCampaignVariant {
  service: SocialService;
  text: string;
  media: SocialCampaignMedia[];
}

export interface SocialCampaign {
  id: string;
  contributorId: string;
  contributorEmail: string | null;
  contributorName: string | null;
  title: string;
  objective: string;
  destinationUrl: string;
  sourceReference: string;
  licenseNotes: string;
  variants: SocialCampaignVariant[];
  status: SocialCampaignStatus;
  requestedPublishAt: string | null;
  reviewNote: string;
  reviewedBy: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SocialPublishJob {
  id: string;
  campaignId: string;
  provider: 'buffer';
  service: SocialService;
  providerChannelId: string;
  providerPostId: string | null;
  status: SocialPublishJobStatus;
  scheduledFor: string | null;
  errorMessage: string;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

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

export interface ProviderChannelBinding {
  service: SocialService;
  channelId: string;
}

export interface DeveloperCockpitView {
  configured: boolean;
  extendedContributionsEnabled: boolean;
  currentUserId: string;
  isDeveloper: boolean;
  isOwner: boolean;
  scopes: DeveloperContributionScope[];
  campaigns: SocialCampaign[];
  publishJobs: SocialPublishJob[];
  siteProposals: SiteContentProposal[];
  siteContentBlocks: SiteContentBlock[];
  profiles: DeveloperAccessProfile[];
  provider: {
    name: 'buffer';
    configured: boolean;
    publishingEnabled: boolean;
    organizationId: string | null;
    allowedChannelCount: number;
    missing: string[];
  };
}

export const CAMPAIGN_FIELD_LIMITS = {
  title: 120,
  objective: 600,
  destinationUrl: 2_048,
  sourceReference: 500,
  licenseNotes: 1_000,
  variantText: 5_000,
  sourceBucket: 100,
  sourcePath: 500,
  mediaAlt: 300,
} as const;

export type CampaignInputResult =
  | {
    ok: true;
    value: {
      title: string;
      objective: string;
      destinationUrl: string;
      sourceReference: string;
      licenseNotes: string;
      requestedPublishAt: string | null;
      variants: SocialCampaignVariant[];
    };
  }
  | { ok: false; message: string };

const normalizeShortText = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ') : '';

const normalizeLongText = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\r\n/g, '\n') : '';

const normalizeHttpUrl = (
  value: unknown,
  {
    allowEmpty = true,
    httpsOnly = false,
  }: { allowEmpty?: boolean; httpsOnly?: boolean } = {},
): string | null => {
  const input = typeof value === 'string' ? value.trim() : '';
  if (!input) return allowEmpty ? '' : null;
  try {
    const url = new URL(input);
    if (httpsOnly) return url.protocol === 'https:' ? url.toString() : null;
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
};

const isSafeStoragePath = (value: string): boolean =>
  Boolean(value) && !value.startsWith('/') && !value.includes('..') && value.length <= 500;

const normalizeRequestedPublishAt = (value: unknown): string | null | false => {
  const input = typeof value === 'string' ? value.trim() : '';
  if (!input) return null;
  const parsed = new Date(input);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : false;
};

export const normalizeCampaignInput = (input: {
  title?: unknown;
  objective?: unknown;
  destinationUrl?: unknown;
  sourceReference?: unknown;
  licenseNotes?: unknown;
  requestedPublishAt?: unknown;
  variants?: unknown;
}): CampaignInputResult => {
  const title = normalizeShortText(input.title);
  if (!title) return { ok: false, message: 'Campaign name is required.' };
  if (title.length > CAMPAIGN_FIELD_LIMITS.title) {
    return { ok: false, message: 'Campaign name must be 120 characters or fewer.' };
  }
  const objective = normalizeLongText(input.objective);
  if (!objective) return { ok: false, message: 'Campaign objective is required.' };
  if (objective.length > CAMPAIGN_FIELD_LIMITS.objective) {
    return { ok: false, message: 'Campaign objective must be 600 characters or fewer.' };
  }

  const destinationInput = typeof input.destinationUrl === 'string' ? input.destinationUrl.trim() : '';
  if (destinationInput.length > CAMPAIGN_FIELD_LIMITS.destinationUrl) {
    return { ok: false, message: 'Destination URL must be 2,048 characters or fewer.' };
  }
  const destinationUrl = normalizeHttpUrl(input.destinationUrl);
  if (destinationUrl === null) {
    return { ok: false, message: 'Destination URL must use HTTP or HTTPS.' };
  }
  const requestedPublishAt = normalizeRequestedPublishAt(input.requestedPublishAt);
  if (requestedPublishAt === false) {
    return { ok: false, message: 'Requested publish time is invalid.' };
  }
  if (!Array.isArray(input.variants) || input.variants.length === 0) {
    return { ok: false, message: 'Add at least one channel variant.' };
  }
  if (input.variants.length > 10) {
    return { ok: false, message: 'A campaign can target at most 10 channels.' };
  }

  const variants: SocialCampaignVariant[] = [];
  const seenServices = new Set<SocialService>();
  for (const rawVariant of input.variants) {
    if (!rawVariant || typeof rawVariant !== 'object' || Array.isArray(rawVariant)) {
      return { ok: false, message: 'Every channel variant must be a structured object.' };
    }
    const candidate = rawVariant as Record<string, unknown>;
    const service = candidate.service;
    if (typeof service !== 'string' || !SOCIAL_SERVICES.includes(service as SocialService)) {
      return { ok: false, message: 'Choose a supported social channel.' };
    }
    if (seenServices.has(service as SocialService)) {
      return { ok: false, message: 'Add only one variant per social channel.' };
    }
    seenServices.add(service as SocialService);
    const text = normalizeLongText(candidate.text);
    if (!text) return { ok: false, message: `${SOCIAL_SERVICE_LABELS[service as SocialService]} copy is required.` };
    if (text.length > CAMPAIGN_FIELD_LIMITS.variantText) {
      return { ok: false, message: `${SOCIAL_SERVICE_LABELS[service as SocialService]} copy must be 5,000 characters or fewer.` };
    }
    const rawMedia = candidate.media;
    if (rawMedia !== undefined && !Array.isArray(rawMedia)) {
      return { ok: false, message: 'Campaign media must be a list.' };
    }
    if (Array.isArray(rawMedia) && rawMedia.length > 4) {
      return { ok: false, message: 'Each channel can include at most four images.' };
    }

    const media: SocialCampaignMedia[] = [];
    for (const rawItem of Array.isArray(rawMedia) ? rawMedia : []) {
      if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
        return { ok: false, message: 'Every campaign image must be a structured object.' };
      }
      const item = rawItem as Record<string, unknown>;
      const sourceBucket = normalizeShortText(item.sourceBucket) || null;
      const sourcePath = normalizeLongText(item.sourcePath) || null;
      const publicUrl = item.publicUrl
        ? normalizeHttpUrl(item.publicUrl, { allowEmpty: false, httpsOnly: true })
        : null;
      const alt = normalizeLongText(item.alt);
      if (!alt) return { ok: false, message: 'Every campaign image needs alt text.' };
      if (sourceBucket && sourceBucket.length > CAMPAIGN_FIELD_LIMITS.sourceBucket) {
        return { ok: false, message: 'Campaign image bucket must be 100 characters or fewer.' };
      }
      if (sourcePath && sourcePath.length > CAMPAIGN_FIELD_LIMITS.sourcePath) {
        return { ok: false, message: 'Campaign image storage path must be 500 characters or fewer.' };
      }
      if (alt.length > CAMPAIGN_FIELD_LIMITS.mediaAlt) {
        return { ok: false, message: 'Campaign image alt text must be 300 characters or fewer.' };
      }
      if ((sourceBucket && !sourcePath) || (!sourceBucket && sourcePath)) {
        return { ok: false, message: 'Campaign image storage metadata is incomplete.' };
      }
      if (sourcePath && !isSafeStoragePath(sourcePath)) {
        return { ok: false, message: 'Campaign image storage path is invalid.' };
      }
      if (!sourcePath && !publicUrl) {
        return { ok: false, message: 'Campaign image source is required.' };
      }
      if (item.publicUrl && !publicUrl) {
        return { ok: false, message: 'Campaign image URL must use HTTPS.' };
      }
      media.push({ sourceBucket, sourcePath, publicUrl, alt });
    }

    variants.push({ service: service as SocialService, text, media });
  }

  const sourceReference = normalizeLongText(input.sourceReference);
  if (sourceReference.length > CAMPAIGN_FIELD_LIMITS.sourceReference) {
    return { ok: false, message: 'Source reference must be 500 characters or fewer.' };
  }
  const licenseNotes = normalizeLongText(input.licenseNotes);
  if (licenseNotes.length > CAMPAIGN_FIELD_LIMITS.licenseNotes) {
    return { ok: false, message: 'License and ownership notes must be 1,000 characters or fewer.' };
  }

  return {
    ok: true,
    value: {
      title,
      objective,
      destinationUrl,
      sourceReference,
      licenseNotes,
      requestedPublishAt,
      variants,
    },
  };
};

const contributorCampaignTransitions: Partial<Record<SocialCampaignStatus, SocialCampaignStatus[]>> = {
  draft: ['submitted', 'cancelled'],
  changes_requested: ['draft', 'submitted', 'cancelled'],
  submitted: ['cancelled'],
};

const ownerCampaignTransitions: Partial<Record<SocialCampaignStatus, SocialCampaignStatus[]>> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['changes_requested', 'approved', 'cancelled'],
  changes_requested: ['approved', 'cancelled'],
  approved: ['provider_draft', 'scheduled', 'failed', 'cancelled'],
  provider_draft: ['scheduled', 'published', 'failed', 'cancelled'],
  scheduled: ['published', 'failed', 'cancelled'],
  failed: ['approved', 'cancelled'],
};

export const canTransitionCampaign = (
  from: SocialCampaignStatus,
  to: SocialCampaignStatus,
  actor: 'contributor' | 'owner',
): boolean => (actor === 'owner' ? ownerCampaignTransitions : contributorCampaignTransitions)[from]?.includes(to) ?? false;

export type SiteProposalInputResult =
  | {
    ok: true;
    value: {
      slug: SiteContentBlockSlug;
      proposedBody: string;
      rationale: string;
    };
  }
  | { ok: false; message: string };

export const normalizeSiteProposalInput = (input: {
  slug?: unknown;
  proposedBody?: unknown;
  rationale?: unknown;
}): SiteProposalInputResult => {
  const normalized = normalizeSiteContentBlockInput({
    slug: input.slug,
    body: input.proposedBody,
  });
  if (!normalized.ok) {
    return {
      ok: false,
      message: normalized.message === 'Unknown site copy block.'
        ? 'Choose a supported public-site copy block.'
        : normalized.message,
    };
  }
  const rationale = normalizeLongText(input.rationale);
  if (!rationale) return { ok: false, message: 'Explain why this site-copy change helps.' };
  if (rationale.length > 800) {
    return { ok: false, message: 'Proposal rationale must be 800 characters or fewer.' };
  }
  return {
    ok: true,
    value: {
      slug: normalized.value.slug,
      proposedBody: normalized.value.body,
      rationale,
    },
  };
};
