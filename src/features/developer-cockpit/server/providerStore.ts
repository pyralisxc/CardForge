import type {
  ProviderChannelBinding,
  SocialCampaign,
  SocialCampaignVariant,
  SocialPublishJobStatus,
  SocialService,
} from '@/features/developer-cockpit/model';
import type { DeveloperCockpitAccess } from '@/features/developer-cockpit/server/access';
import {
  BufferPublisherError,
  createBufferPublisherFromEnvironment,
  getBufferConfiguration,
  type BufferChannel,
} from '@/features/social-publishing/server';
import {
  DeveloperCockpitStoreError,
  fetchPublishJobs,
  getCampaignRecord,
  normalizeExpectedVersion,
  requireCockpitDatabase,
  throwCockpitDatabaseError,
} from './storeShared';
import { getPublicCampaignMediaUrl } from './media';

const validateProviderBindings = (
  campaign: SocialCampaign,
  bindings: ProviderChannelBinding[],
  channels: BufferChannel[],
): Array<{ variant: SocialCampaignVariant; channel: BufferChannel }> => {
  if (!Array.isArray(bindings) || bindings.length === 0) {
    throw new DeveloperCockpitStoreError('Choose at least one connected Buffer channel.', 400);
  }
  const variantsByService = new Map(campaign.variants.map((variant) => [variant.service, variant]));
  const channelsById = new Map(channels.map((channel) => [channel.id, channel]));
  const seenChannels = new Set<string>();
  return bindings.map((binding) => {
    if (seenChannels.has(binding.channelId)) {
      throw new DeveloperCockpitStoreError('Choose each Buffer channel only once.', 400);
    }
    seenChannels.add(binding.channelId);
    const variant = variantsByService.get(binding.service);
    const channel = channelsById.get(binding.channelId);
    if (!variant || !channel || channel.service !== binding.service) {
      throw new DeveloperCockpitStoreError('A Buffer channel does not match its campaign variant.', 400);
    }
    if (channel.isQueuePaused) {
      throw new DeveloperCockpitStoreError(`${channel.displayName} has a paused Buffer queue.`, 409);
    }
    return { variant, channel };
  });
};

const upsertPublishJob = async ({
  campaignId,
  service,
  channelId,
  providerPostId,
  status,
  scheduledFor,
  errorMessage = '',
}: {
  campaignId: string;
  service: SocialService;
  channelId: string;
  providerPostId: string | null;
  status: SocialPublishJobStatus;
  scheduledFor: string | null;
  errorMessage?: string;
}): Promise<void> => {
  const supabase = requireCockpitDatabase();
  const { error } = await supabase
    .from('cardforge_social_publish_jobs')
    .upsert({
      campaign_id: campaignId,
      provider: 'buffer',
      service,
      provider_channel_id: channelId,
      provider_post_id: providerPostId,
      status,
      scheduled_for: scheduledFor,
      error_message: errorMessage,
      last_checked_at: new Date().toISOString(),
    }, { onConflict: 'campaign_id,provider_channel_id' });
  if (error) throwCockpitDatabaseError('Unable to record the Buffer delivery job.', error);
};

const setCampaignProviderStatus = async (
  campaign: SocialCampaign,
  status: 'provider_draft' | 'scheduled' | 'published' | 'failed',
): Promise<void> => {
  const supabase = requireCockpitDatabase();
  const { data, error } = await supabase
    .from('cardforge_social_campaigns')
    .update({ status, version: campaign.version + 1 })
    .eq('id', campaign.id)
    .eq('version', campaign.version)
    .select('id')
    .limit(1);
  if (error) throwCockpitDatabaseError('Unable to record the campaign provider status.', error);
  if (!data?.[0]) {
    throw new DeveloperCockpitStoreError('This campaign changed elsewhere. Reload before updating Buffer.', 409);
  }
};

export const getBufferChannels = async (): Promise<BufferChannel[]> => {
  const configuration = getBufferConfiguration();
  if (!configuration.configured) {
    throw new DeveloperCockpitStoreError(`Buffer is not configured: ${configuration.missing.join(', ')}.`, 503);
  }
  const publisher = createBufferPublisherFromEnvironment();
  if (!publisher) throw new DeveloperCockpitStoreError('Buffer is not configured.', 503);
  try {
    return await publisher.listChannels();
  } catch (error) {
    if (error instanceof BufferPublisherError) {
      throw new DeveloperCockpitStoreError(error.message, error.status);
    }
    throw error;
  }
};

