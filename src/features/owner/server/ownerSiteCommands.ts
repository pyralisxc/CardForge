import 'server-only';

import { revalidatePath } from 'next/cache';

import {
  publishSiteContentBlockRevision,
  revalidatePublicSiteConfiguration,
  revalidateSiteContentCache,
  updatePublicSiteConfiguration,
  updatePublicSiteVisibleField,
  getPublicSiteConfiguration,
  PublicSiteConfigurationStoreError,
  type PublicSitePage,
  type PublicSiteVisibleFieldInput,
  type PublicSiteConfiguration,
  type SiteContentBlock,
} from '@/features/public-site/server';
import { publishLegalDocument, revalidateLegalDocumentCache } from '@/features/legal/server';
import { updateRoadmapSettings, updateRoadmapAdminItemStatus } from '@/features/roadmap/server';
import { recordOwnerActivity } from './ownerActivityStore';
import { updateBusinessIdentity, revalidatePublicIdentityCache } from '@/features/business-identity/server';
import { updateFounderProfile, revalidateFounderProfile } from '@/features/public-site/server';
import { updateExperienceSettings, revalidateExperienceSettingsCache } from '@/features/experience-settings/server';

export interface OwnerCommandActor {
  userId: string;
  email: string | null;
}

export interface OwnerCommittedMutationReceipt {
  committed: true;
  refreshComplete: boolean;
  refreshFailures: string[];
  activityRecorded: boolean;
  retryable: false;
  nextAction: 'none' | 'reload';
  message: string;
}

type RefreshStep = {
  label: string;
  run: () => void | boolean;
};

const runPostCommitRefresh = (steps: RefreshStep[]): string[] => {
  const failures: string[] = [];
  for (const step of steps) {
    try {
      if (step.run() === false) failures.push(step.label);
    } catch (error) {
      console.error(`Owner publication refresh failed (${step.label}):`, error);
      failures.push(step.label);
    }
  }
  return failures;
};

const createReceipt = ({
  activityRecorded,
  refreshFailures,
  subject,
}: {
  activityRecorded: boolean;
  refreshFailures: string[];
  subject: string;
}): OwnerCommittedMutationReceipt => {
  const refreshComplete = refreshFailures.length === 0;
  return {
    committed: true,
    refreshComplete,
    refreshFailures,
    activityRecorded,
    retryable: false,
    nextAction: refreshComplete ? 'none' : 'reload',
    message: refreshComplete
      ? `${subject} published.`
      : `${subject} was published, but the live cache could not be fully refreshed. Reload the public site to verify the committed version before publishing again.`,
  };
};

export const finalizeOwnerPublication = async <T>({ actor, value, action, targetType, targetId, summary, subject, refreshSteps }: {
  actor: OwnerCommandActor; value: T; action: string; targetType: string; targetId: string;
  summary: string; subject: string; refreshSteps: RefreshStep[];
}): Promise<{ value: T; receipt: OwnerCommittedMutationReceipt }> => {
  const refreshFailures = runPostCommitRefresh(refreshSteps);
  let activityRecorded = false;
  try {
    activityRecorded = await recordOwnerActivity({ actorUserId: actor.userId, actorEmail: actor.email,
      action, targetType, targetId, summary, metadata: { refreshFailures, refreshComplete: refreshFailures.length === 0 } });
  } catch (error) { console.error('Owner publication committed; activity unavailable:', error); }
  return { value, receipt: createReceipt({ activityRecorded, refreshFailures, subject }) };
};

export const publishOwnerBusinessIdentity = async ({ actor, input, expectedIdentityVersion }: {
  actor: OwnerCommandActor; input: Record<string, unknown>; expectedIdentityVersion: number;
}) => finalizeOwnerPublication({ actor, value: await updateBusinessIdentity(input, expectedIdentityVersion),
  action: 'identity.update', targetType: 'business_identity', targetId: 'cardforge',
  summary: 'Updated public business identity and legal operator details.', subject: 'Business identity',
  refreshSteps: [{ label: 'public-identity-cache', run: revalidatePublicIdentityCache }] });

export const publishOwnerFounderProfile = async ({ actor, input, expectedUpdatedAt }: {
  actor: OwnerCommandActor; input: Record<string, unknown>; expectedUpdatedAt: string | null;
}) => finalizeOwnerPublication({ actor, value: await updateFounderProfile(input, expectedUpdatedAt),
  action: 'founder.profile.update', targetType: 'founder_profile', targetId: 'cameron',
  summary: 'Updated the public founder profile, priorities, or social destinations.', subject: 'Founder profile',
  refreshSteps: [{ label: 'founder-cache', run: revalidateFounderProfile },
    { label: 'founder-page', run: () => revalidatePath('/cameron') },
    { label: 'public-layout', run: () => revalidatePath('/', 'layout') }] });

