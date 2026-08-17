import {
  DEFAULT_MARKETING_STRATEGY,
  normalizeMarketingCampaignInput,
  normalizeMarketingStrategyInput,
  type MarketingCampaign,
  type MarketingCommandCenterView,
  type MarketingStrategyRecord,
} from '@/features/marketing/model';
import { getMarketingDistributionView } from '@/features/marketing-distribution/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

export class MarketingStoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

type StrategyRow = {
  primary_audience: MarketingStrategyRecord['primaryAudience'];
  validation_audience: MarketingStrategyRecord['validationAudience'];
  positioning: string;
  offer: string;
  default_call_to_action: string;
  enabled_pillars: unknown;
  approved_claims: unknown;
  prohibited_claims: unknown;
  version: number;
  updated_by: string | null;
  updated_at: string;
};

type CampaignRow = {
  id: string;
  created_by: string;
  name: string;
  objective: string;
  audience_key: MarketingCampaign['audienceKey'];
  offer: string;
  status: MarketingCampaign['status'];
  starts_on: string | null;
  ends_on: string | null;
  success_metric: string;
  utm_campaign: string;
  version: number;
  created_at: string;
  updated_at: string;
};

const STRATEGY_COLUMNS = 'primary_audience,validation_audience,positioning,offer,default_call_to_action,enabled_pillars,approved_claims,prohibited_claims,version,updated_by,updated_at';
const CAMPAIGN_COLUMNS = 'id,created_by,name,objective,audience_key,offer,status,starts_on,ends_on,success_metric,utm_campaign,version,created_at,updated_at';

const stringArray = (value: unknown): string[] => (
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
);

const requireDatabase = () => {
  const database = getSupabaseServerClient();
  if (!database) throw new MarketingStoreError('The marketing database is not configured.', 503);
  return database;
};

const throwDatabaseError = (message: string, error: unknown): never => {
  console.error(message, error);
  throw new MarketingStoreError(message);
};

const mapStrategy = (row?: StrategyRow): MarketingStrategyRecord => ({
  ...(row ? {
    primaryAudience: row.primary_audience,
    validationAudience: row.validation_audience,
    positioning: row.positioning,
    offer: row.offer,
    defaultCallToAction: row.default_call_to_action,
    enabledPillars: stringArray(row.enabled_pillars) as MarketingStrategyRecord['enabledPillars'],
    approvedClaims: stringArray(row.approved_claims),
    prohibitedClaims: stringArray(row.prohibited_claims),
  } : DEFAULT_MARKETING_STRATEGY),
  version: row?.version ?? 1,
  updatedBy: row?.updated_by ?? null,
  updatedAt: row?.updated_at ?? new Date(0).toISOString(),
});

