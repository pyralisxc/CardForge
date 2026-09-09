import { buildOrganicCampaignUrl } from '@/features/analytics/server';
import {
  getMarketingContentPackage,
  getPublicCampaignMediaUrl,
} from '@/features/marketing-content/server';
import {
  publishToMeta,
} from '@/features/social-publishing/server';
import { isMetaPublishingService } from '@/features/marketing-distribution/model';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { decryptMarketingToken } from './marketingTokenCrypto';
import { getMetaConfiguration } from './metaConnection';

type ClaimedDelivery = {
  id: string;
  campaign_id: string;
  destination_id: string;
  service: string;
  attempt_count: number;
  claim_token: string;
  provider_channel_id: string;
  approved_campaign_version: number | null;
};

type DestinationRow = {
  id: string;
  connection_id: string;
  external_account_id: string;
  service: string;
};

type ConnectionSecretRow = {
  access_token_ciphertext: string;
  access_token_iv: string;
  access_token_auth_tag: string;
  status: string;
};

class PublishedButUnrecordedError extends Error {
  constructor(
    message: string,
    public readonly providerPostId: string,
    public readonly publicationUrl: string,
  ) {
    super(message);
  }
}

class PublicationUnconfirmedError extends Error {}
class DeliveryApprovalChangedError extends Error {}

const finishDelivery = async (
  delivery: ClaimedDelivery,
  values: Record<string, unknown>,
) => {
  const database = getSupabaseServerClient();
  if (!database) throw new Error('The marketing database is not configured.');
  const { data, error } = await database.from('cardforge_social_publish_jobs').update({
    ...values,
    claimed_at: null,
    claim_token: null,
    last_checked_at: new Date().toISOString(),
  }).eq('id', delivery.id)
    .eq('claim_token', delivery.claim_token)
    .eq('status', 'publishing')
    .select('id');
  if (error) throw new Error('Unable to finalize the marketing delivery.');
  if (data?.length !== 1) throw new Error('The delivery claim changed. Review its current state before retrying.');
};

const dispatchOne = async (delivery: ClaimedDelivery) => {
  const database = getSupabaseServerClient();
  if (!database) throw new Error('The marketing database is not configured.');
  if (!isMetaPublishingService(delivery.service)) {
    throw new Error('The delivery channel is not supported by the Meta publisher.');
  }
  const { data: destinationData, error: destinationError } = await database
    .from('cardforge_marketing_destinations')
    .select('id,connection_id,external_account_id,service')
    .eq('id', delivery.destination_id)
    .eq('provider', 'meta')
    .eq('service', delivery.service)
    .eq('publishing_mode', 'automatic')
    .eq('active', true)
    .limit(1);
  const destination = destinationData?.[0] as DestinationRow | undefined;
  if (
    destinationError
    || !destination?.connection_id
    || !isMetaPublishingService(destination.service)
  ) throw new Error('The Meta destination is unavailable.');
  if (destination.external_account_id !== delivery.provider_channel_id) {
    throw new DeliveryApprovalChangedError('The approved delivery destination changed. Prepare a new delivery for the intended account.');
  }
  const { data: connectionData, error: connectionError } = await database
    .from('cardforge_marketing_connections')
    .select('access_token_ciphertext,access_token_iv,access_token_auth_tag,status')
    .eq('id', destination.connection_id)
    .eq('provider', 'meta')
    .limit(1);
  const connection = connectionData?.[0] as ConnectionSecretRow | undefined;
  if (connectionError) throw new Error('The Meta connection could not be read. Try again when the marketing database is available.');
  if (!connection || connection.status !== 'active') throw new Error('The Meta connection must be reconnected.');
  const content = await getMarketingContentPackage(delivery.campaign_id);
  if (!['approved', 'provider_draft', 'scheduled', 'failed'].includes(content.status)
    || delivery.approved_campaign_version === null
    || delivery.approved_campaign_version !== content.version) {
    throw new DeliveryApprovalChangedError('The delivery content revision is no longer the exact approved revision. Review it before preparing a replacement.');
  }
  const variant = content.variants.find((item) => item.service === delivery.service);
  if (!variant) throw new Error('The approved content does not include this destination channel.');
  const { data: campaignData, error: campaignError } = await database
    .from('cardforge_marketing_campaigns')
    .select('utm_campaign')
    .eq('id', content.marketingCampaignId)
    .limit(1);
  const utmCampaign = campaignData?.[0]?.utm_campaign as string | undefined;
  if (campaignError || !utmCampaign) throw new Error('The marketing campaign tracking key is unavailable.');
  const destinationUrl = content.destinationUrl
    ? buildOrganicCampaignUrl({
      destinationUrl: content.destinationUrl,
      source: delivery.service,
      campaign: utmCampaign,
      content: content.utmContent,
    })
    : '';
  const media = await Promise.all(variant.attachments.map(async (attachment) => ({
    url: await getPublicCampaignMediaUrl(attachment.mediaId, attachment.derivativeId),
    altText: attachment.altText,
  })));
  const accessToken = decryptMarketingToken({
    ciphertext: connection.access_token_ciphertext,
    iv: connection.access_token_iv,
    authTag: connection.access_token_auth_tag,
  });
  const [claim, approval] = await Promise.all([
    database.from('cardforge_social_publish_jobs').select('id')
      .eq('id', delivery.id).eq('claim_token', delivery.claim_token).eq('status', 'publishing'),
    database.from('cardforge_social_campaigns').select('id')
      .eq('id', content.id).eq('version', delivery.approved_campaign_version).eq('status', content.status),
  ]);
  if (claim.error || approval.error) throw new Error('Unable to verify the current delivery approval.');
  if (claim.data?.length !== 1 || approval.data?.length !== 1) {
    throw new DeliveryApprovalChangedError('The delivery claim or approved content changed while preparing publication. Review before retrying.');
  }
  let result;
  try {
    result = await publishToMeta({
      service: delivery.service,
      accountId: destination.external_account_id,
      accessToken,
      text: variant.text,
      destinationUrl,
      media,
    });
  } catch {
    // A rejected promise is not evidence that the provider did not publish.
    // Leave review to the owner instead of repeating a possibly committed post.
    throw new PublicationUnconfirmedError('Meta publication could not be confirmed. Review the destination before retrying.');
  }
  try {
    await finishDelivery(delivery, {
      status: 'published',
      provider_post_id: result.providerPostId,
      publication_url: result.publicationUrl,
      error_message: '',
      next_attempt_at: null,
    });
  } catch (error) {
    throw new PublishedButUnrecordedError(
      error instanceof Error ? error.message : 'Published post could not be recorded.',
      result.providerPostId,
      result.publicationUrl,
    );
  }
  const { data: remaining, error: remainingError } = await database
    .from('cardforge_social_publish_jobs')
    .select('id')
    .eq('campaign_id', content.id)
    .not('status', 'in', '(published,skipped,cancelled)')
    .limit(1);
  if (!remainingError && !remaining?.length) {
    await database.from('cardforge_social_campaigns').update({
      status: 'published',
      version: content.version + 1,
    }).eq('id', content.id).eq('version', content.version);
  }
};

