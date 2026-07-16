import {
  DEFAULT_BUSINESS_IDENTITY,
  validateBusinessIdentityWrite,
  type BusinessIdentity,
  type BusinessIdentityWriteErrors,
} from '@/features/business-identity/client';
import { isMissingSupabaseTableError } from '@/infrastructure/database/supabaseErrors';
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';

const BUSINESS_IDENTITY_ID = 'cardforge';
const MAX_IDENTITY_VERSION = 2_147_483_647;
const BUSINESS_IDENTITY_COLUMNS = [
  'id',
  'identity_version',
  'brand_name',
  'legal_operator_name',
  'entity_type',
  'jurisdiction_state',
  'jurisdiction_country',
  'assumed_business_name_status',
  'support_email',
  'legal_email',
  'support_phone',
  'website_url',
  'effective_date',
  'copyright_holder',
].join(',');

type BusinessIdentityRow = {
  id: string;
  identity_version: number;
  brand_name: string;
  legal_operator_name: string;
  entity_type: string;
  jurisdiction_state: string;
  jurisdiction_country: string;
  assumed_business_name_status: string;
  support_email: string;
  legal_email: string;
  support_phone: string | null;
  website_url: string;
  effective_date: string;
  copyright_holder: string;
};

type BusinessIdentityQueryResult = {
  data: unknown;
  error: unknown;
};

type BusinessIdentityReadTable = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<BusinessIdentityQueryResult>;
    };
  };
};

type BusinessIdentityWriteTable = {
  update: (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: number) => {
        select: (columns: string) => {
          maybeSingle: () => Promise<BusinessIdentityQueryResult>;
        };
      };
    };
  };
};

export interface BusinessIdentityStoreClient {
  from: (table: string) => BusinessIdentityReadTable | BusinessIdentityWriteTable;
}

export interface BusinessIdentityStoreDependencies {
  configured?: boolean;
  client?: BusinessIdentityStoreClient | null;
}

export class BusinessIdentityStoreError extends Error {
  override readonly name = 'BusinessIdentityStoreError';

  constructor(
    message: string,
    public readonly status = 500,
    public readonly fieldErrors?: BusinessIdentityWriteErrors,
  ) {
    super(message);
  }
}

type ResolvedDependencies = {
  configured: boolean;
  client: BusinessIdentityStoreClient | null;
};

type LoadedBusinessIdentity = {
  value: BusinessIdentity;
  exists: boolean;
  storageReady: boolean;
};

const resolveDependencies = (
  dependencies: BusinessIdentityStoreDependencies,
): ResolvedDependencies => ({
  configured:
    dependencies.configured
    ?? getSupabaseServerConfigStatus().configured,
  client:
    dependencies.client === undefined
      ? getSupabaseServerClient() as unknown as BusinessIdentityStoreClient | null
      : dependencies.client,
});

const asRecord = (value: unknown): Record<string, unknown> | null => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const hasOwn = (value: Record<string, unknown>, key: string): boolean => (
  Object.prototype.hasOwnProperty.call(value, key)
);

function malformedStorage(): never {
  throw new BusinessIdentityStoreError(
    'Business identity storage returned malformed data.',
  );
}

const mapBusinessIdentityRow = (value: unknown): BusinessIdentity => {
  const row = asRecord(value);
  if (!row || row.id !== BUSINESS_IDENTITY_ID) malformedStorage();

  const stringFields = [
    'brand_name',
    'legal_operator_name',
    'entity_type',
    'jurisdiction_state',
    'jurisdiction_country',
    'assumed_business_name_status',
    'support_email',
    'legal_email',
    'website_url',
    'effective_date',
    'copyright_holder',
  ] as const;
  if (stringFields.some((field) => !hasOwn(row, field) || typeof row[field] !== 'string')) {
    malformedStorage();
  }
  if (
    !hasOwn(row, 'support_phone')
    || (row.support_phone !== null && typeof row.support_phone !== 'string')
  ) {
    malformedStorage();
  }
  if (
    !Number.isSafeInteger(row.identity_version)
    || (row.identity_version as number) < 1
    || (row.identity_version as number) > MAX_IDENTITY_VERSION
  ) {
    malformedStorage();
  }

  const validated = validateBusinessIdentityWrite({
    brandName: row.brand_name,
    legalOperatorName: row.legal_operator_name,
    entityType: row.entity_type,
    jurisdictionState: row.jurisdiction_state,
    jurisdictionCountry: row.jurisdiction_country,
    assumedBusinessNameStatus: row.assumed_business_name_status,
    supportEmail: row.support_email,
    legalEmail: row.legal_email,
    ...(row.support_phone === null ? {} : { supportPhone: row.support_phone }),
    websiteUrl: row.website_url,
    effectiveDate: row.effective_date,
    copyrightHolder: row.copyright_holder,
  });
  if (!validated.ok) malformedStorage();

  return {
    ...validated.value,
    identityVersion: row.identity_version as number,
  };
};

