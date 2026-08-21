import {
  DEFAULT_MCP_ALLOWANCES,
  getDefaultMcpAllowance,
  isMcpAvailableForAccount,
  isMcpUsagePlanKey,
  isMeteredMcpToolName,
  resolveMcpUsagePlanKey,
  type McpAccountUsageSummary,
  type McpAllowance,
  type McpOwnerUsageDashboard,
  type McpOwnerUsageSummary,
  type McpUsageAccessContext,
  type McpUsagePlanKey,
} from '@/features/mcp-usage/lib/mcpUsage';
import { getSupabaseServerClient, getSupabaseServerConfigStatus } from '@/infrastructure/database/supabaseServer';

interface UsageObservation {
  actionUnits: number;
  durationMs: number;
  ownerUserId: string;
  requestBytes: number;
  responseBytes: number;
  succeeded: boolean;
  toolName: string;
}

type AccountUsageRow = {
  current_month_start: string | null;
  monthly_action_units: number | null;
  daily_action_units: number | null;
  tool_calls: number | null;
  successful_calls: number | null;
  failed_calls: number | null;
  request_bytes: number | null;
  response_bytes: number | null;
  document_count: number | null;
  document_bytes: number | null;
};

type OwnerUsageRow = Omit<AccountUsageRow, 'daily_action_units'> & {
  active_users: number | null;
  duration_ms: number | null;
};

type AllowanceRow = {
  plan_key: string;
  display_name: string;
  description: string;
  feature_summary: string;
  cta_label: string;
  price_label: string;
  price_note: string;
  is_visible: boolean;
  monthly_action_limit: number;
  daily_safety_limit: number;
  online_storage_limit_bytes: number;
  draft_retention_hours: number;
};

export class McpUsageStoreError extends Error {
  constructor(message: string, public readonly status: 400 | 503 = 503) {
    super(message);
    this.name = 'McpUsageStoreError';
  }
}

const countJsonBytes = (value: unknown): number => {
  try {
    const serialized = JSON.stringify(value);
    return serialized ? Math.min(Buffer.byteLength(serialized, 'utf8'), 1024 * 1024 * 1024) : 0;
  } catch {
    return 0;
  }
};

const toNumber = (value: number | null | undefined): number => Number(value ?? 0);

const toAllowance = (row: AllowanceRow): McpAllowance | null => {
  if (!isMcpUsagePlanKey(row.plan_key)) return null;
  return {
    planKey: row.plan_key,
    displayName: row.display_name,
    description: row.description,
    featureSummary: row.feature_summary,
    ctaLabel: row.cta_label,
    priceLabel: row.price_label,
    priceNote: row.price_note,
    isVisible: row.is_visible,
    monthlyActionLimit: toNumber(row.monthly_action_limit),
    dailySafetyLimit: toNumber(row.daily_safety_limit),
    onlineStorageLimitBytes: toNumber(row.online_storage_limit_bytes),
    draftRetentionHours: toNumber(row.draft_retention_hours),
  };
};

const currentMonthStart = (): string => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
};

export const recordMcpUsageObservation = async (observation: UsageObservation): Promise<boolean> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return false;
  const { error } = await supabase.rpc('cardforge_record_mcp_usage', {
    p_owner_user_id: observation.ownerUserId,
    p_tool_name: observation.toolName,
    p_succeeded: observation.succeeded,
    p_action_units: observation.actionUnits,
    p_request_bytes: observation.requestBytes,
    p_response_bytes: observation.responseBytes,
    p_duration_ms: observation.durationMs,
  });
  if (error) {
    console.error('Failed to record MCP usage observation:', error);
    return false;
  }
  return true;
};

export const observeMcpToolExecution = async <Result>({
  ownerUserId,
  toolName,
  input,
  execute,
  record = recordMcpUsageObservation,
}: {
  ownerUserId: string;
  toolName: string;
  input: unknown;
  execute: () => Promise<Result>;
  record?: (observation: UsageObservation) => Promise<boolean>;
}): Promise<Result> => {
  // Observation writes aggregate usage. Every tool that uses this wrapper must
  // declare readOnlyHint: false even when its product behavior only reads data.
  const startedAt = Date.now();
  const requestBytes = countJsonBytes(input);
  try {
    const result = await execute();
    try {
      await record({
        actionUnits: isMeteredMcpToolName(toolName) ? 1 : 0,
        durationMs: Math.max(0, Date.now() - startedAt),
        ownerUserId,
        requestBytes,
        responseBytes: countJsonBytes(result),
        succeeded: true,
        toolName,
      });
    } catch (error) {
      console.error('MCP usage recorder failed open:', error);
    }
    return result;
  } catch (error) {
    try {
      await record({
        actionUnits: 0,
        durationMs: Math.max(0, Date.now() - startedAt),
        ownerUserId,
        requestBytes,
        responseBytes: 0,
        succeeded: false,
        toolName,
      });
    } catch (recordError) {
      console.error('MCP usage recorder failed open:', recordError);
    }
    throw error;
  }
};

