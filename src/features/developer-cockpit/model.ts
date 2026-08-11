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
  | 'draft' | 'submitted' | 'changes_requested' | 'approved'
  | 'provider_draft' | 'scheduled' | 'published' | 'failed' | 'cancelled';

export type CampaignMediaReviewState = 'private' | 'needs_review' | 'approved' | 'public' | 'archived';
export type CampaignAssociationKind =
  | 'pull_request' | 'commit' | 'release' | 'feature' | 'shared_asset' | 'jam_recording';

export interface CampaignMediaDerivative {
  id: string;
  purpose: 'normalized_master' | 'public_original' | 'social_crop' | 'thumbnail';
  width: number;
  height: number;
  mimeType: 'image/webp';
  byteCount: number;
  exposure: 'private' | 'public';
  crop: { x: number; y: number; width: number; height: number } | null;
  approvedAt: string | null;
  createdAt: string;
  previewUrl: string;
}

export interface CampaignMedia {
  id: string;
  ingestingContributorId: string;
  contributorEmail: string | null;
  contributorName: string | null;
  mediaKind: 'image';
  originalMimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  originalFilename: string;
  originalByteCount: number;
  width: number;
  height: number;
  contentHash: string;
  perceptualHash: string | null;
  normalizedByteCount: number;
  rightsBasis: string;
  creatorCredit: string;
  rightsRestriction: string;
  rightsExpiresAt: string | null;
  reusableCaption: string;
  reusableDescription: string;
  focalPoint: { x: number; y: number } | null;
  reviewState: CampaignMediaReviewState;
  archivedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  previewUrl: string;
  derivatives: CampaignMediaDerivative[];
  campaignIds: string[];
  deliveryCount: number;
}

export interface CampaignMediaAttachment {
  id: string;
  mediaId: string;
  derivativeId: string | null;
  displayOrder: number;
  altText: string;
  captionOverride: string;
  cropIntent: Record<string, unknown>;
  media: CampaignMedia;
}

export interface SocialCampaignVariant {
  service: SocialService;
  text: string;
  attachments: CampaignMediaAttachment[];
}

