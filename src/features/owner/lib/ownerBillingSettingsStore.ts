import {
  MAX_BILLING_HISTORY_LIMIT,
  buildOwnerBillingHistorySettings,
  type OwnerBillingHistorySettings,
} from '@/features/owner/lib/ownerBillingOperations';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

type BillingHistorySettingsRow = {
  billing_checkout_history_limit: number | null;
  billing_checkout_history_cleared_before: string | null;
};

type BillingHistorySettingsResult = {
  data: BillingHistorySettingsRow | null;
  error: unknown;
};

type BillingHistoryMutationResult = {
  error: unknown;
};

export interface OwnerBillingSettingsClient {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<BillingHistorySettingsResult>;
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<BillingHistoryMutationResult>;
    };
  };
}

export class OwnerBillingSettingsStoreError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const getClient = (client?: OwnerBillingSettingsClient): OwnerBillingSettingsClient | null => (
  client
  ?? (getSupabaseServerClient() as unknown as OwnerBillingSettingsClient | null)
);

export const getOwnerBillingHistorySettings = async ({
  client,
  now = new Date(),
}: {
  client?: OwnerBillingSettingsClient;
  now?: Date;
} = {}): Promise<OwnerBillingHistorySettings> => {
  const resolvedClient = getClient(client);
  if (!resolvedClient) return buildOwnerBillingHistorySettings({ now });

  const { data, error } = await resolvedClient
    .from('cardforge_owner_settings')
    .select('billing_checkout_history_limit,billing_checkout_history_cleared_before')
    .eq('id', 'cardforge')
    .maybeSingle();

  if (error) {
    console.error('Failed to load owner billing history settings:', error);
    throw new OwnerBillingSettingsStoreError('Unable to load billing history settings.', 500);
  }

  return buildOwnerBillingHistorySettings({
    limit: data?.billing_checkout_history_limit,
    clearedBefore: data?.billing_checkout_history_cleared_before ?? null,
    now,
  });
};

const parseHistoryLimit = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_BILLING_HISTORY_LIMIT) {
    throw new OwnerBillingSettingsStoreError(
      `Checkout history limit must be a whole number from 1 to ${MAX_BILLING_HISTORY_LIMIT}.`,
      400,
    );
  }
  return parsed;
};

export const updateOwnerBillingHistoryLimit = async ({
  client,
  value,
}: {
  client?: OwnerBillingSettingsClient;
  value: unknown;
}): Promise<number> => {
  const limit = parseHistoryLimit(value);
  const resolvedClient = getClient(client);
  if (!resolvedClient) {
    throw new OwnerBillingSettingsStoreError('Billing history storage is not configured.', 503);
  }

  const { error } = await resolvedClient
    .from('cardforge_owner_settings')
    .update({ billing_checkout_history_limit: limit })
    .eq('id', 'cardforge');

  if (error) {
    console.error('Failed to update owner billing history limit:', error);
    throw new OwnerBillingSettingsStoreError('Unable to save billing history settings.', 500);
  }
  return limit;
};

export const clearOwnerBillingHistory = async ({
  client,
  clearedAt = new Date(),
}: {
  client?: OwnerBillingSettingsClient;
  clearedAt?: Date;
} = {}): Promise<string> => {
  const resolvedClient = getClient(client);
  if (!resolvedClient) {
    throw new OwnerBillingSettingsStoreError('Billing history storage is not configured.', 503);
  }
  const clearedBefore = clearedAt.toISOString();
  const { error } = await resolvedClient
    .from('cardforge_owner_settings')
    .update({ billing_checkout_history_cleared_before: clearedBefore })
    .eq('id', 'cardforge');

  if (error) {
    console.error('Failed to clear owner billing history:', error);
    throw new OwnerBillingSettingsStoreError('Unable to clear displayed billing history.', 500);
  }
  return clearedBefore;
};