export const getMcpAllowances = async ({ allowFallback = true }: { allowFallback?: boolean } = {}): Promise<McpAllowance[]> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    if (allowFallback) return DEFAULT_MCP_ALLOWANCES;
    throw new McpUsageStoreError('MCP usage controls are not configured.', 503);
  }
  const { data, error } = await supabase
    .from('cardforge_mcp_allowance_settings')
    .select('plan_key,display_name,description,feature_summary,cta_label,price_label,price_note,is_visible,monthly_action_limit,daily_safety_limit,online_storage_limit_bytes,draft_retention_hours')
    .order('monthly_action_limit', { ascending: true });
  if (error) {
    if (allowFallback) {
      if ((error as { code?: string }).code !== 'PGRST205') console.error('Failed to load MCP allowances:', error);
      return DEFAULT_MCP_ALLOWANCES;
    }
    throw new McpUsageStoreError('Unable to load MCP usage allowances.', 503);
  }
  const allowances = (data ?? []).map((row) => toAllowance(row as AllowanceRow)).filter((row): row is McpAllowance => Boolean(row));
  if (allowances.length === DEFAULT_MCP_ALLOWANCES.length) return allowances;
  if (allowFallback) return DEFAULT_MCP_ALLOWANCES;
  throw new McpUsageStoreError('MCP usage allowances are incomplete.', 503);
};

export const getAccountMcpUsageSummary = async (
  access: McpUsageAccessContext,
): Promise<McpAccountUsageSummary> => {
  const planKey = resolveMcpUsagePlanKey({
    accessMode: access.accessMode,
    isOwner: access.isOwner,
    paidPlan: access.paidPlan,
  });
  const allowances = await getMcpAllowances();
  const allowance = allowances.find((candidate) => candidate.planKey === planKey) ?? getDefaultMcpAllowance(planKey);
  const fallback: McpAccountUsageSummary = {
    allowance,
    availablePlans: allowances.filter((candidate) => candidate.isVisible),
    currentMonthStart: currentMonthStart(),
    dailyActionUnits: 0,
    documentBytes: 0,
    documentCount: 0,
    failedCalls: 0,
    mcpAccessAvailable: isMcpAvailableForAccount({ isSignedIn: access.isSignedIn }),
    monthlyActionUnits: 0,
    observationOnly: true,
    requestBytes: 0,
    responseBytes: 0,
    successfulCalls: 0,
    toolCalls: 0,
  };
  if (!access.accountUserId) return fallback;
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return fallback;
  const { data, error } = await supabase.rpc('cardforge_get_mcp_account_usage', {
    p_owner_user_id: access.accountUserId,
  });
  if (error) {
    if ((error as { code?: string }).code !== 'PGRST202') console.error('Failed to load account MCP usage:', error);
    return fallback;
  }
  const row = (Array.isArray(data) ? data[0] : data) as AccountUsageRow | undefined;
  if (!row) return fallback;
  return {
    ...fallback,
    currentMonthStart: row.current_month_start ?? fallback.currentMonthStart,
    dailyActionUnits: toNumber(row.daily_action_units),
    documentBytes: toNumber(row.document_bytes),
    documentCount: toNumber(row.document_count),
    failedCalls: toNumber(row.failed_calls),
    monthlyActionUnits: toNumber(row.monthly_action_units),
    requestBytes: toNumber(row.request_bytes),
    responseBytes: toNumber(row.response_bytes),
    successfulCalls: toNumber(row.successful_calls),
    toolCalls: toNumber(row.tool_calls),
  };
};

const emptyOwnerSummary = (): McpOwnerUsageSummary => ({
  activeUsers: 0,
  currentMonthStart: currentMonthStart(),
  documentBytes: 0,
  documentCount: 0,
  durationMs: 0,
  failedCalls: 0,
  monthlyActionUnits: 0,
  requestBytes: 0,
  responseBytes: 0,
  successfulCalls: 0,
  toolCalls: 0,
});