export const publishOwnerExperienceSettings = async ({ actor, input }: {
  actor: OwnerCommandActor; input: Record<string, unknown>;
}) => finalizeOwnerPublication({ actor, value: await updateExperienceSettings(input),
  action: 'experience.settings.update', targetType: 'experience_settings', targetId: 'cardforge',
  summary: 'Updated CardForge experience and presentation controls.', subject: 'Experience settings',
  refreshSteps: [{ label: 'experience-cache', run: revalidateExperienceSettingsCache },
    { label: 'public-layout', run: () => revalidatePath('/', 'layout') }] });

export const publishOwnerSiteContentBlock = async ({
  actor,
  input,
}: {
  actor: OwnerCommandActor;
  input: { slug?: unknown; body?: unknown; expectedUpdatedAt?: unknown };
}): Promise<{ siteContentBlock: SiteContentBlock; receipt: OwnerCommittedMutationReceipt }> => {
  const siteContentBlock = await publishSiteContentBlockRevision(input);
  const refreshFailures = runPostCommitRefresh([
    { label: 'site-content-cache', run: revalidateSiteContentCache },
    { label: 'public-layout', run: () => revalidatePath('/', 'layout') },
  ]);
  const activityRecorded = await recordOwnerActivity({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    action: 'site.copy.publish',
    targetType: 'site_content',
    targetId: siteContentBlock.slug,
    summary: 'Published an owner-authored public site copy block.',
    metadata: {
      expectedUpdatedAt: input.expectedUpdatedAt ?? null,
      committedUpdatedAt: siteContentBlock.updatedAt,
      refreshComplete: refreshFailures.length === 0,
      refreshFailures,
    },
  });
  return {
    siteContentBlock,
    receipt: createReceipt({
      activityRecorded,
      refreshFailures,
      subject: siteContentBlock.label,
    }),
  };
};

const finalizeOwnerSiteConfiguration = async ({
  actor, settings, field,
}: {
  actor: OwnerCommandActor;
  settings: PublicSiteConfiguration;
  field?: string;
}): Promise<{ settings: PublicSiteConfiguration; receipt: OwnerCommittedMutationReceipt }> => {
  const refreshFailures = runPostCommitRefresh([
    { label: 'site-configuration-cache', run: revalidatePublicSiteConfiguration },
    { label: 'homepage', run: () => revalidatePath('/') },
    { label: 'account', run: () => revalidatePath('/account') },
    { label: 'founder-page', run: () => revalidatePath('/cameron') },
    { label: 'public-layout', run: () => revalidatePath('/', 'layout') },
    { label: 'public-pages', run: () => revalidatePath('/[slug]', 'page') },
    { label: 'sitemap', run: () => revalidatePath('/sitemap.xml') },
  ]);
  const activityRecorded = await recordOwnerActivity({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    action: 'site.configuration.update',
    targetType: 'public_site',
    targetId: 'cardforge',
    summary: 'Updated public navigation, homepage presentation, offer visibility, announcement, search metadata, watermark presentation, or demonstration sets.',
    metadata: {
      ...(field ? { updatedField: field } : {}),
      announcementEnabled: settings.announcementEnabled,
      visibleNavigation: settings.primaryNavigation.filter((item) => item.visible).map((item) => item.id),
      visibleHomepageSections: settings.homepageSections.filter((item) => item.visible).map((item) => item.id),
      visibleShowcaseExamples: settings.homepageSections
        .flatMap((item) => 'showcaseExamples' in item ? (item.showcaseExamples ?? []) : [])
        .filter((example) => example.visible).map((example) => example.slug),
      refreshComplete: refreshFailures.length === 0,
      refreshFailures,
    },
  });
  return {
    settings,
    receipt: createReceipt({
      activityRecorded,
      refreshFailures,
      subject: 'Public site settings',
    }),
  };
};
export const publishOwnerSiteConfiguration = async ({
  actor, input,
}: {
  actor: OwnerCommandActor;
  input: Record<string, unknown>;
}): Promise<{ settings: PublicSiteConfiguration; receipt: OwnerCommittedMutationReceipt }> => (
  finalizeOwnerSiteConfiguration({ actor, settings: await updatePublicSiteConfiguration(input) })
);

