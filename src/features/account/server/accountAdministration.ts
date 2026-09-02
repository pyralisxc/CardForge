export type OwnerManagedAccess = 'free' | 'paid' | 'contributor';
export type OwnerManagedCommercialPlan = 'free' | 'creator' | 'designer';

export interface OwnerAccountRoleInput {
  commercialPlan?: unknown;
  contributor?: unknown;
  access?: unknown;
  owner?: unknown;
  note?: unknown;
}

export interface NormalizedOwnerAccountRole {
  commercialPlan: OwnerManagedCommercialPlan;
  contributor: boolean;
  owner: boolean;
  note: string;
}

export type OwnerAccountRoleInputResult =
  | { ok: true; value: NormalizedOwnerAccountRole }
  | { ok: false; message: string };

export interface OwnerAccountSummary {
  id: string;
  email: string | null;
  name: string;
  access: OwnerManagedAccess;
  commercialPlan: OwnerManagedCommercialPlan;
  contributorAuthority: boolean;
  isOwner: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  note: string;
}

const normalizeNote = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ').slice(0, 300) : '';

const normalizeAccess = (value: unknown): OwnerManagedAccess | null =>
  value === 'free' || value === 'paid' || value === 'contributor' ? value : null;

const normalizeCommercialPlan = (value: unknown): OwnerManagedCommercialPlan | null =>
  value === 'free' || value === 'creator' || value === 'designer' ? value : null;

const getString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const toIsoFromMs = (value: unknown): string | null =>
  typeof value === 'number' && Number.isFinite(value) ? new Date(value).toISOString() : null;

export const normalizeOwnerAccountRoleInput = (input: OwnerAccountRoleInput): OwnerAccountRoleInputResult => {
  const legacyAccess = normalizeAccess(input.access);
  const commercialPlan = normalizeCommercialPlan(input.commercialPlan)
    ?? (legacyAccess === 'paid' ? 'creator' : legacyAccess ? 'free' : null);
  if (!commercialPlan) return { ok: false, message: 'Choose a supported commercial plan.' };

  return {
    ok: true,
    value: {
      commercialPlan,
      contributor: input.contributor === true || legacyAccess === 'contributor',
      owner: input.owner === true,
      note: normalizeNote(input.note),
    },
  };
};

export const buildOwnerAccountMetadataPatch = ({
  existingMetadata = {},
  input,
}: {
  existingMetadata?: Record<string, unknown>;
  input: NormalizedOwnerAccountRole;
}): Record<string, unknown> => {
  const nextMetadata = { ...existingMetadata };
  const existingRoles = Array.isArray(existingMetadata.cardforgeAuthorityRoles)
    ? existingMetadata.cardforgeAuthorityRoles.filter((role): role is string => typeof role === 'string' && role !== 'contributor')
    : [];
  const authorityRoles = input.contributor ? [...existingRoles, 'contributor'] : existingRoles;
  delete nextMetadata.cardforgeAccessExpiresAt;
  delete nextMetadata.cardforgeFounderBetaClaimedAt;
  return {
    ...nextMetadata,
    cardforgeAccess: input.owner || input.contributor
      ? 'contributor'
      : input.commercialPlan === 'free' ? 'free' : 'paid',
    cardforgeCommercialPlan: input.commercialPlan,
    cardforgeAuthorityRoles: authorityRoles,
    cardforgeRole: input.owner ? 'owner' : '',
    cardforgeOwnerNote: input.note,
    cardforgeOwnerUpdatedAt: new Date().toISOString(),
  };
};

export const mapOwnerAccountSummary = (user: {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  createdAt?: number | null;
  lastSignInAt?: number | null;
  emailAddresses?: Array<{ emailAddress?: string | null }>;
  privateMetadata?: Record<string, unknown> | null;
  publicMetadata?: Record<string, unknown> | null;
}): OwnerAccountSummary => {
  const metadata = user.privateMetadata ?? {};
  const access = normalizeAccess(metadata.cardforgeAccess) ?? 'free';
  const commercialPlan = normalizeCommercialPlan(metadata.cardforgeCommercialPlan)
    ?? (access === 'paid' && getString(metadata.cardforgeStripeCustomerId)
      ? (metadata.cardforgePaidPlan === 'designer' ? 'designer' : 'creator')
      : 'free');
  const contributorAuthority = (Array.isArray(metadata.cardforgeAuthorityRoles)
    && metadata.cardforgeAuthorityRoles.includes('contributor')) || access === 'contributor';
  const firstName = getString(user.firstName) ?? '';
  const lastName = getString(user.lastName) ?? '';
  const name = `${firstName} ${lastName}`.trim();

  return {
    id: user.id,
    email: user.emailAddresses?.[0]?.emailAddress ?? null,
    name,
    access,
    commercialPlan,
    contributorAuthority,
    isOwner: metadata.cardforgeRole === 'owner',
    createdAt: toIsoFromMs(user.createdAt),
    lastSignInAt: toIsoFromMs(user.lastSignInAt),
    stripeCustomerId: getString(metadata.cardforgeStripeCustomerId),
    stripeSubscriptionId: getString(metadata.cardforgeStripeSubscriptionId),
    note: getString(metadata.cardforgeOwnerNote) ?? '',
  };
};
