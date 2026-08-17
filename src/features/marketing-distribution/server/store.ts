import {
  normalizeMarketingDestinationInput,
  type MarketingConnectionSummary,
  type MarketingDestination,
  type MarketingDistributionView,
} from '@/features/marketing-distribution/model';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { getMetaConfiguration } from './metaConnection';

export class MarketingDistributionStoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

type DestinationRow = {
  id: string;
  name: string;
  service: MarketingDestination['service'];
  kind: MarketingDestination['kind'];
  provider: MarketingDestination['provider'];
  publishing_mode: MarketingDestination['publishingMode'];
  external_account_id: string;
  url: string;
  rules_url: string;
  rules_summary: string;
  posting_guidance: string;
  audience_keys: unknown;
  active: boolean;
  rules_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

type ConnectionRow = {
  id: string;
  provider: MarketingConnectionSummary['provider'];
  service: MarketingConnectionSummary['service'];
  external_account_id: string;
  display_name: string;
  granted_scopes: unknown;
  expires_at: string | null;
  status: MarketingConnectionSummary['status'];
  status_note: string;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

const DESTINATION_COLUMNS = 'id,name,service,kind,provider,publishing_mode,external_account_id,url,rules_url,rules_summary,posting_guidance,audience_keys,active,rules_checked_at,created_at,updated_at';
const CONNECTION_COLUMNS = 'id,provider,service,external_account_id,display_name,granted_scopes,expires_at,status,status_note,last_verified_at,created_at,updated_at';

const stringArray = (value: unknown): string[] => (
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
);

const requireDatabase = () => {
  const database = getSupabaseServerClient();
  if (!database) {
    throw new MarketingDistributionStoreError(
      'The marketing distribution database is not configured.',
      503,
    );
  }
  return database;
};

const throwDatabaseError = (message: string, error: unknown): never => {
  console.error(message, error);
  throw new MarketingDistributionStoreError(message);
};

const mapDestination = (row: DestinationRow): MarketingDestination => ({
  id: row.id,
  name: row.name,
  service: row.service,
  kind: row.kind,
  provider: row.provider,
  publishingMode: row.publishing_mode,
  externalAccountId: row.external_account_id,
  url: row.url,
  rulesUrl: row.rules_url,
  rulesSummary: row.rules_summary,
  postingGuidance: row.posting_guidance,
  audienceKeys: stringArray(row.audience_keys) as MarketingDestination['audienceKeys'],
  active: row.active,
  rulesCheckedAt: row.rules_checked_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapConnection = (row: ConnectionRow): MarketingConnectionSummary => ({
  id: row.id,
  provider: row.provider,
  service: row.service,
  externalAccountId: row.external_account_id,
  displayName: row.display_name,
  grantedScopes: stringArray(row.granted_scopes),
  expiresAt: row.expires_at,
  status: row.status,
  statusNote: row.status_note,
  lastVerifiedAt: row.last_verified_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const getMarketingDistributionView = async (): Promise<MarketingDistributionView> => {
  const database = requireDatabase();
  const [destinationResult, connectionResult] = await Promise.all([
    database.from('cardforge_marketing_destinations').select(DESTINATION_COLUMNS).order('name'),
    database.from('cardforge_marketing_connections').select(CONNECTION_COLUMNS).order('display_name'),
  ]);
  const error = destinationResult.error ?? connectionResult.error;
  if (error) throwDatabaseError('Unable to load marketing distribution.', error);
  const configuration = getMetaConfiguration();
  return {
    configured: true,
    destinations: (destinationResult.data ?? []).map((row) => mapDestination(row as DestinationRow)),
    connections: (connectionResult.data ?? []).map((row) => mapConnection(row as ConnectionRow)),
    meta: {
      configured: configuration.configured,
      publishingEnabled: configuration.publishingEnabled,
      missing: configuration.missing,
    },
  };
};

export const saveMarketingDestination = async (
  actorId: string,
  input: Record<string, unknown>,
  destinationId?: string,
): Promise<MarketingDestination> => {
  const normalized = normalizeMarketingDestinationInput(input);
  if (!normalized.ok) {
    throw new MarketingDistributionStoreError(normalized.message, 400);
  }
  const value = normalized.value;
  const row = {
    name: value.name,
    service: value.service,
    kind: value.kind,
    provider: value.provider,
    publishing_mode: value.publishingMode,
    external_account_id: value.externalAccountId,
    url: value.url,
    rules_url: value.rulesUrl,
    rules_summary: value.rulesSummary,
    posting_guidance: value.postingGuidance,
    audience_keys: value.audienceKeys,
    active: value.active,
    rules_checked_at: value.kind === 'community' ? new Date().toISOString() : null,
  };
  const database = requireDatabase();
  const result = destinationId
    ? await database.from('cardforge_marketing_destinations').update(row).eq('id', destinationId).select(DESTINATION_COLUMNS).limit(1)
    : await database.from('cardforge_marketing_destinations').insert({ ...row, created_by: actorId }).select(DESTINATION_COLUMNS).limit(1);
  if (result.error) throwDatabaseError('Unable to save the marketing destination.', result.error);
  if (!result.data?.[0]) {
    throw new MarketingDistributionStoreError('Marketing destination not found.', 404);
  }
  return mapDestination(result.data[0] as DestinationRow);
};

export const queueMarketingDelivery = async ({
  contentId,
  destinationId,
  scheduledFor,
}: {
  contentId: string;
  destinationId: string;
  scheduledFor?: unknown;
}) => {
  const database = requireDatabase();
  const [contentResult, destinationResult] = await Promise.all([
    database.from('cardforge_social_campaigns').select('id,status,variants').eq('id', contentId).limit(1),
    database.from('cardforge_marketing_destinations').select('id,service,provider,publishing_mode,external_account_id,url,active').eq('id', destinationId).limit(1),
  ]);
  const error = contentResult.error ?? destinationResult.error;
  if (error) throwDatabaseError('Unable to validate the marketing delivery.', error);
  const content = contentResult.data?.[0] as {
    id?: string;
    status?: string;
    variants?: unknown;
  } | undefined;
  const destination = destinationResult.data?.[0] as {
    id?: string;
    service?: MarketingDestination['service'];
    provider?: MarketingDestination['provider'];
    publishing_mode?: MarketingDestination['publishingMode'];
    external_account_id?: string;
    url?: string;
    active?: boolean;
  } | undefined;
  if (!content?.id || !['approved', 'provider_draft', 'scheduled', 'failed'].includes(content.status ?? '')) {
    throw new MarketingDistributionStoreError(
      'Only owner-approved content can be prepared for delivery.',
      409,
    );
  }
  if (!destination?.id || !destination.active || !destination.service) {
    throw new MarketingDistributionStoreError('Choose an active marketing destination.', 400);
  }
  const variants = Array.isArray(content.variants)
    ? content.variants as Array<{ service?: string }>
    : [];
  if (!variants.some((variant) => variant.service === destination.service)) {
    throw new MarketingDistributionStoreError(
      `This content has no ${destination.service} variant.`,
      400,
    );
  }
  const scheduleInput = typeof scheduledFor === 'string' ? scheduledFor.trim() : '';
  const dueAt = scheduleInput ? new Date(scheduleInput) : null;
  if (dueAt && !Number.isFinite(dueAt.getTime())) {
    throw new MarketingDistributionStoreError('Choose a valid delivery time.', 400);
  }
  const deliveryMode = destination.publishing_mode ?? 'manual';
  const automaticDueAt = deliveryMode === 'automatic' ? dueAt ?? new Date() : dueAt;
  const status = automaticDueAt ? 'scheduled' : 'ready';
  const providerChannelId = destination.external_account_id || destination.url || destination.id;
  const { data, error: insertError } = await database
    .from('cardforge_social_publish_jobs')
    .upsert({
      campaign_id: content.id,
      destination_id: destination.id,
      provider: destination.provider ?? 'manual',
      service: destination.service,
      provider_channel_id: providerChannelId,
      status,
      scheduled_for: automaticDueAt?.toISOString() ?? null,
      delivery_mode: deliveryMode,
      idempotency_key: `${content.id}:${destination.id}`,
      error_message: '',
    }, {
      onConflict: 'campaign_id,provider_channel_id',
      ignoreDuplicates: true,
    })
    .select('id,status')
    .limit(1);
  if (insertError) throwDatabaseError('Unable to queue the marketing delivery.', insertError);
  if (data?.[0]?.id) {
    return { id: data[0].id as string, status: data[0].status as string };
  }
  const { data: existingData, error: existingError } = await database
    .from('cardforge_social_publish_jobs')
    .select('id,status')
    .eq('campaign_id', content.id)
    .eq('provider_channel_id', providerChannelId)
    .limit(1);
  const existing = existingData?.[0];
  if (existingError) {
    throwDatabaseError(
      'Unable to confirm the existing marketing delivery.',
      existingError,
    );
  }
  if (!existing?.id) {
    throw new MarketingDistributionStoreError(
      'Unable to confirm the existing marketing delivery.',
      503,
    );
  }
  return {
    id: existing.id as string,
    status: existing.status as string,
  };
};

export const completeManualMarketingDelivery = async (
  deliveryId: string,
  publicationUrl: unknown,
  manualNote: unknown,
) => {
  const normalizedUrl = typeof publicationUrl === 'string' ? publicationUrl.trim() : '';
  if (normalizedUrl) {
    try {
      const url = new URL(normalizedUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol');
    } catch {
      throw new MarketingDistributionStoreError(
        'Publication link must use HTTP or HTTPS.',
        400,
      );
    }
  }
  const database = requireDatabase();
  const { data, error } = await database
    .from('cardforge_social_publish_jobs')
    .update({
      status: 'published',
      publication_url: normalizedUrl,
      manual_note: typeof manualNote === 'string' ? manualNote.trim().slice(0, 2_000) : '',
      last_checked_at: new Date().toISOString(),
    })
    .eq('id', deliveryId)
    .eq('delivery_mode', 'manual')
    .select('id,campaign_id')
    .limit(1);
  if (error) throwDatabaseError('Unable to complete the manual delivery.', error);
  const completed = data?.[0] as { id?: string; campaign_id?: string } | undefined;
  if (!completed?.id || !completed.campaign_id) {
    throw new MarketingDistributionStoreError('Manual delivery not found.', 404);
  }
  const { data: remaining, error: remainingError } = await database
    .from('cardforge_social_publish_jobs')
    .select('id')
    .eq('campaign_id', completed.campaign_id)
    .not('status', 'in', '(published,skipped,cancelled)')
    .limit(1);
  if (remainingError) throwDatabaseError('Unable to finalize the published content.', remainingError);
  if (!remaining?.length) {
    const { data: contentRows, error: contentError } = await database
      .from('cardforge_social_campaigns')
      .select('version')
      .eq('id', completed.campaign_id)
      .limit(1);
    if (contentError) throwDatabaseError('Unable to finalize the published content.', contentError);
    const version = Number(contentRows?.[0]?.version);
    if (Number.isInteger(version) && version > 0) {
      const { error: publishError } = await database
        .from('cardforge_social_campaigns')
        .update({ status: 'published', version: version + 1 })
        .eq('id', completed.campaign_id)
        .eq('version', version);
      if (publishError) throwDatabaseError('Unable to finalize the published content.', publishError);
    }
  }
  return { id: completed.id, status: 'published' as const };
};
