import type { AccessMode, ExportEntitlementCopy, ProjectCapabilities } from '@/lib/projectAccess';
import type { OwnerAccess } from '@/lib/ownerAccess';
import { getExportEntitlementCopy, getProjectCapabilities, resolveAccessMode } from '@/lib/projectAccess';

type EntitlementEnvironment = Partial<Record<
  | 'NODE_ENV'
  | 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'
  | 'CLERK_SECRET_KEY'
  | 'CARDFORGE_ACCESS_MODE'
  | 'NEXT_PUBLIC_CARDFORGE_ACCESS_MODE'
  | 'CARDFORGE_PAID_ACCOUNT_EMAILS'
  | 'CARDFORGE_DEV_ACCOUNT_EMAILS',
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
  env?: EntitlementEnvironment;
  ownerAccess?: OwnerAccess;
}

export interface AccountEntitlement {
  accessMode: AccessMode;
  accessExpiresAt: string | null;
  accountEmail: string | null;
  authConfigured: boolean;
  canExportClean: boolean;
  capabilities: ProjectCapabilities;
  copy: ExportEntitlementCopy;
  isSignedIn: boolean;
  ownerAccess: OwnerAccess;
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
  CARDFORGE_DEV_ACCOUNT_EMAILS: process.env.CARDFORGE_DEV_ACCOUNT_EMAILS,
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
  return value === 'dev' || value === 'paid' || value === 'free' ? value : null;
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
  if (privateMode === 'dev') return 'dev';
  if (privateMode === 'paid') return 'paid';

  const source = readEnvironment(env);
  const normalizedEmails = emailAddresses.map((email) => email.trim().toLowerCase()).filter(Boolean);
  const devEmails = parseEmailList(source.CARDFORGE_DEV_ACCOUNT_EMAILS);
  const paidEmails = parseEmailList(source.CARDFORGE_PAID_ACCOUNT_EMAILS);

  if (normalizedEmails.some((email) => devEmails.has(email))) return 'dev';
  if (normalizedEmails.some((email) => paidEmails.has(email))) return 'paid';
  return 'free';
};

export const resolveAccountEntitlement = ({
  authConfigured,
  isSignedIn = false,
  emailAddresses = [],
  privateMetadata = {},
  env,
  now,
  ownerAccess = defaultOwnerAccess,
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
  const accessMode = ownerAccess.isOwner ? 'dev' : baseAccessMode;
  const capabilities = getProjectCapabilities(accessMode);
  const copy = getExportEntitlementCopy(accessMode);

  return {
    accessMode,
    accessExpiresAt: configured && isSignedIn
      ? readActiveMetadataAccessExpiresAt(privateMetadata, now)
      : null,
    accountEmail: emailAddresses[0] || null,
    authConfigured: configured,
    canExportClean: capabilities.canExportClean,
    capabilities,
    copy,
    isSignedIn,
    ownerAccess,
    source: configured ? 'clerk' : 'environment',
  };
};
