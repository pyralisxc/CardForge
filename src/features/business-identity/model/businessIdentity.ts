export type BusinessEntityType = 'sole_proprietor';
export type AssumedBusinessNameStatus = 'unverified' | 'registered';

export interface BusinessIdentity {
  identityVersion: number;
  brandName: string;
  legalOperatorName: string;
  entityType: BusinessEntityType;
  jurisdictionState: string;
  jurisdictionCountry: string;
  assumedBusinessNameStatus: AssumedBusinessNameStatus;
  supportEmail: string;
  legalEmail: string;
  supportPhone?: string;
  websiteUrl: string;
  effectiveDate: string;
  copyrightHolder: string;
}

export type BusinessIdentityWriteField = Exclude<keyof BusinessIdentity, 'identityVersion'>;
export type BusinessIdentityInput = Partial<Record<BusinessIdentityWriteField, unknown>>;
export type BusinessIdentityWriteErrorField = keyof BusinessIdentity | 'form';
export type BusinessIdentityWriteErrors = Partial<Record<BusinessIdentityWriteErrorField, string>>;
export type BusinessIdentityWriteResult =
  | { ok: true; value: BusinessIdentity }
  | { ok: false; errors: BusinessIdentityWriteErrors };

export const DEFAULT_BUSINESS_IDENTITY: Readonly<BusinessIdentity> = Object.freeze({
  identityVersion: 1,
  brandName: 'CardForge Studio',
  legalOperatorName: 'Cameron Locke',
  entityType: 'sole_proprietor',
  jurisdictionState: 'Oregon',
  jurisdictionCountry: 'United States',
  assumedBusinessNameStatus: 'unverified',
  supportEmail: 'pyraliscameron@gmail.com',
  legalEmail: 'pyraliscameron@gmail.com',
  websiteUrl: 'https://cardforges.com',
  effectiveDate: '2026-07-16',
  copyrightHolder: 'Cameron Locke',
});

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

const normalizePositiveInteger = (value: unknown, fallback: number): number =>
  typeof value === 'number'
    && Number.isSafeInteger(value)
    && value > 0
    && value <= 2_147_483_647
    ? value
    : fallback;

const parseEmail = (value: unknown): string | null => {
  const normalized = normalizeText(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
};

const parseWebsiteUrl = (value: unknown): string | null => {
  const normalized = normalizeText(value);

  try {
    const url = new URL(normalized);
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || url.search
      || url.hash
    ) return null;

    const pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
    return `${url.origin}${pathname}`;
  } catch {
    return null;
  }
};

