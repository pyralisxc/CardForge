import {
  getCardforgeUserAccessForUserId,
  getCurrentCardforgeUserAccess,
  resolveCardforgeEntitlementForAccess,
  type CardforgeServerUser,
} from '@/features/account/lib/serverCardforgeUser';
import type { AccountEntitlement } from '@/features/account/lib/accountEntitlement';

export const ACCOUNT_TOOL_CAPABILITIES = ['studio.ai.create'] as const;

export type AccountToolCapability = typeof ACCOUNT_TOOL_CAPABILITIES[number];

export interface AccountToolAccess {
  user: CardforgeServerUser;
  entitlement: AccountEntitlement;
  isOwner: boolean;
  email: string | null;
  displayName: string | null;
  capabilities: readonly AccountToolCapability[];
}

export class AccountToolAccessError extends Error {
  constructor(message: string, public readonly status: 401 | 403) {
    super(message);
    this.name = 'AccountToolAccessError';
  }
}

const projectAccountToolAccess = async (
  source: Awaited<ReturnType<typeof getCurrentCardforgeUserAccess>>,
): Promise<AccountToolAccess> => {
  if (!source.user) {
    throw new AccountToolAccessError('A linked CardForge account is required.', 401);
  }

  return {
    user: source.user,
    entitlement: await resolveCardforgeEntitlementForAccess(source),
    isOwner: source.ownerAccess.isOwner,
    email: source.user.email,
    displayName: [source.user.firstName, source.user.lastName].filter(Boolean).join(' ').trim()
      || source.user.email,
    capabilities: ACCOUNT_TOOL_CAPABILITIES,
  };
};

export const getCurrentAccountToolAccess = async (): Promise<AccountToolAccess> => (
  projectAccountToolAccess(await getCurrentCardforgeUserAccess())
);

export const getAccountToolAccessForUserId = async (
  userId: string,
): Promise<AccountToolAccess> => (
  projectAccountToolAccess(await getCardforgeUserAccessForUserId(userId))
);

export const requireAccountToolCapability = (
  access: AccountToolAccess,
  capability: AccountToolCapability,
): void => {
  if (!access.capabilities.includes(capability)) {
    throw new AccountToolAccessError('This account cannot use that CardForge Studio capability.', 403);
  }
};