export interface CampaignDevelopmentAssociation {
  id: string;
  kind: CampaignAssociationKind;
  externalKey: string;
  referenceUrl: string;
  titleSnapshot: string;
  metadataSnapshot: Record<string, unknown>;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface SocialCampaign {
  id: string;
  contributorId: string;
  contributorEmail: string | null;
  contributorName: string | null;
  title: string;
  objective: string;
  destinationUrl: string;
  productionNote: string;
  variants: SocialCampaignVariant[];
  associations: CampaignDevelopmentAssociation[];
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
  id: string; campaignId: string; provider: 'buffer'; service: SocialService;
  providerChannelId: string; providerPostId: string | null; status: SocialPublishJobStatus;
  scheduledFor: string | null; errorMessage: string; lastCheckedAt: string | null;
  createdAt: string; updatedAt: string;
}

export interface SiteContentProposal {
  id: string; contributorId: string; contributorEmail: string | null; contributorName: string | null;
  slug: SiteContentBlockSlug; baseBody: string; proposedBody: string; rationale: string;
  status: 'draft' | 'submitted' | 'changes_requested' | 'published' | 'rejected' | 'cancelled';
  reviewNote: string; reviewedBy: string | null; submittedAt: string | null; publishedAt: string | null;
  version: number; createdAt: string; updatedAt: string;
}

export interface ProviderChannelBinding { service: SocialService; channelId: string; }
export interface CampaignMediaLibrarySummary {
  mediaCount: number; protectedBytes: number; derivativeBytes: number; unusedMediaCount: number;
}
export interface DeveloperCockpitView {
  configured: boolean; extendedContributionsEnabled: boolean; currentUserId: string;
  isDeveloper: boolean; isOwner: boolean; scopes: DeveloperContributionScope[];
  campaigns: SocialCampaign[]; campaignMedia: CampaignMedia[]; campaignMediaSummary: CampaignMediaLibrarySummary;
  publishJobs: SocialPublishJob[]; siteProposals: SiteContentProposal[]; siteContentBlocks: SiteContentBlock[];
  profiles: DeveloperAccessProfile[];
  provider: { name: 'buffer'; configured: boolean; publishingEnabled: boolean; organizationId: string | null; allowedChannelCount: number; missing: string[]; };
}

export const CAMPAIGN_FIELD_LIMITS = {
  title: 120, objective: 600, destinationUrl: 2_048, productionNote: 1_000,
  variantText: 5_000, mediaAlt: 300, captionOverride: 1_000, associationKey: 500,
  rightsBasis: 1_000, creatorCredit: 500, rightsRestriction: 1_000,
  reusableCaption: 1_000, reusableDescription: 2_000,
  associationTitle: 500, associationNote: 1_000,
} as const;

const MAX_CAMPAIGN_ASSOCIATIONS = 12;
const MAX_CROP_INTENT_JSON_LENGTH = 2_000;
const MAX_ASSOCIATION_METADATA_JSON_LENGTH = 12_000;

type CampaignAttachmentInput = {
  mediaId: string; derivativeId: string | null; displayOrder: number; altText: string;
  captionOverride: string; cropIntent: Record<string, unknown>;
};
export type CampaignInput = {
  title?: unknown; objective?: unknown; destinationUrl?: unknown; productionNote?: unknown;
  requestedPublishAt?: unknown; variants?: unknown; associations?: unknown;
};
export type CampaignInputResult = { ok: true; value: {
  title: string; objective: string; destinationUrl: string; productionNote: string;
  requestedPublishAt: string | null; variants: Array<{ service: SocialService; text: string; attachments: CampaignAttachmentInput[] }>;
  associations: Array<Omit<CampaignDevelopmentAssociation, 'id' | 'createdBy' | 'createdAt'>>;
} } | { ok: false; message: string };

const shortText = (value: unknown) => typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ') : '';
const longText = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\r\n/g, '\n') : '';
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const normalizeHttpUrl = (value: unknown): string | null => {
  const input = typeof value === 'string' ? value.trim() : '';
  if (!input) return '';
  try { const url = new URL(input); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null; } catch { return null; }
};
const normalizeRequestedPublishAt = (value: unknown): string | null | false => {
  const input = typeof value === 'string' ? value.trim() : '';
  if (!input) return null;
  const parsed = new Date(input); return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : false;
};
const objectValue = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

