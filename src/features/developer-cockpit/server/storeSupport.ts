import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

export class DeveloperCockpitStoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

export const requireCockpitDatabase = () => {
  const database = getSupabaseServerClient();
  if (!database) {
    throw new DeveloperCockpitStoreError(
      'The contribution cockpit database is not configured yet.',
      503,
    );
  }
  return database;
};

export const cleanReviewNote = (value: unknown): string => (
  typeof value === 'string'
    ? value.trim().replace(/\r\n/gu, '\n').slice(0, 1_200)
    : ''
);

export const normalizeExpectedVersion = (value: unknown): number => {
  const version = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(version) || version < 1) {
    throw new DeveloperCockpitStoreError(
      'A valid contribution version is required.',
      400,
    );
  }
  return version;
};

export const throwCockpitDatabaseError = (
  message: string,
  error: unknown,
): never => {
  console.error(message, error);
  throw new DeveloperCockpitStoreError(message);
};