export const getOwnerMcpUsageDashboard = async (): Promise<McpOwnerUsageDashboard> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    throw new McpUsageStoreError('MCP usage controls are not configured.', 503);
  }
  const [allowances, summary] = await Promise.all([
    getMcpAllowances({ allowFallback: false }),
    (async (): Promise<McpOwnerUsageSummary> => {
      const { data, error } = await supabase.rpc('cardforge_get_mcp_owner_usage');
      if (error) {
        throw new McpUsageStoreError('Unable to load MCP usage totals.', 503);
      }
      const row = (Array.isArray(data) ? data[0] : data) as OwnerUsageRow | undefined;
      return row ? {
        activeUsers: toNumber(row.active_users),
        currentMonthStart: row.current_month_start ?? currentMonthStart(),
        documentBytes: toNumber(row.document_bytes),
        documentCount: toNumber(row.document_count),
        durationMs: toNumber(row.duration_ms),
        failedCalls: toNumber(row.failed_calls),
        monthlyActionUnits: toNumber(row.monthly_action_units),
        requestBytes: toNumber(row.request_bytes),
        responseBytes: toNumber(row.response_bytes),
        successfulCalls: toNumber(row.successful_calls),
        toolCalls: toNumber(row.tool_calls),
      } : emptyOwnerSummary();
    })(),
  ]);
  return { allowances, observationOnly: true, summary };
};

export const updateMcpAllowance = async ({
  planKey,
  displayName,
  description,
  featureSummary,
  ctaLabel,
  priceLabel,
  priceNote,
  isVisible,
  monthlyActionLimit,
  dailySafetyLimit,
  onlineStorageLimitBytes,
  draftRetentionHours,
}: {
  planKey: McpUsagePlanKey;
  displayName: string;
  description: string;
  featureSummary: string;
  ctaLabel: string;
  priceLabel: string;
  priceNote: string;
  isVisible: boolean;
  monthlyActionLimit: number;
  dailySafetyLimit: number;
  onlineStorageLimitBytes: number;
  draftRetentionHours: number;
}): Promise<McpOwnerUsageDashboard> => {
  const normalizedDisplayName = displayName.trim();
  const normalizedDescription = description.trim();
  const normalizedFeatureSummary = featureSummary.trim();
  const normalizedCtaLabel = ctaLabel.trim();
  const normalizedPriceLabel = priceLabel.trim();
  const normalizedPriceNote = priceNote.trim();
  if (normalizedDisplayName.length < 1 || normalizedDisplayName.length > 80
    || normalizedDescription.length < 1 || normalizedDescription.length > 600
    || normalizedFeatureSummary.length < 1 || normalizedFeatureSummary.length > 1_200
    || normalizedCtaLabel.length < 1 || normalizedCtaLabel.length > 80
    || normalizedPriceLabel.length < 1 || normalizedPriceLabel.length > 40
    || normalizedPriceNote.length < 1 || normalizedPriceNote.length > 80
    || typeof isVisible !== 'boolean'
    || !Number.isInteger(monthlyActionLimit) || monthlyActionLimit < 0 || monthlyActionLimit > 1_000_000
    || !Number.isInteger(dailySafetyLimit) || dailySafetyLimit < 0 || dailySafetyLimit > 100_000
    || !Number.isSafeInteger(onlineStorageLimitBytes) || onlineStorageLimitBytes < 0 || onlineStorageLimitBytes > 100 * 1024 ** 4
    || !Number.isInteger(draftRetentionHours) || draftRetentionHours < 1 || draftRetentionHours > 24 * 365) {
    throw new McpUsageStoreError('Usage allowances must be whole numbers within the supported range.', 400);
  }
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    throw new McpUsageStoreError('MCP usage controls are not configured.', 503);
  }
  const { data, error } = await supabase
    .from('cardforge_mcp_allowance_settings')
    .update({
      display_name: normalizedDisplayName,
      description: normalizedDescription,
      feature_summary: normalizedFeatureSummary,
      cta_label: normalizedCtaLabel,
      price_label: normalizedPriceLabel,
      price_note: normalizedPriceNote,
      is_visible: isVisible,
      monthly_action_limit: monthlyActionLimit,
      daily_safety_limit: dailySafetyLimit,
      online_storage_limit_bytes: onlineStorageLimitBytes,
      draft_retention_hours: draftRetentionHours,
      updated_at: new Date().toISOString(),
    })
    .eq('plan_key', planKey)
    .select('plan_key')
    .maybeSingle();
  if (error || !data) throw new McpUsageStoreError('Unable to update MCP usage allowances.', 503);
  return getOwnerMcpUsageDashboard();
};