export const publishSocialCampaignToBuffer = async ({
  access,
  campaignId,
  expectedVersion,
  mode,
  dueAt,
  bindings,
}: {
  access: DeveloperCockpitAccess;
  campaignId: string;
  expectedVersion: unknown;
  mode: 'draft' | 'schedule';
  dueAt?: unknown;
  bindings: ProviderChannelBinding[];
}): Promise<void> => {
  if (!access.isOwner) throw new DeveloperCockpitStoreError('Owner publishing access is required.', 403);
  const configuration = getBufferConfiguration();
  if (!configuration.configured || !configuration.publishingEnabled) {
    throw new DeveloperCockpitStoreError(
      'Buffer publishing is hard-disabled until server credentials, connected channels, and CARDFORGE_BUFFER_PUBLISHING_ENABLED=true are verified.',
      503,
    );
  }
  const campaign = await getCampaignRecord(campaignId);
  const version = normalizeExpectedVersion(expectedVersion);
  if (version !== campaign.version) {
    throw new DeveloperCockpitStoreError('This campaign changed elsewhere. Reload before publishing.', 409);
  }
  if (
    campaign.status !== 'approved'
    && campaign.status !== 'failed'
    && !(mode === 'schedule' && campaign.status === 'provider_draft')
  ) {
    throw new DeveloperCockpitStoreError('Only an owner-approved campaign can be sent to Buffer.', 409);
  }
  const scheduleTime = mode === 'schedule'
    ? new Date(typeof dueAt === 'string' && dueAt ? dueAt : campaign.requestedPublishAt ?? '')
    : null;
  if (mode === 'schedule' && (!scheduleTime || !Number.isFinite(scheduleTime.getTime()) || scheduleTime.getTime() <= Date.now())) {
    throw new DeveloperCockpitStoreError('Choose a future Buffer publish time.', 400);
  }

  const publisher = createBufferPublisherFromEnvironment();
  if (!publisher) throw new DeveloperCockpitStoreError('Buffer is not configured.', 503);
  const [channels, existingJobs] = await Promise.all([
    publisher.listChannels(),
    fetchPublishJobs([campaign.id]),
  ]);
  const targets = validateProviderBindings(campaign, bindings, channels);
  let activeTarget: { variant: SocialCampaignVariant; channel: BufferChannel } | null = null;

  try {
    for (const { variant, channel } of targets) {
      activeTarget = { variant, channel };
      const existingJob = existingJobs.find((job) => job.providerChannelId === channel.id);
      if (
        mode === 'draft'
        && existingJob
        && ['provider_draft', 'scheduled', 'published'].includes(existingJob.status)
      ) {
        continue;
      }
      if (mode === 'schedule' && (existingJob?.status === 'scheduled' || existingJob?.status === 'published')) {
        continue;
      }
      const mediaUrls = await Promise.all(
        variant.attachments.map((attachment) => getPublicCampaignMediaUrl(
          attachment.mediaId,
          attachment.derivativeId,
        )),
      );
      const result = mode === 'draft'
        ? await publisher.createDraft({ channelId: channel.id, text: variant.text, mediaUrls })
        : existingJob?.status === 'provider_draft' && existingJob.providerPostId
          ? await publisher.scheduleDraft(existingJob.providerPostId, scheduleTime!.toISOString())
          : await publisher.createScheduledPost({
            channelId: channel.id,
            text: variant.text,
            mediaUrls,
            dueAt: scheduleTime!.toISOString(),
          });
      await upsertPublishJob({
        campaignId: campaign.id,
        service: variant.service,
        channelId: channel.id,
        providerPostId: result.providerPostId,
        status: result.status,
        scheduledFor: result.dueAt,
      });
    }
    activeTarget = null;
    await setCampaignProviderStatus(campaign, mode === 'draft' ? 'provider_draft' : 'scheduled');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Buffer publishing failed.';
    if (activeTarget) {
      await upsertPublishJob({
        campaignId: campaign.id,
        service: activeTarget.variant.service,
        channelId: activeTarget.channel.id,
        providerPostId: null,
        status: 'failed',
        scheduledFor: scheduleTime?.toISOString() ?? null,
        errorMessage: message,
      });
    }
    await setCampaignProviderStatus(campaign, 'failed');
    if (error instanceof BufferPublisherError) {
      throw new DeveloperCockpitStoreError(error.message, error.status);
    }
    if (error instanceof DeveloperCockpitStoreError) throw error;
    throw new DeveloperCockpitStoreError(message);
  }
};

export const refreshSocialCampaignProviderStatus = async (
  access: DeveloperCockpitAccess,
  campaignId: string,
): Promise<void> => {
  if (!access.isOwner) throw new DeveloperCockpitStoreError('Owner publishing access is required.', 403);
  const configuration = getBufferConfiguration();
  if (!configuration.configured) throw new DeveloperCockpitStoreError('Buffer is not configured.', 503);
  const campaign = await getCampaignRecord(campaignId);
  const jobs = await fetchPublishJobs([campaign.id]);
  const publisher = createBufferPublisherFromEnvironment();
  if (!publisher) throw new DeveloperCockpitStoreError('Buffer is not configured.', 503);
  for (const job of jobs) {
    if (!job.providerPostId) continue;
    try {
      const result = await publisher.getPost(job.providerPostId);
      await upsertPublishJob({
        campaignId: campaign.id,
        service: job.service,
        channelId: job.providerChannelId,
        providerPostId: result.providerPostId,
        status: result.status,
        scheduledFor: result.dueAt,
      });
    } catch (error) {
      await upsertPublishJob({
        campaignId: campaign.id,
        service: job.service,
        channelId: job.providerChannelId,
        providerPostId: job.providerPostId,
        status: 'failed',
        scheduledFor: job.scheduledFor,
        errorMessage: error instanceof Error ? error.message : 'Unable to refresh Buffer status.',
      });
    }
  }
  const refreshed = await fetchPublishJobs([campaign.id]);
  const status: 'provider_draft' | 'scheduled' | 'published' | 'failed' =
    refreshed.length > 0 && refreshed.every((job) => job.status === 'published')
      ? 'published'
      : refreshed.some((job) => job.status === 'failed')
        ? 'failed'
        : refreshed.some((job) => job.status === 'scheduled')
          ? 'scheduled'
          : 'provider_draft';
  await setCampaignProviderStatus(campaign, status);
};
