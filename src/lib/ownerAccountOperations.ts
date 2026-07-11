export type OwnerManagedAccess = 'free' | 'paid' | 'dev';

export interface OwnerAccountRoleInput {
  access?: unknown;
  owner?: unknown;
  note?: unknown;
}

export interface NormalizedOwnerAccountRole {
  access: OwnerManagedAccess;
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
  value === 'free' || value === 'paid' || value === 'dev' ? value : null;

const getString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const toIsoFromMs = (value: unknown): string | null =>
  typeof value === 'number' && Number.isFinite(value) ? new Date(value).toISOString() : null;

export const normalizeOwnerAccountRoleInput = (input: OwnerAccountRoleInput): OwnerAccountRoleInputResult => {
  const access = normalizeAccess(input.access);
  if (!access) return { ok: false, message: 'Choose a supported access level.' };

  return {
    ok: true,
    value: {
      access,
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
}): Record<string, unknown> => ({
  ...existingMetadata,
  cardforgeAccess: input.access,
  cardforgeRole: input.owner ? 'owner' : '',
  cardforgeOwnerNote: input.note,
  cardforgeOwnerUpdatedAt: new Date().toISOString(),
});

export const mapOwnerAccountSummary = (user: {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  createdAt?: number | null;
  lastSignInAt?: number | null;
  emailAddresses?: Array<{ emailAddress?: string | null }>;
  privateMetadata?: Record<string, unknown> | null;
}): OwnerAccountSummary => {
  const metadata = user.privateMetadata ?? {};
  const access = normalizeAccess(metadata.cardforgeAccess) ?? 'free';
  const firstName = getString(user.firstName) ?? '';
  const lastName = getString(user.lastName) ?? '';
  const name = `${firstName} ${lastName}`.trim();

  return {
    id: user.id,
    email: user.emailAddresses?.[0]?.emailAddress ?? null,
    name,
    access,
    isOwner: metadata.cardforgeRole === 'owner',
    createdAt: toIsoFromMs(user.createdAt),
    lastSignInAt: toIsoFromMs(user.lastSignInAt),
    stripeCustomerId: getString(metadata.cardforgeStripeCustomerId),
    stripeSubscriptionId: getString(metadata.cardforgeStripeSubscriptionId),
    note: getString(metadata.cardforgeOwnerNote) ?? '',
  };
};
