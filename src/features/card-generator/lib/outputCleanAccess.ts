import { loadAccountEntitlement } from '@/features/account/client/entitlement';
import { createProjectPersistenceScope } from '@/features/project/client/persistence-workspace';

/** A clean prepared file may only be handed off under current matching access. */
export async function validateCleanOutputAccess(scope: string): Promise<void> {
  const result = await loadAccountEntitlement();
  if (!result.ok || typeof result.entitlement?.authConfigured !== 'boolean'
    || typeof result.entitlement?.isSignedIn !== 'boolean'
    || (result.entitlement.accountUserId !== null && typeof result.entitlement.accountUserId !== 'string')
    || (result.entitlement.authConfigured && (!result.entitlement.isSignedIn || !result.entitlement.accountUserId))
    || (!result.entitlement.authConfigured && (result.entitlement.isSignedIn || result.entitlement.accountUserId !== null))
    || createProjectPersistenceScope(result.entitlement) !== scope
    || result.entitlement.capabilities?.canExportClean !== true) {
    throw new Error('Clean download access could not be verified for this workspace. Try again after checking your account.');
  }
}