export const normalizeCampaignInput = (input: CampaignInput): CampaignInputResult => {
  const title = shortText(input.title);
  if (!title) return { ok: false, message: 'Campaign name is required.' };
  if (title.length > CAMPAIGN_FIELD_LIMITS.title) return { ok: false, message: 'Campaign name must be 120 characters or fewer.' };
  const objective = longText(input.objective);
  if (!objective) return { ok: false, message: 'Campaign objective is required.' };
  if (objective.length > CAMPAIGN_FIELD_LIMITS.objective) return { ok: false, message: 'Campaign objective must be 600 characters or fewer.' };
  const destinationUrl = normalizeHttpUrl(input.destinationUrl);
  if (destinationUrl === null) return { ok: false, message: 'Destination URL must use HTTP or HTTPS.' };
  if (destinationUrl.length > CAMPAIGN_FIELD_LIMITS.destinationUrl) return { ok: false, message: 'Destination URL must be 2,048 characters or fewer.' };
  const requestedPublishAt = normalizeRequestedPublishAt(input.requestedPublishAt);
  if (requestedPublishAt === false) return { ok: false, message: 'Requested publish time is invalid.' };
  const productionNote = longText(input.productionNote);
  if (productionNote.length > CAMPAIGN_FIELD_LIMITS.productionNote) return { ok: false, message: 'Production note must be 1,000 characters or fewer.' };
  if (!Array.isArray(input.variants) || !input.variants.length) return { ok: false, message: 'Add at least one channel variant.' };
  if (input.variants.length > 10) return { ok: false, message: 'A campaign can target at most 10 channels.' };
  const seenServices = new Set<SocialService>();
  const variants: Array<{ service: SocialService; text: string; attachments: CampaignAttachmentInput[] }> = [];
  for (const value of input.variants) {
    const candidate = objectValue(value);
    if (!candidate || typeof candidate.service !== 'string' || !SOCIAL_SERVICES.includes(candidate.service as SocialService)) return { ok: false, message: 'Choose a supported social channel.' };
    if ('media' in candidate || 'sourceBucket' in candidate || 'sourcePath' in candidate || 'publicUrl' in candidate) return { ok: false, message: 'Attach CardForge media by ID; storage references are not accepted.' };
    const service = candidate.service as SocialService;
    if (seenServices.has(service)) return { ok: false, message: 'Add only one variant per social channel.' };
    seenServices.add(service);
    const text = longText(candidate.text);
    if (!text) return { ok: false, message: `${SOCIAL_SERVICE_LABELS[service]} copy is required.` };
    if (text.length > CAMPAIGN_FIELD_LIMITS.variantText) return { ok: false, message: `${SOCIAL_SERVICE_LABELS[service]} copy must be 5,000 characters or fewer.` };
    const source = candidate.attachments;
    if (source !== undefined && !Array.isArray(source)) return { ok: false, message: 'Campaign attachments must be a list.' };
    if (Array.isArray(source) && source.length > 4) return { ok: false, message: 'Each channel can include at most four images.' };
    const attachmentIds = new Set<string>();
    const attachmentOrders = new Set<number>();
    const attachments: CampaignAttachmentInput[] = [];
    for (const rawAttachment of Array.isArray(source) ? source : []) {
      const attachment = objectValue(rawAttachment);
      if (!attachment || 'sourceBucket' in attachment || 'sourcePath' in attachment || 'publicUrl' in attachment || 'sourceReference' in attachment || 'licenseNotes' in attachment) return { ok: false, message: 'Attach CardForge media by ID; storage references are not accepted.' };
      const mediaId = typeof attachment?.mediaId === 'string' ? attachment.mediaId : '';
      const derivativeId = typeof attachment?.derivativeId === 'string' ? attachment.derivativeId : null;
      const altText = longText(attachment?.altText);
      const captionOverride = longText(attachment?.captionOverride);
      const displayOrder = Number(attachment?.displayOrder ?? attachments.length);
      const cropIntent = objectValue(attachment?.cropIntent) ?? {};
      if (!isUuid(mediaId) || (derivativeId && !isUuid(derivativeId))) return { ok: false, message: 'Choose a valid CardForge media item.' };
      if (attachmentIds.has(mediaId)) return { ok: false, message: 'Attach each media item only once per channel.' };
      attachmentIds.add(mediaId);
      if (!altText) return { ok: false, message: 'Every campaign image needs alt text.' };
      if (altText.length > CAMPAIGN_FIELD_LIMITS.mediaAlt) return { ok: false, message: 'Campaign image alt text must be 300 characters or fewer.' };
      if (captionOverride.length > CAMPAIGN_FIELD_LIMITS.captionOverride) return { ok: false, message: 'Caption override must be 1,000 characters or fewer.' };
      if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 99) return { ok: false, message: 'Campaign image order is invalid.' };
      if (attachmentOrders.has(displayOrder)) return { ok: false, message: 'Each campaign image needs a unique display order.' };
      attachmentOrders.add(displayOrder);
      if (JSON.stringify(cropIntent).length > MAX_CROP_INTENT_JSON_LENGTH) return { ok: false, message: 'Campaign crop intent is too large.' };
      attachments.push({ mediaId, derivativeId, displayOrder, altText, captionOverride, cropIntent });
    }
    variants.push({ service, text, attachments });
  }
  const associations: Array<Omit<CampaignDevelopmentAssociation, 'id' | 'createdBy' | 'createdAt'>> = [];
  const associationKeys = new Set<string>();
  if (input.associations !== undefined && !Array.isArray(input.associations)) return { ok: false, message: 'Development associations must be a list.' };
  if (Array.isArray(input.associations) && input.associations.length > MAX_CAMPAIGN_ASSOCIATIONS) return { ok: false, message: `A campaign can include at most ${MAX_CAMPAIGN_ASSOCIATIONS} development associations.` };
  for (const rawAssociation of Array.isArray(input.associations) ? input.associations : []) {
    const association = objectValue(rawAssociation);
    const kind = association?.kind;
    const externalKey = longText(association?.externalKey);
    const referenceUrl = normalizeHttpUrl(association?.referenceUrl);
    const titleSnapshot = longText(association?.titleSnapshot);
    const note = longText(association?.note);
    const metadataSnapshot = objectValue(association?.metadataSnapshot) ?? {};
    if (!['pull_request', 'commit', 'release', 'feature', 'shared_asset', 'jam_recording'].includes(String(kind)) || !externalKey || externalKey.length > CAMPAIGN_FIELD_LIMITS.associationKey || referenceUrl === null) return { ok: false, message: 'Each development association needs a supported kind and durable reference.' };
    if (referenceUrl.length > CAMPAIGN_FIELD_LIMITS.destinationUrl) return { ok: false, message: 'Development association URLs must be 2,048 characters or fewer.' };
    if (titleSnapshot.length > CAMPAIGN_FIELD_LIMITS.associationTitle) return { ok: false, message: 'Development association titles must be 500 characters or fewer.' };
    if (note.length > CAMPAIGN_FIELD_LIMITS.associationNote) return { ok: false, message: 'Development association notes must be 1,000 characters or fewer.' };
    const key = `${kind}:${externalKey}`;
    if (associationKeys.has(key)) return { ok: false, message: 'Add each development association only once.' };
    if (JSON.stringify(metadataSnapshot).length > MAX_ASSOCIATION_METADATA_JSON_LENGTH) return { ok: false, message: 'Development association metadata is too large.' };
    associationKeys.add(key);
    associations.push({ kind: kind as CampaignAssociationKind, externalKey, referenceUrl, titleSnapshot, metadataSnapshot, note });
  }
  return { ok: true, value: { title, objective, destinationUrl, productionNote, requestedPublishAt, variants, associations } };
};