const loadBusinessIdentity = async (
  dependencies: ResolvedDependencies,
): Promise<LoadedBusinessIdentity> => {
  if (!dependencies.configured || !dependencies.client) {
    return {
      value: { ...DEFAULT_BUSINESS_IDENTITY },
      exists: false,
      storageReady: false,
    };
  }

  const table = dependencies.client.from('cardforge_business_identity') as BusinessIdentityReadTable;
  const { data, error } = await table
    .select(BUSINESS_IDENTITY_COLUMNS)
    .eq('id', BUSINESS_IDENTITY_ID)
    .maybeSingle();

  if (error) {
    if (isMissingSupabaseTableError(error)) {
      return {
        value: { ...DEFAULT_BUSINESS_IDENTITY },
        exists: false,
        storageReady: false,
      };
    }
    throw new BusinessIdentityStoreError('Unable to load business identity.');
  }

  return {
    value: mapBusinessIdentityRow(data),
    exists: true,
    storageReady: true,
  };
};

const toBusinessIdentityRow = (
  identity: Readonly<BusinessIdentity>,
): Omit<BusinessIdentityRow, 'id' | 'identity_version'> => ({
  brand_name: identity.brandName,
  legal_operator_name: identity.legalOperatorName,
  entity_type: identity.entityType,
  jurisdiction_state: identity.jurisdictionState,
  jurisdiction_country: identity.jurisdictionCountry,
  assumed_business_name_status: identity.assumedBusinessNameStatus,
  support_email: identity.supportEmail,
  legal_email: identity.legalEmail,
  support_phone: identity.supportPhone ?? null,
  website_url: identity.websiteUrl,
  effective_date: identity.effectiveDate,
  copyright_holder: identity.copyrightHolder,
});

const firstWriteError = (errors: BusinessIdentityWriteErrors): string => (
  Object.values(errors).find((message): message is string => Boolean(message))
  ?? 'Business identity update is invalid.'
);

export const getBusinessIdentity = async (
  dependencies: BusinessIdentityStoreDependencies = {},
): Promise<BusinessIdentity> => {
  const loaded = await loadBusinessIdentity(resolveDependencies(dependencies));
  return loaded.value;
};

export const updateBusinessIdentity = async (
  input: unknown,
  expectedIdentityVersion: unknown,
  dependencies: BusinessIdentityStoreDependencies = {},
): Promise<BusinessIdentity> => {
  const initialValidation = validateBusinessIdentityWrite(input);
  if (!initialValidation.ok) {
    throw new BusinessIdentityStoreError(
      firstWriteError(initialValidation.errors),
      400,
      initialValidation.errors,
    );
  }
  if (
    !Number.isSafeInteger(expectedIdentityVersion)
    || (expectedIdentityVersion as number) < 1
    || (expectedIdentityVersion as number) > MAX_IDENTITY_VERSION
  ) {
    throw new BusinessIdentityStoreError(
      'Expected identity version must be a positive integer.',
      400,
    );
  }

  const resolvedDependencies = resolveDependencies(dependencies);
  if (!resolvedDependencies.configured || !resolvedDependencies.client) {
    throw new BusinessIdentityStoreError('Business identity database is not configured yet.', 503);
  }

  const loaded = await loadBusinessIdentity(resolvedDependencies);
  if (!loaded.storageReady) {
    throw new BusinessIdentityStoreError(
      'Business identity storage is not ready. Apply the prepared database migration first.',
      503,
    );
  }
  if (loaded.exists && loaded.value.identityVersion >= MAX_IDENTITY_VERSION) {
    throw new BusinessIdentityStoreError(
      'Business identity version cannot be incremented further.',
      409,
    );
  }
  if (loaded.value.identityVersion !== expectedIdentityVersion) {
    throw new BusinessIdentityStoreError(
      'Business identity changed since it was loaded. Refresh and try again.',
      409,
    );
  }

  const inputRecord = asRecord(input);
  if (
    inputRecord
    && hasOwn(inputRecord, 'assumedBusinessNameStatus')
    && inputRecord.assumedBusinessNameStatus !== loaded.value.assumedBusinessNameStatus
  ) {
    throw new BusinessIdentityStoreError(
      'Assumed business name status requires documented external verification and a separate reviewed update.',
      400,
      {
        assumedBusinessNameStatus: 'Assumed business name status cannot be changed in the owner console.',
      },
    );
  }

  const validated = validateBusinessIdentityWrite(input, loaded.value);
  if (!validated.ok) {
    throw new BusinessIdentityStoreError(
      firstWriteError(validated.errors),
      400,
      validated.errors,
    );
  }

  const table = resolvedDependencies.client.from('cardforge_business_identity') as BusinessIdentityWriteTable;
  const { data, error } = await table
    .update(toBusinessIdentityRow(validated.value))
    .eq('id', BUSINESS_IDENTITY_ID)
    .eq('identity_version', expectedIdentityVersion as number)
    .select(BUSINESS_IDENTITY_COLUMNS)
    .maybeSingle();

  if (error) {
    if (isMissingSupabaseTableError(error)) {
      throw new BusinessIdentityStoreError(
        'Business identity storage is not ready. Apply the prepared database migration first.',
        503,
      );
    }
    throw new BusinessIdentityStoreError('Unable to update business identity.');
  }
  if (!data) {
    throw new BusinessIdentityStoreError(
      'Business identity changed since it was loaded. Refresh and try again.',
      409,
    );
  }

  const updated = mapBusinessIdentityRow(data);
  if (updated.identityVersion !== (expectedIdentityVersion as number) + 1) {
    malformedStorage();
  }
  return updated;
};
