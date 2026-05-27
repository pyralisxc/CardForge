import { auth, currentUser } from '@clerk/nextjs/server';

import { isClerkAuthConfigured } from '@/lib/accountEntitlement';
import { resolveWithTimeout } from '@/lib/asyncTimeout';
import { resolveOwnerAccess, type OwnerAccess } from '@/lib/ownerAccess';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

const CLERK_USER_READ_TIMEOUT_MS = 3000;

type Metadata = Record<string, unknown>;

interface ClerkUserLike {
  id: string;
  emailAddresses: Array<{ emailAddress: string }>;
  primaryEmailAddress?: { emailAddress: string } | null;
  firstName?: string | null;
  lastName?: string | null;
  publicMetadata?: Metadata;
  privateMetadata?: Metadata;
}

export interface CardforgeServerUser {
  id: string;
  email: string | null;
  emailAddresses: string[];
  firstName: string | null;
  lastName: string | null;
  publicMetadata: Metadata;
  privateMetadata: Metadata;
  source: 'clerk_user' | 'session_profile';
}

export interface CardforgeServerUserAccess {
  authConfigured: boolean;
  user: CardforgeServerUser | null;
  ownerAccess: OwnerAccess & { userId: string | null; email: string | null };
}

const isRecord = (value: unknown): value is Metadata =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readTextClaim = (claims: Metadata | null, keys: string[]): string | null => {
  if (!claims) return null;
  for (const key of keys) {
    const value = claims[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const readEmailClaims = (claims: Metadata | null): string[] => {
  const primary = readTextClaim(claims, ['email', 'email_address', 'primary_email_address']);
  return primary ? [primary] : [];
};

const readMetadataClaims = (claims: Metadata | null): Metadata => {
  if (!claims) return {};
  const nested = isRecord(claims.privateMetadata)
    ? claims.privateMetadata
    : isRecord(claims.private_metadata)
      ? claims.private_metadata
      : {};
  const metadata: Metadata = { ...nested };

  ['cardforgeAccess', 'cardforgeAccessExpiresAt', 'cardforgeRole'].forEach((key) => {
    if (typeof claims[key] === 'string') metadata[key] = claims[key];
  });

  return metadata;
};

export const resolveOwnerAccessForServerUser = (
  authConfigured: boolean,
  user: CardforgeServerUser | null,
): OwnerAccess & { userId: string | null; email: string | null } => {
  if (!authConfigured) {
    return { isOwner: false, source: 'none', userId: null, email: null };
  }

  const access = resolveOwnerAccess({
    authConfigured,
    isSignedIn: Boolean(user),
    emailAddresses: user?.emailAddresses ?? [],
    publicMetadata: user?.publicMetadata,
    privateMetadata: user?.privateMetadata,
  });

  return {
    ...access,
    userId: user?.id ?? null,
    email: user?.email ?? user?.emailAddresses[0] ?? null,
  };
};

const toCardforgeUserFromClerk = (user: ClerkUserLike): CardforgeServerUser => {
  const emailAddresses = user.emailAddresses.map((email) => email.emailAddress).filter(Boolean);
  return {
    id: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? emailAddresses[0] ?? null,
    emailAddresses,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    publicMetadata: user.publicMetadata ?? {},
    privateMetadata: user.privateMetadata ?? {},
    source: 'clerk_user',
  };
};

const getProfileFallbackUser = async (
  userId: string,
  claims: Metadata | null,
): Promise<CardforgeServerUser> => {
  const supabase = getSupabaseServerClient();
  const fallbackEmailAddresses = readEmailClaims(claims);
  const fallbackPrivateMetadata = readMetadataClaims(claims);

  if (!supabase) {
    return {
      id: userId,
      email: fallbackEmailAddresses[0] ?? null,
      emailAddresses: fallbackEmailAddresses,
      firstName: null,
      lastName: null,
      publicMetadata: {},
      privateMetadata: fallbackPrivateMetadata,
      source: 'session_profile',
    };
  }

  const { data } = await supabase
    .from('cardforge_developer_profiles')
    .select('email,first_name,last_name')
    .eq('clerk_user_id', userId)
    .limit(1);
  const profile = data?.[0] as { email?: string | null; first_name?: string | null; last_name?: string | null } | undefined;
  const email = profile?.email ?? fallbackEmailAddresses[0] ?? null;

  return {
    id: userId,
    email,
    emailAddresses: email ? [email] : fallbackEmailAddresses,
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    publicMetadata: {},
    privateMetadata: fallbackPrivateMetadata,
    source: 'session_profile',
  };
};

export const getCurrentCardforgeUserAccess = async (): Promise<CardforgeServerUserAccess> => {
  const authConfigured = isClerkAuthConfigured();
  if (!authConfigured) {
    return {
      authConfigured,
      user: null,
      ownerAccess: { isOwner: false, source: 'none', userId: null, email: null },
    };
  }

  const [authState, fullUser] = await Promise.all([
    resolveWithTimeout(Promise.resolve().then(() => auth()), {
      fallback: null,
      timeoutMs: CLERK_USER_READ_TIMEOUT_MS,
    }),
    resolveWithTimeout(Promise.resolve().then(() => currentUser()), {
      fallback: null,
      timeoutMs: CLERK_USER_READ_TIMEOUT_MS,
    }),
  ]);

  const user = fullUser
    ? toCardforgeUserFromClerk(fullUser)
    : authState?.userId
      ? await getProfileFallbackUser(authState.userId, isRecord(authState.sessionClaims) ? authState.sessionClaims : null)
      : null;

  return {
    authConfigured,
    user,
    ownerAccess: resolveOwnerAccessForServerUser(authConfigured, user),
  };
};