export const publishOwnerSiteConfigurationField = async ({
  actor, input,
}: {
  actor: OwnerCommandActor;
  input: PublicSiteVisibleFieldInput;
}): Promise<{ settings: PublicSiteConfiguration; receipt: OwnerCommittedMutationReceipt }> => (
  finalizeOwnerSiteConfiguration({
    actor,
    settings: await updatePublicSiteVisibleField(input),
    field: input.field === 'navigationLabel' ? 'navigation.' + input.navigationId : input.field,
  })
);

/** Agent partial edits still commit through the browser's full-settings command. */
export const publishOwnerSiteConfigurationPatch = async ({
  actor, patch, expectedUpdatedAt,
}: {
  actor: OwnerCommandActor;
  patch: Record<string, unknown>;
  expectedUpdatedAt: string;
}): Promise<{ settings: PublicSiteConfiguration; receipt: OwnerCommittedMutationReceipt }> => {
  const current = await getPublicSiteConfiguration();
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)
    || !Object.keys(patch).length
    || Object.keys(patch).some((key) => key === 'updatedAt' || !Object.hasOwn(current, key))) {
    throw new PublicSiteConfigurationStoreError('Choose supported public site settings to publish.', 400);
  }
  return publishOwnerSiteConfiguration({ actor, input: { ...current, ...patch, updatedAt: expectedUpdatedAt } });
};

/** A page is presentation in the existing settings row, not a new publication store. */
export const publishOwnerSitePage = async ({ actor, pageId, page, expectedUpdatedAt }: {
  actor: OwnerCommandActor;
  pageId: string;
  page: PublicSitePage | null;
  expectedUpdatedAt: string;
}) => {
  const current = await getPublicSiteConfiguration();
  const pages = [...(current.pages ?? [])];
  const index = pages.findIndex((item) => item.id === pageId);
  if (page && page.id !== pageId) throw new PublicSiteConfigurationStoreError('Keep the selected page identity.', 400);
  if (!page && index < 0) throw new PublicSiteConfigurationStoreError('This page no longer exists.', 404);
  if (page && index < 0) pages.push(page);
  else if (page) pages[index] = page;
  else pages.splice(index, 1);
  const publication = await publishOwnerSiteConfigurationPatch({ actor, expectedUpdatedAt, patch: { pages,
    // Explicit page removal also removes its navigation projection. It never changes another page.
    primaryNavigation: page ? current.primaryNavigation : current.primaryNavigation.filter((item) => item.id !== pageId),
  } });
  const status = !page ? 'Website page removed from public routing and navigation.'
    : page.published ? `Website page /${page.slug} published.` : 'Website page saved for Owner editing; it is not public.';
  return { ...publication, receipt: { ...publication.receipt,
    message: status + (publication.receipt.refreshComplete ? '' : ' Public cache refresh is incomplete. Reload and verify the committed state before saving again.'),
  } };
};

export const publishOwnerLegalDocument = async ({ actor, input }: { actor: OwnerCommandActor; input: Parameters<typeof publishLegalDocument>[0] }) => {
  const value = await publishLegalDocument(input);
  return finalizeOwnerPublication({ actor, value, action: 'legal.publish', targetType: 'legal_document', targetId: value.slug,
    summary: 'Published a new immutable version of a CardForge legal document.', subject: value.title,
    refreshSteps: [{ label: 'legal-cache', run: () => revalidateLegalDocumentCache(value.slug) }] });
};
export const publishOwnerRoadmapSettings = async ({ actor, input }: { actor: OwnerCommandActor; input: Parameters<typeof updateRoadmapSettings>[0] }) => (
  finalizeOwnerPublication({ actor, value: await updateRoadmapSettings(input), action: 'roadmap.settings.update', targetType: 'roadmap', targetId: 'settings',
    summary: 'Updated roadmap rules and presentation.', subject: 'Roadmap settings', refreshSteps: [{ label: 'roadmap-page', run: () => revalidatePath('/roadmap') }] })
);
export const publishOwnerRoadmapStatus = async ({ actor, input }: { actor: OwnerCommandActor; input: Parameters<typeof updateRoadmapAdminItemStatus>[0] }) => (
  finalizeOwnerPublication({ actor, value: await updateRoadmapAdminItemStatus(input), action: 'roadmap.item.status.update', targetType: 'roadmap_item', targetId: String(input.itemId),
    summary: 'Updated an official roadmap item status.', subject: 'Roadmap status', refreshSteps: [{ label: 'roadmap-page', run: () => revalidatePath('/roadmap') }] })
);
