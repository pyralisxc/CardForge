import type {
  AccessMode,
  ExportEntitlementCopy,
  PaidPlan,
  ProjectCapabilities,
  ProjectFileAccessPolicy,
} from '@/domain/entitlements';
import type { OwnerAccess } from '@/domain/entitlements';
import { getStripeCustomerIdFromMetadata } from '@/features/billing/client';
import { getExportEntitlementCopy, getProjectCapabilities, resolveAccessMode } from '@/domain/entitlements';

type EntitlementEnvironment = Partial<Record<
  | 'NODE_ENV'
  | 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'
  | 'CLERK_SECRET_KEY'
  | 'CARDFORGE_ACCESS_MODE'
  | 'NEXT_PUBLIC_CARDFORGE_ACCESS_MODE'
  | 'CARDFORGE_PAID_ACCOUNT_EMAILS'
  | 'CARDFORGE_CONTRIBUTOR_ACCOUNT_EMAILS',
  string
>>;

type AccountMetadata = Record<string, unknown>;

export interface ResolveAccountAccessModeInput {
  authConfigured: boolean;
  isSignedIn: boolean;
  emailAddresses: string[];
  publicMetadata?: AccountMetadata;
  privateMetadata?: AccountMetadata;
  env?: EntitlementEnvironment;
  now?: Date | string;
}

export interface ResolveAccountEntitlementInput extends Partial<ResolveAccountAccessModeInput> {
  accountUserId?: string | null;
  env?: EntitlementEnvironment;
  ownerAccess?: OwnerAccess;
  projectFileAccess?: ProjectFileAccessPolicy;
}

export interface AccountEntitlement {
  accessMode: AccessMode;
  accessExpiresAt: string | null;
  authorities: {
    contributor: boolean;
    owner: boolean;
  };
  accountEmail: string | null;
  accountUserId: string | null;
  authConfigured: boolean;
  canExportClean: boolean;
  capabilities: ProjectCapabilities;
  copy: ExportEntitlementCopy;
  hasStripeCustomer: boolean;
  isSignedIn: boolean;
  ownerAccess: OwnerAccess;
  commercialPlan: 'free' | PaidPlan;
  grants: readonly {
    kind: 'creator-capabilities';
    source: 'contributor' | 'owner' | 'temporary' | 'environment';
    expiresAt: string | null;
  }[];
  paidPlan: PaidPlan | null;
  source: 'clerk' | 'environment';
}

const defaultOwnerAccess: OwnerAccess = {
  isOwner: false,
  source: 'none',
};

const readEnvironment = (env?: EntitlementEnvironment): EntitlementEnvironment => env ?? {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  CARDFORGE_ACCESS_MODE: process.env.CARDFORGE_ACCESS_MODE,
  NEXT_PUBLIC_CARDFORGE_ACCESS_MODE: process.env.NEXT_PUBLIC_CARDFORGE_ACCESS_MODE,
  CARDFORGE_PAID_ACCOUNT_EMAILS: process.env.CARDFORGE_PAID_ACCOUNT_EMAILS,
  CARDFORGE_CONTRIBUTOR_ACCOUNT_EMAILS: process.env.CARDFORGE_CONTRIBUTOR_ACCOUNT_EMAILS,
};

export const isClerkAuthConfigured = (env?: EntitlementEnvironment): boolean => {
  const source = readEnvironment(env);
  return Boolean(source.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && source.CLERK_SECRET_KEY);
};

const parseEmailList = (value?: string): Set<string> =>
  new Set((value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean));

const readMetadataAccessMode = (metadata: AccountMetadata | undefined): AccessMode | null => {
  const value = metadata?.cardforgeAccess;
  return value === 'contributor' || value === 'paid' || value === 'free' ? value : null;
};

const readMetadataPaidPlan = (metadata: AccountMetadata | undefined): PaidPlan => (
  metadata?.cardforgeCommercialPlan === 'designer' || metadata?.cardforgePaidPlan === 'designer' ? 'designer' : 'creator'
);

const readAuthorityRoles = (metadata: AccountMetadata | undefined): Set<string> => {
  const roles = Array.isArray(metadata?.cardforgeAuthorityRoles)
    ? metadata.cardforgeAuthorityRoles.filter((role): role is string => typeof role === 'string')
    : [];
  if (metadata?.cardforgeAccess === 'contributor') roles.push('contributor');
  return new Set(roles);
};

const readCommercialPlan = (
  metadata: AccountMetadata | undefined,
  activeMode: AccessMode,
): 'free' | PaidPlan => {
  if (metadata?.cardforgeCommercialPlan === 'creator' || metadata?.cardforgeCommercialPlan === 'designer') {
    return metadata.cardforgeCommercialPlan;
  }
  // Backward-compatible read for Stripe-backed accounts written before the
  // commercial-plan and authority axes were separated.
  if (activeMode === 'paid' && getStripeCustomerIdFromMetadata(metadata)) return readMetadataPaidPlan(metadata);
  return 'free';
};

const toValidDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const readMetadataAccessExpiresAt = (metadata: AccountMetadata | undefined): Date | null =>
  toValidDate(metadata?.cardforgeAccessExpiresAt);

const isExpired = (expiresAt: Date | null, now?: Date | string): boolean => {
  if (!expiresAt) return false;
  const current = now instanceof Date ? now : now ? new Date(now) : new Date();
  if (Number.isNaN(current.getTime())) return false;
  return expiresAt.getTime() <= current.getTime();
};

const readActiveMetadataAccessMode = (
  metadata: AccountMetadata | undefined,
  now?: Date | string
): AccessMode | null => {
  const mode = readMetadataAccessMode(metadata);
  if (mode === 'paid' && isExpired(readMetadataAccessExpiresAt(metadata), now)) return 'free';
  return mode;
};

const readActiveMetadataAccessExpiresAt = (
  metadata: AccountMetadata | undefined,
  now?: Date | string
): string | null => {
  const mode = readMetadataAccessMode(metadata);
  const expiresAt = readMetadataAccessExpiresAt(metadata);
  if (mode !== 'paid' || !expiresAt || isExpired(expiresAt, now)) return null;
  return expiresAt.toISOString();
};

export const resolveAccountAccessMode = ({
  authConfigured,
  isSignedIn,
  emailAddresses,
  privateMetadata,
  env,
  now,
}: ResolveAccountAccessModeInput): AccessMode => {
  if (!authConfigured) return resolveAccessMode(readEnvironment(env));
  if (!isSignedIn) return 'free';

  const privateMode = readActiveMetadataAccessMode(privateMetadata, now);
  if (privateMode === 'contributor') return 'contributor';
  if (privateMode === 'paid') return 'paid';

  const source = readEnvironment(env);
  const normalizedEmails = emailAddresses.map((email) => email.trim().toLowerCase()).filter(Boolean);
  const contributorEmails = parseEmailList(source.CARDFORGE_CONTRIBUTOR_ACCOUNT_EMAILS);
  const paidEmails = parseEmailList(source.CARDFORGE_PAID_ACCOUNT_EMAILS);

  if (normalizedEmails.some((email) => contributorEmails.has(email))) return 'contributor';
  if (normalizedEmails.some((email) => paidEmails.has(email))) return 'paid';
  return 'free';
};

export const resolveAccountEntitlement = ({
  accountUserId = null,
  authConfigured,
  isSignedIn = false,
  emailAddresses = [],
  privateMetadata = {},
  env,
  now,
  ownerAccess = defaultOwnerAccess,
  projectFileAccess = 'creator_pass',
}: ResolveAccountEntitlementInput = {}): AccountEntitlement => {
  const configured = authConfigured ?? isClerkAuthConfigured(env);
  const baseAccessMode = resolveAccountAccessMode({
    authConfigured: configured,
    isSignedIn,
    emailAddresses,
    privateMetadata,
    env,
    now,
  });
  const roles = readAuthorityRoles(privateMetadata);
  const contributor = roles.has('contributor') || baseAccessMode === 'contributor' || ownerAccess.isOwner;
  const commercialPlan = configured && isSignedIn
    ? readCommercialPlan(privateMetadata, baseAccessMode)
    : 'free';
  const hasCreatorGrant = contributor || baseAccessMode === 'paid';
  const accessMode: AccessMode = contributor ? 'contributor' : hasCreatorGrant || commercialPlan !== 'free' ? 'paid' : 'free';
  const capabilities = getProjectCapabilities(accessMode, projectFileAccess);
  const copy = getExportEntitlementCopy(accessMode, projectFileAccess);
  const accessExpiresAt = configured && isSignedIn
    ? readActiveMetadataAccessExpiresAt(privateMetadata, now)
    : null;
  const grants: AccountEntitlement['grants'] = !hasCreatorGrant || commercialPlan !== 'free'
    ? []
    : [{
        kind: 'creator-capabilities',
        source: ownerAccess.isOwner ? 'owner' : contributor ? 'contributor' : configured ? 'temporary' : 'environment',
        expiresAt: accessExpiresAt,
      }];
  const stripeCustomerId = configured && isSignedIn
    ? getStripeCustomerIdFromMetadata(privateMetadata)
    : null;

  return {
    accessMode,
    accessExpiresAt,
    authorities: { contributor, owner: ownerAccess.isOwner },
    accountEmail: emailAddresses[0] || null,
    accountUserId,
    authConfigured: configured,
    canExportClean: capabilities.canExportClean,
    capabilities,
    copy,
    hasStripeCustomer: Boolean(stripeCustomerId),
    isSignedIn,
    ownerAccess,
    commercialPlan,
    grants,
    // Compatibility projection for consumers that need the effective paid
    // tier while they migrate to commercialPlan + grants.
    paidPlan: commercialPlan !== 'free'
      ? commercialPlan
      : baseAccessMode === 'paid'
        ? readMetadataPaidPlan(privateMetadata)
        : null,
    source: configured ? 'clerk' : 'environment',
  };
};
