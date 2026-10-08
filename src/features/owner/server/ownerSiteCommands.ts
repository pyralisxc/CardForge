import 'server-only';

import { revalidatePath } from 'next/cache';

import {
  publishPublicSiteConfigurationRevision,
  publishSiteContentBlockRevision,
  revalidatePublicSiteConfiguration,
  revalidateSiteContentCache,
  type PublicSiteConfiguration,
  type SiteContentBlock,
} from '@/features/public-site/server';
import { recordOwnerActivity } from './ownerActivityStore';

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
  run: () => void;
};

const runPostCommitRefresh = (steps: RefreshStep[]): string[] => {
  const failures: string[] = [];
  for (const step of steps) {
    try {
      step.run();
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

export const publishOwnerSiteConfiguration = async ({
  actor,
  input,
  expectedUpdatedAt,
}: {
  actor: OwnerCommandActor;
  input: Record<string, unknown>;
  expectedUpdatedAt: unknown;
}): Promise<{
  settings: PublicSiteConfiguration;
  updatedAt: string | null;
  receipt: OwnerCommittedMutationReceipt;
}> => {
  const publication = await publishPublicSiteConfigurationRevision(input, expectedUpdatedAt);
  const settings = publication.settings;
  const refreshFailures = runPostCommitRefresh([
    { label: 'site-configuration-cache', run: revalidatePublicSiteConfiguration },
    { label: 'homepage', run: () => revalidatePath('/') },
    { label: 'account', run: () => revalidatePath('/account') },
    { label: 'founder-page', run: () => revalidatePath('/cameron') },
    { label: 'public-layout', run: () => revalidatePath('/', 'layout') },
  ]);
  const activityRecorded = await recordOwnerActivity({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    action: 'site.configuration.update',
    targetType: 'public_site',
    targetId: 'cardforge',
    summary: 'Updated public navigation, homepage presentation, offer visibility, announcement, search metadata, watermark presentation, or demonstration sets.',
    metadata: {
      expectedUpdatedAt,
      committedUpdatedAt: publication.updatedAt,
      announcementEnabled: settings.announcementEnabled,
      visibleNavigation: settings.primaryNavigation.filter((item) => item.visible).map((item) => item.id),
      visibleHomepageSections: settings.homepageSections.filter((item) => item.visible).map((item) => item.id),
      visibleShowcaseExamples: settings.homepageSections
        .find((item) => item.id === 'showcase')
        ?.showcaseExamples?.filter((example) => example.visible).map((example) => example.slug) ?? [],
      refreshComplete: refreshFailures.length === 0,
      refreshFailures,
    },
  });
  return {
    settings,
    updatedAt: publication.updatedAt,
    receipt: createReceipt({
      activityRecorded,
      refreshFailures,
      subject: 'Public site settings',
    }),
  };
};