const mapCampaign = (row: CampaignRow): MarketingCampaign => ({
  id: row.id,
  createdBy: row.created_by,
  name: row.name,
  objective: row.objective,
  audienceKey: row.audience_key,
  offer: row.offer,
  status: row.status,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  successMetric: row.success_metric,
  utmCampaign: row.utm_campaign,
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const getMarketingCommandCenterView = async (): Promise<MarketingCommandCenterView> => {
  const database = requireDatabase();
  const [strategyResult, campaignResult, distribution] = await Promise.all([
    database.from('cardforge_marketing_strategy').select(STRATEGY_COLUMNS).eq('id', 'cardforge').limit(1),
    database.from('cardforge_marketing_campaigns').select(CAMPAIGN_COLUMNS).order('updated_at', { ascending: false }),
    getMarketingDistributionView(),
  ]);
  const error = strategyResult.error ?? campaignResult.error;
  if (error) throwDatabaseError('Unable to load the marketing command center.', error);
  return {
    configured: distribution.configured,
    strategy: mapStrategy(strategyResult.data?.[0] as StrategyRow | undefined),
    campaigns: (campaignResult.data ?? []).map((row) => mapCampaign(row as CampaignRow)),
    destinations: distribution.destinations,
    connections: distribution.connections,
    meta: distribution.meta,
  };
};

export const getMarketingContributorContext = async () => {
  try {
    const database = requireDatabase();
    const [strategyResult, campaignResult] = await Promise.all([
      database.from('cardforge_marketing_strategy').select(STRATEGY_COLUMNS).eq('id', 'cardforge').limit(1),
      database.from('cardforge_marketing_campaigns').select(CAMPAIGN_COLUMNS).in('status', ['planning', 'active']).order('updated_at', { ascending: false }),
    ]);
    const error = strategyResult.error ?? campaignResult.error;
    if (error) throwDatabaseError('Unable to load contributor marketing context.', error);
    return {
      strategy: mapStrategy(strategyResult.data?.[0] as StrategyRow | undefined),
      campaigns: (campaignResult.data ?? []).map((row) => mapCampaign(row as CampaignRow)),
    };
  } catch (error) {
    console.error('Marketing contributor context is unavailable:', error);
    return { strategy: mapStrategy(), campaigns: [] as MarketingCampaign[] };
  }
};

export const updateMarketingStrategy = async (
  actorId: string,
  expectedVersion: unknown,
  input: Record<string, unknown>,
): Promise<MarketingStrategyRecord> => {
  const normalized = normalizeMarketingStrategyInput(input);
  if (!normalized.ok) throw new MarketingStoreError(normalized.message, 400);
  const version = Number(expectedVersion);
  if (!Number.isInteger(version) || version < 1) {
    throw new MarketingStoreError('A valid strategy version is required.', 400);
  }
  const value = normalized.value;
  const { data, error } = await requireDatabase()
    .from('cardforge_marketing_strategy')
    .update({
      primary_audience: value.primaryAudience,
      validation_audience: value.validationAudience,
      positioning: value.positioning,
      offer: value.offer,
      default_call_to_action: value.defaultCallToAction,
      enabled_pillars: value.enabledPillars,
      approved_claims: value.approvedClaims,
      prohibited_claims: value.prohibitedClaims,
      updated_by: actorId,
      version: version + 1,
    })
    .eq('id', 'cardforge')
    .eq('version', version)
    .select(STRATEGY_COLUMNS)
    .limit(1);
  if (error) throwDatabaseError('Unable to update the marketing strategy.', error);
  if (!data?.[0]) {
    throw new MarketingStoreError('The strategy changed elsewhere. Reload before saving.', 409);
  }
  return mapStrategy(data[0] as StrategyRow);
};

export const saveMarketingCampaign = async (
  actorId: string,
  input: Record<string, unknown>,
  campaignId?: string,
  expectedVersion?: unknown,
): Promise<MarketingCampaign> => {
  const normalized = normalizeMarketingCampaignInput(input);
  if (!normalized.ok) throw new MarketingStoreError(normalized.message, 400);
  const value = normalized.value;
  const row = {
    name: value.name,
    objective: value.objective,
    audience_key: value.audienceKey,
    offer: value.offer,
    status: value.status,
    starts_on: value.startsOn,
    ends_on: value.endsOn,
    success_metric: value.successMetric,
    utm_campaign: value.utmCampaign,
  };
  const database = requireDatabase();
  const version = Number(expectedVersion);
  if (campaignId && (!Number.isInteger(version) || version < 1)) {
    throw new MarketingStoreError('A valid campaign version is required.', 400);
  }
  const result = campaignId
    ? await database.from('cardforge_marketing_campaigns').update({ ...row, version: version + 1 }).eq('id', campaignId).eq('version', version).select(CAMPAIGN_COLUMNS).limit(1)
    : await database.from('cardforge_marketing_campaigns').insert({ ...row, created_by: actorId }).select(CAMPAIGN_COLUMNS).limit(1);
  if (result.error) throwDatabaseError('Unable to save the marketing campaign.', result.error);
  if (!result.data?.[0]) {
    throw new MarketingStoreError('The campaign changed elsewhere. Reload before saving.', 409);
  }
  return mapCampaign(result.data[0] as CampaignRow);
};
