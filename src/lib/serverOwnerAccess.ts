import { isClerkAuthConfigured } from '@/lib/accountEntitlement';
import { resolveOwnerAccess, type OwnerAccess } from '@/lib/ownerAccess';
import { getCurrentCardforgeUserAccess } from '@/lib/serverCardforgeUser';

interface CurrentUserLike {
  id: string;
  emailAddresses: Array<{ emailAddress: string }>;
  primaryEmailAddress?: { emailAddress: string } | null;
  publicMetadata?: Record<string, unknown>;
  privateMetadata?: Record<string, unknown>;
}

export const resolveCurrentOwnerAccess = (
  user: CurrentUserLike | null,
): OwnerAccess & { userId: string | null; email: string | null } => {
  const authConfigured = isClerkAuthConfigured();
  if (!authConfigured) {
    return { isOwner: false, source: 'none', userId: null, email: null };
  }

  const emailAddresses = user?.emailAddresses.map((email) => email.emailAddress) ?? [];
  const access = resolveOwnerAccess({
    authConfigured,
    isSignedIn: Boolean(user),
    emailAddresses,
    publicMetadata: user?.publicMetadata,
    privateMetadata: user?.privateMetadata,
  });

  return {
    ...access,
    userId: user?.id ?? null,
    email: user?.primaryEmailAddress?.emailAddress ?? emailAddresses[0] ?? null,
  };
};

export const getCurrentOwnerAccess = async (): Promise<OwnerAccess & { userId: string | null; email: string | null }> => {
  const access = await getCurrentCardforgeUserAccess();
  return access.ownerAccess;
};