export const dispatchDueMarketingDeliveries = async (limit = 10) => {
  const configuration = getMetaConfiguration();
  if (!configuration.configured || !configuration.publishingEnabled) {
    throw new Error('Native Meta publishing is not enabled.');
  }
  const database = getSupabaseServerClient();
  if (!database) throw new Error('The marketing database is not configured.');
  const workerId = `cardforge:${crypto.randomUUID()}`;
  const { data, error } = await database.rpc('cardforge_claim_due_marketing_deliveries', {
    p_worker_id: workerId,
    p_limit: Math.min(Math.max(limit, 1), 25),
  });
  if (error) throw new Error('Unable to claim due marketing deliveries.');
  const deliveries = (Array.isArray(data) ? data : []) as ClaimedDelivery[];
  const results: Array<{
    id: string;
    status: 'published' | 'failed' | 'unknown';
    providerPostId?: string;
    publicationUrl?: string;
    message?: string;
  }> = [];
  for (const delivery of deliveries) {
    try {
      await dispatchOne(delivery);
      results.push({ id: delivery.id, status: 'published' });
    } catch (error) {
      const mayBePublished = error instanceof PublishedButUnrecordedError;
      const exhausted = mayBePublished || error instanceof PublicationUnconfirmedError
        || error instanceof DeliveryApprovalChangedError || delivery.attempt_count >= 5;
      const delayMinutes = Math.min(360, 2 ** Math.max(delivery.attempt_count, 1) * 5);
      try {
        await finishDelivery(delivery, {
          status: exhausted ? 'unknown' : 'failed',
          provider_post_id: mayBePublished ? error.providerPostId : null,
          publication_url: mayBePublished ? error.publicationUrl : '',
          error_message: error instanceof Error ? error.message.slice(0, 2_000) : 'Meta publication failed.',
          next_attempt_at: exhausted ? null : new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        });
        results.push({ id: delivery.id, status: exhausted ? 'unknown' : 'failed' });
      } catch (finalizationError) {
        // A cancelled/reclaimed job belongs to its current owner. Keep any
        // provider receipt visible without overwriting that newer state.
        results.push({
          id: delivery.id,
          status: 'unknown',
          ...(mayBePublished ? { providerPostId: error.providerPostId, publicationUrl: error.publicationUrl } : {}),
          message: finalizationError instanceof Error ? finalizationError.message : 'Delivery finalization is unavailable. Review before retrying.',
        });
      }
    }
  }
  return { claimed: deliveries.length, results };
};
