import type { OwnerDatabaseMetrics } from '@/features/owner/lib/ownerConsole';
import { getSupabaseServerClient, getSupabaseServerConfigStatus } from '@/infrastructure/database/supabaseServer';

type DatabaseMetricsRow = {
  database_size_bytes: number | null;
  cardforge_table_size_bytes: number | null;
  storage_size_bytes: number | null;
  asset_registry_count: number | null;
  developer_submission_count: number | null;
};

export const getOwnerDatabaseMetrics = async (): Promise<OwnerDatabaseMetrics | null> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return null;
  const { data, error } = await supabase.rpc('cardforge_database_metrics');
  if (error) {
    if ((error as { code?: string }).code !== 'PGRST202') console.error('Failed to load owner database metrics:', error);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as DatabaseMetricsRow | undefined;
  return row ? {
    databaseSizeBytes: Number(row.database_size_bytes ?? 0),
    cardforgeTableSizeBytes: Number(row.cardforge_table_size_bytes ?? 0),
    storageSizeBytes: Number(row.storage_size_bytes ?? 0),
    assetRegistryCount: Number(row.asset_registry_count ?? 0),
    developerSubmissionCount: Number(row.developer_submission_count ?? 0),
  } : null;
};
