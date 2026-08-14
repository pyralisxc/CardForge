type OwnerEnvironment = Partial<Record<'CARDFORGE_OWNER_ACCOUNT_EMAILS', string>>;
type AccountMetadata = Record<string, unknown>;

export interface ResolveOwnerAccessInput {
  authConfigured: boolean;
  isSignedIn: boolean;
  emailAddresses: string[];
  publicMetadata?: AccountMetadata;
  privateMetadata?: AccountMetadata;
  env?: OwnerEnvironment;
}

export interface OwnerAccess {
  isOwner: boolean;
  source: 'clerk_private_metadata' | 'environment' | 'none';
}

const readEnvironment = (env?: OwnerEnvironment): OwnerEnvironment => env ?? {
  CARDFORGE_OWNER_ACCOUNT_EMAILS: process.env.CARDFORGE_OWNER_ACCOUNT_EMAILS,
};

const parseEmailList = (value?: string): string[] => (
  [...new Set((value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean))]
);

export const getCanonicalOwnerAccountEmail = (env?: OwnerEnvironment): string | null => {
  const ownerEmails = parseEmailList(readEnvironment(env).CARDFORGE_OWNER_ACCOUNT_EMAILS);
  return ownerEmails.length === 1 ? ownerEmails[0] : null;
};

export const resolveOwnerAccess = ({
  authConfigured,
  isSignedIn,
  emailAddresses,
  privateMetadata,
  env,
}: ResolveOwnerAccessInput): OwnerAccess => {
  if (!authConfigured || !isSignedIn) return { isOwner: false, source: 'none' };

  if (privateMetadata?.cardforgeRole === 'owner') {
    return { isOwner: true, source: 'clerk_private_metadata' };
  }

  const ownerEmails = new Set(parseEmailList(readEnvironment(env).CARDFORGE_OWNER_ACCOUNT_EMAILS));
  const normalizedEmails = emailAddresses.map((email) => email.trim().toLowerCase()).filter(Boolean);
  return normalizedEmails.some((email) => ownerEmails.has(email))
    ? { isOwner: true, source: 'environment' }
    : { isOwner: false, source: 'none' };
};