const contributorCampaignTransitions: Partial<Record<SocialCampaignStatus, SocialCampaignStatus[]>> = { draft: ['submitted', 'cancelled'], changes_requested: ['draft', 'submitted', 'cancelled'], submitted: ['cancelled'] };
const ownerCampaignTransitions: Partial<Record<SocialCampaignStatus, SocialCampaignStatus[]>> = { draft: ['submitted', 'cancelled'], submitted: ['changes_requested', 'approved', 'cancelled'], changes_requested: ['cancelled'], approved: ['provider_draft', 'scheduled', 'failed', 'cancelled'], provider_draft: ['scheduled', 'published', 'failed', 'cancelled'], scheduled: ['published', 'failed', 'cancelled'], failed: ['approved', 'cancelled'] };
export const canTransitionCampaign = (from: SocialCampaignStatus, to: SocialCampaignStatus, actor: 'contributor' | 'owner'): boolean => (actor === 'owner' ? ownerCampaignTransitions : contributorCampaignTransitions)[from]?.includes(to) ?? false;

export type SiteProposalInputResult = { ok: true; value: { slug: SiteContentBlockSlug; proposedBody: string; rationale: string } } | { ok: false; message: string };
export const normalizeSiteProposalInput = (input: { slug?: unknown; proposedBody?: unknown; rationale?: unknown }): SiteProposalInputResult => {
  const normalized = normalizeSiteContentBlockInput({ slug: input.slug, body: input.proposedBody });
  if (!normalized.ok) return { ok: false, message: normalized.message === 'Unknown site copy block.' ? 'Choose a supported public-site copy block.' : normalized.message };
  const rationale = longText(input.rationale);
  if (!rationale) return { ok: false, message: 'Explain why this site-copy change helps.' };
  if (rationale.length > 800) return { ok: false, message: 'Proposal rationale must be 800 characters or fewer.' };
  return { ok: true, value: { slug: normalized.value.slug, proposedBody: normalized.value.body, rationale } };
};