const parseIsoDate = (value: unknown): string | null => {
  const normalized = normalizeText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

  const date = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === normalized
    ? normalized
    : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

export const normalizeBusinessIdentityInput = (
  value: unknown,
  current: Readonly<BusinessIdentity> = DEFAULT_BUSINESS_IDENTITY,
): BusinessIdentity => {
  const input = asRecord(value);
  if (!input) return { ...current };

  const textOrCurrent = (key: keyof BusinessIdentity): string =>
    hasOwn(input, key)
      ? normalizeText(input[key]) || String(current[key] ?? '')
      : String(current[key] ?? '');

  return {
    identityVersion: current.identityVersion,
    brandName: textOrCurrent('brandName'),
    legalOperatorName: textOrCurrent('legalOperatorName'),
    entityType: input.entityType === 'sole_proprietor' ? input.entityType : current.entityType,
    jurisdictionState: textOrCurrent('jurisdictionState'),
    jurisdictionCountry: textOrCurrent('jurisdictionCountry'),
    assumedBusinessNameStatus:
      input.assumedBusinessNameStatus === 'unverified' || input.assumedBusinessNameStatus === 'registered'
        ? input.assumedBusinessNameStatus
        : current.assumedBusinessNameStatus,
    supportEmail: hasOwn(input, 'supportEmail')
      ? parseEmail(input.supportEmail) ?? current.supportEmail
      : current.supportEmail,
    legalEmail: hasOwn(input, 'legalEmail')
      ? parseEmail(input.legalEmail) ?? current.legalEmail
      : current.legalEmail,
    supportPhone: hasOwn(input, 'supportPhone')
      ? normalizeText(input.supportPhone) || undefined
      : current.supportPhone,
    websiteUrl: hasOwn(input, 'websiteUrl')
      ? parseWebsiteUrl(input.websiteUrl) ?? current.websiteUrl
      : current.websiteUrl,
    effectiveDate: hasOwn(input, 'effectiveDate')
      ? parseIsoDate(input.effectiveDate) ?? current.effectiveDate
      : current.effectiveDate,
    copyrightHolder: textOrCurrent('copyrightHolder'),
  };
};

export const hydrateBusinessIdentity = (
  value: unknown,
  current: Readonly<BusinessIdentity> = DEFAULT_BUSINESS_IDENTITY,
): BusinessIdentity => {
  const input = asRecord(value);
  const fallbackVersion = normalizePositiveInteger(
    current.identityVersion,
    DEFAULT_BUSINESS_IDENTITY.identityVersion,
  );

  return {
    ...normalizeBusinessIdentityInput(input, current),
    identityVersion: normalizePositiveInteger(input?.identityVersion, fallbackVersion),
  };
};

const REQUIRED_TEXT_FIELDS: ReadonlyArray<{
  field: Extract<BusinessIdentityWriteField,
    | 'brandName'
    | 'legalOperatorName'
    | 'jurisdictionState'
    | 'jurisdictionCountry'
    | 'copyrightHolder'>;
  label: string;
}> = [
  { field: 'brandName', label: 'Brand name' },
  { field: 'legalOperatorName', label: 'Legal operator name' },
  { field: 'jurisdictionState', label: 'Jurisdiction state' },
  { field: 'jurisdictionCountry', label: 'Jurisdiction country' },
  { field: 'copyrightHolder', label: 'Copyright holder' },
];

const BUSINESS_IDENTITY_FIELDS = new Set<string>([
  'identityVersion',
  'brandName',
  'legalOperatorName',
  'entityType',
  'jurisdictionState',
  'jurisdictionCountry',
  'assumedBusinessNameStatus',
  'supportEmail',
  'legalEmail',
  'supportPhone',
  'websiteUrl',
  'effectiveDate',
  'copyrightHolder',
] satisfies ReadonlyArray<keyof BusinessIdentity>);

export const validateBusinessIdentityWrite = (
  value: unknown,
  current: Readonly<BusinessIdentity> = DEFAULT_BUSINESS_IDENTITY,
): BusinessIdentityWriteResult => {
  const input = asRecord(value);
  if (!input) {
    return {
      ok: false,
      errors: { form: 'Business identity update must be an object.' },
    };
  }

  const errors: BusinessIdentityWriteErrors = {};

  const unknownFields = Object.getOwnPropertyNames(input)
    .filter((field) => !BUSINESS_IDENTITY_FIELDS.has(field))
    .sort();
  if (unknownFields.length > 0) {
    const fieldLabel = unknownFields.length === 1 ? 'field' : 'fields';
    errors.form = `Unknown business identity ${fieldLabel}: ${unknownFields.join(', ')}.`;
  }

  if (hasOwn(input, 'identityVersion')) {
    errors.identityVersion = 'Identity version is server-owned.';
  }

  for (const { field, label } of REQUIRED_TEXT_FIELDS) {
    if (hasOwn(input, field) && !normalizeText(input[field])) {
      errors[field] = `${label} is required.`;
    }
  }

  if (hasOwn(input, 'entityType') && input.entityType !== 'sole_proprietor') {
    errors.entityType = 'Entity type must be sole proprietor.';
  }

  if (
    hasOwn(input, 'assumedBusinessNameStatus')
    && input.assumedBusinessNameStatus !== 'unverified'
    && input.assumedBusinessNameStatus !== 'registered'
  ) {
    errors.assumedBusinessNameStatus =
      'Assumed business name status must be unverified or registered.';
  }

  if (hasOwn(input, 'supportEmail') && !parseEmail(input.supportEmail)) {
    errors.supportEmail = 'Enter a valid support email address.';
  }

  if (hasOwn(input, 'legalEmail') && !parseEmail(input.legalEmail)) {
    errors.legalEmail = 'Enter a valid legal email address.';
  }

  if (hasOwn(input, 'supportPhone') && typeof input.supportPhone !== 'string') {
    errors.supportPhone = 'Support phone must be text or blank.';
  }

  if (hasOwn(input, 'websiteUrl') && !parseWebsiteUrl(input.websiteUrl)) {
    errors.websiteUrl =
      'Website must be an absolute HTTPS URL without credentials, query parameters, or a fragment.';
  }

  if (hasOwn(input, 'effectiveDate') && !parseIsoDate(input.effectiveDate)) {
    errors.effectiveDate = 'Effective date must be a valid date in YYYY-MM-DD format.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: normalizeBusinessIdentityInput(input, current),
  };
};

export const formatBusinessIdentityDescription = (identity: Readonly<BusinessIdentity>): string => {
  const assumedName = identity.assumedBusinessNameStatus === 'registered'
    ? `, d/b/a ${identity.brandName}`
    : '';

  return `${identity.brandName} is a software product created and operated by ${identity.legalOperatorName}${assumedName}, an independent sole proprietor based in ${identity.jurisdictionState}.`;
};
