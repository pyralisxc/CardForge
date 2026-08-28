import { clerkClient, currentUser } from '@clerk/nextjs/server';

import {
  isClerkAuthConfigured,
  resolveAccountEntitlement,
  type AccountEntitlement,
} from '@/features/account/lib/accountEntitlement';
import { resolveOwnerAccess, type OwnerAccess } from '@/domain/entitlements';
import { getCachedExperienceSettings } from '@/features/experience-settings/server';
import { resolveWithTimeoutOrThrow } from '@/shared/asyncTimeout';

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
  source: 'clerk_user';
}

export interface CardforgeServerUserAccess {
  authConfigured: boolean;
  user: CardforgeServerUser | null;
  ownerAccess: OwnerAccess & { userId: string | null; email: string | null };
}

export class AccountIdentityUnavailableError extends Error {
  readonly status = 503;

  constructor(message = 'Account identity is temporarily unavailable.') {
    super(message);
    this.name = 'AccountIdentityUnavailableError';
  }
}

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

const createCardforgeUserAccess = (
  authConfigured: boolean,
  user: CardforgeServerUser | null,
): CardforgeServerUserAccess => ({
  authConfigured,
  user,
  ownerAccess: resolveOwnerAccessForServerUser(authConfigured, user),
});

const resolveCurrentEntitlementForAccess = async (
  access: CardforgeServerUserAccess,
): Promise<AccountEntitlement> => {
  const experienceSettings = await getCachedExperienceSettings();
  return resolveAccountEntitlement({
    accountUserId: access.user?.id ?? null,
    authConfigured: access.authConfigured,
    isSignedIn: Boolean(access.user),
    emailAddresses: access.user?.emailAddresses ?? [],
    privateMetadata: access.user?.privateMetadata ?? {},
    ownerAccess: access.ownerAccess,
    projectFileAccess: experienceSettings.projectFileAccess,
  });
};

export const getCardforgeUserAccessForUserId = async (
  userId: string,
): Promise<CardforgeServerUserAccess> => {
  const authConfigured = isClerkAuthConfigured();
  if (!authConfigured) return createCardforgeUserAccess(false, null);

  let fullUser;
  try {
    fullUser = await resolveWithTimeoutOrThrow(
      Promise.resolve().then(async () => {
        const client = await clerkClient();
        return client.users.getUser(userId);
      }),
      CLERK_USER_READ_TIMEOUT_MS,
    );
  } catch (error) {
    console.error('Unable to resolve CardForge account identity by user id:', error);
    throw new AccountIdentityUnavailableError();
  }

  return createCardforgeUserAccess(
    authConfigured,
    fullUser ? toCardforgeUserFromClerk(fullUser) : null,
  );
};

export const getCardforgeEntitlementForUserId = async (
  userId: string,
): Promise<AccountEntitlement> => (
  resolveCurrentEntitlementForAccess(await getCardforgeUserAccessForUserId(userId))
);

export const getCurrentCardforgeUserAccess = async (): Promise<CardforgeServerUserAccess> => {
  const authConfigured = isClerkAuthConfigured();
  if (!authConfigured) return createCardforgeUserAccess(false, null);

  let fullUser;
  try {
    fullUser = await resolveWithTimeoutOrThrow(
      Promise.resolve().then(() => currentUser()),
      CLERK_USER_READ_TIMEOUT_MS,
    );
  } catch (error) {
    console.error('Unable to resolve current CardForge account identity:', error);
    throw new AccountIdentityUnavailableError();
  }

  return createCardforgeUserAccess(
    authConfigured,
    fullUser ? toCardforgeUserFromClerk(fullUser) : null,
  );
};

export const getCurrentCardforgeEntitlement = async (): Promise<AccountEntitlement> => (
  resolveCurrentEntitlementForAccess(await getCurrentCardforgeUserAccess())
);
