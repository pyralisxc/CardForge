import 'server-only';

import { clerkClient } from '@clerk/nextjs/server';

import { resolveOwnerAccess } from '@/domain/entitlements';
import {
  buildOwnerAccountMetadataPatch,
  mapOwnerAccountSummary,
  normalizeOwnerAccountRoleInput,
  type OwnerAccountSummary,
} from '@/features/account/server';
import {
  acquireBillingEntitlementLock,
  releaseBillingEntitlementLock,
} from '@/features/billing/server';
import {
  CONTRIBUTOR_PROFILE_STATUSES,
  ContributorAccessStoreError,
  fetchContributorProfileRows,
  updateContributorProfileControl,
  upsertContributorProfile,
  type ContributorProfileRow,
  type ContributorProfileStatus,
} from '@/features/contributor-access/server';

import { getCurrentOwnerAccess } from '../lib/serverOwnerAccess';
import { recordOwnerActivity } from './ownerActivityStore';
import { getOwnerPeople } from './ownerPeopleStore';

export type OwnerPeopleErrorCode =
  | 'owner_access_required'
  | 'owner_operations_conflict'
  | 'owner_people_unavailable'
  | 'owner_person_confirmation_required'
  | 'owner_person_invalid'
  | 'owner_person_protected'
  | 'owner_person_unavailable';

export class OwnerPeopleOperationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: OwnerPeopleErrorCode,
  ) {
    super(message);
  }
}

type OwnerActor = {
  userId: string;
  email: string | null;
};

type OwnerPersonAction = 'update' | 'revoke' | 'deactivate_history';

export interface UpdateOwnerPersonInput {
  action?: unknown;
  userId?: unknown;
  account?: Record<string, unknown>;
  contributor?: Record<string, unknown>;
}

export interface DeleteOwnerPersonInput {
  userId?: unknown;
  confirmation?: unknown;
}

const requireOwnerActor = async (): Promise<OwnerActor> => {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner || !owner.userId) {
    throw new OwnerPeopleOperationError(
      'Owner access is required.',
      403,
      'owner_access_required',
    );
  }
  return { userId: owner.userId, email: owner.email };
};

const normalizeNullableOverride = (
  value: unknown,
  minimum: number,
  maximum: number,
): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new OwnerPeopleOperationError(
      `Contributor override must be between ${minimum} and ${maximum}, or left blank.`,
      400,
      'owner_person_invalid',
    );
  }
  return Math.trunc(parsed);
};

const findProfile = async (contributorId: string): Promise<ContributorProfileRow | null> => (
  (await fetchContributorProfileRows()).find((profile) => profile.clerk_user_id === contributorId) ?? null
);

const normalizeAction = (value: unknown): OwnerPersonAction => (
  value === 'revoke' || value === 'deactivate_history' ? value : 'update'
);

const requireUserId = (value: unknown): string => {
  const userId = typeof value === 'string' ? value.trim() : '';
  if (!userId) {
    throw new OwnerPeopleOperationError(
      'Choose an account or retained profile.',
      400,
      'owner_person_invalid',
    );
  }
  return userId;
};

export const getOwnerPeopleForCurrentOwner = async (options: Parameters<typeof getOwnerPeople>[0]) => {
  await requireOwnerActor();
  return getOwnerPeople(options);
};

export const updateOwnerPerson = async (
  input: UpdateOwnerPersonInput,
): Promise<{ account: OwnerAccountSummary | null; warnings: string[] }> => {
  const owner = await requireOwnerActor();
  const action = normalizeAction(input.action);
  const userId = requireUserId(input.userId);
  if (userId === owner.userId && action !== 'update') {
    throw new OwnerPeopleOperationError(
      'The signed-in owner cannot revoke their own access.',
      400,
      'owner_person_protected',
    );
  }

  let entitlementLock: { userId: string; token: string; acquiredAt: number } | null = null;
  try {
    if (action !== 'deactivate_history') {
      const token = await acquireBillingEntitlementLock({ clerkUserId: userId });
      if (!token) {
        throw new OwnerPeopleOperationError(
          'This account is being updated. Retry in a moment.',
          409,
          'owner_operations_conflict',
        );
      }
      entitlementLock = { userId, token, acquiredAt: Date.now() };
    }

    const profile = await findProfile(userId);
    const warnings: string[] = [];
    let account: OwnerAccountSummary | null = null;

    if (action === 'deactivate_history') {
      if (!profile) {
        throw new OwnerPeopleOperationError(
          'Retained contributor profile not found.',
          404,
          'owner_person_unavailable',
        );
      }
      await updateContributorProfileControl({
        contributorId: userId,
        status: 'inactive',
        canDraftCampaigns: false,
        monthlySubmissionLimitOverride: profile.monthly_submission_limit_override ?? null,
        monthlyPublishedRequirementOverride: profile.monthly_published_requirement_override ?? null,
        ownerNote: profile.owner_note ?? '',
      });
    } else {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const currentAccount = mapOwnerAccountSummary(user);
      const targetOwnerAccess = resolveOwnerAccess({
        authConfigured: true,
        isSignedIn: true,
        emailAddresses: user.emailAddresses.map((address) => address.emailAddress),
        publicMetadata: user.publicMetadata,
        privateMetadata: user.privateMetadata,
      });
      if (userId === owner.userId && input.account?.owner !== true) {
        throw new OwnerPeopleOperationError(
          'Keep owner access enabled for the signed-in owner.',
          400,
          'owner_person_protected',
        );
      }

      const normalizedAccount = action === 'revoke'
        ? { ok: true as const, value: { commercialPlan: 'free' as const, contributor: false, owner: false, note: currentAccount.note } }
        : normalizeOwnerAccountRoleInput(input.account ?? {});
      if (!normalizedAccount.ok) {
        throw new OwnerPeopleOperationError(
          normalizedAccount.message,
          400,
          'owner_person_invalid',
        );
      }
      const accountValue = normalizedAccount.value;
      if (targetOwnerAccess.source === 'environment' && !accountValue.owner) {
        throw new OwnerPeopleOperationError(
          'This owner is controlled by the Vercel owner-email allowlist. Change that provider setting before removing owner authority.',
          400,
          'owner_person_protected',
        );
      }

      const privateMetadata = buildOwnerAccountMetadataPatch({
        existingMetadata: user.privateMetadata ?? {},
        input: accountValue,
      });
      if (!entitlementLock || Date.now() - entitlementLock.acquiredAt >= 30_000) {
        throw new OwnerPeopleOperationError(
          'Account verification took too long. Retry with current state.',
          503,
          'owner_people_unavailable',
        );
      }
      await client.users.updateUserMetadata(userId, { privateMetadata });
      account = mapOwnerAccountSummary(await client.users.getUser(userId));

      if (profile || accountValue.contributor || accountValue.owner) {
        const requestedStatus = input.contributor?.status;
        const status: ContributorProfileStatus = action === 'revoke' || (!accountValue.contributor && !accountValue.owner)
          ? 'inactive'
          : typeof requestedStatus === 'string' && CONTRIBUTOR_PROFILE_STATUSES.includes(requestedStatus as ContributorProfileStatus)
            ? requestedStatus as ContributorProfileStatus
            : profile?.status ?? 'active';
        try {
          if (!profile) {
            await upsertContributorProfile({
              contributorId: userId,
              email: account.email,
              firstName: user.firstName,
              lastName: user.lastName,
            });
          }
          await updateContributorProfileControl({
            contributorId: userId,
            status,
            canDraftCampaigns: action !== 'revoke' && input.contributor?.canDraftCampaigns === true,
            monthlySubmissionLimitOverride: normalizeNullableOverride(
              input.contributor?.monthlySubmissionLimitOverride ?? profile?.monthly_submission_limit_override,
              1,
              250,
            ),
            monthlyPublishedRequirementOverride: normalizeNullableOverride(
              input.contributor?.monthlyPublishedRequirementOverride ?? profile?.monthly_published_requirement_override,
              0,
              100,
            ),
            ownerNote: typeof input.contributor?.ownerNote === 'string'
              ? input.contributor.ownerNote
              : profile?.owner_note ?? '',
          });
        } catch (error) {
          if (error instanceof OwnerPeopleOperationError) throw error;
          warnings.push('Clerk access changed, but the retained contributor profile did not update. Retry this action to reconcile it.');
          console.error('Owner people update partially completed:', error);
        }
      }
    }

    const activityRecorded = await recordOwnerActivity({
      actorUserId: owner.userId,
      actorEmail: owner.email,
      action: `people.${action}`,
      targetType: 'person',
      targetId: userId,
      summary: action === 'revoke'
        ? 'Revoked CardForge contributor and owner authority while preserving contribution history.'
        : action === 'deactivate_history'
          ? 'Deactivated a contributor profile whose Clerk account is no longer present.'
          : 'Updated account entitlement and contributor controls.',
      outcome: warnings.length ? 'partial' : 'succeeded',
      metadata: { warnings },
    });
    if (!activityRecorded) warnings.push('The change completed, but owner history could not record it.');
    return { account, warnings };
  } finally {
    if (entitlementLock) {
      await releaseBillingEntitlementLock({
        clerkUserId: entitlementLock.userId,
        leaseToken: entitlementLock.token,
      });
    }
  }
};

export const deleteOwnerPerson = async (
  input: DeleteOwnerPersonInput,
): Promise<{ warnings: string[] }> => {
  const owner = await requireOwnerActor();
  const userId = requireUserId(input.userId);
  const confirmation = typeof input.confirmation === 'string' ? input.confirmation.trim().toLowerCase() : '';
  if (userId === owner.userId) {
    throw new OwnerPeopleOperationError(
      'The signed-in owner account cannot be deleted here.',
      400,
      'owner_person_protected',
    );
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const account = mapOwnerAccountSummary(user);
  const targetOwnerAccess = resolveOwnerAccess({
    authConfigured: true,
    isSignedIn: true,
    emailAddresses: user.emailAddresses.map((address) => address.emailAddress),
    publicMetadata: user.publicMetadata,
    privateMetadata: user.privateMetadata,
  });
  if (targetOwnerAccess.isOwner) {
    throw new OwnerPeopleOperationError(
      targetOwnerAccess.source === 'environment'
        ? 'Remove this email from the Vercel owner allowlist before deleting the account.'
        : 'Remove owner authority before deleting this account.',
      400,
      'owner_person_protected',
    );
  }
  if (!confirmation || confirmation !== (account.email ?? userId).toLowerCase()) {
    throw new OwnerPeopleOperationError(
      `Type ${account.email ?? userId} to confirm account deletion.`,
      400,
      'owner_person_confirmation_required',
    );
  }

  await client.users.deleteUser(userId);
  const profile = await findProfile(userId);
  const warnings: string[] = [];
  if (profile) {
    try {
      await updateContributorProfileControl({
        contributorId: userId,
        status: 'inactive',
        canDraftCampaigns: false,
        monthlySubmissionLimitOverride: profile.monthly_submission_limit_override ?? null,
        monthlyPublishedRequirementOverride: profile.monthly_published_requirement_override ?? null,
        ownerNote: profile.owner_note ?? '',
      });
    } catch (error) {
      warnings.push('The Clerk account was deleted, but the retained contribution profile could not be marked inactive.');
      console.error('Deleted Clerk account but failed to deactivate retained profile:', error);
    }
  }

  const activityRecorded = await recordOwnerActivity({
    actorUserId: owner.userId,
    actorEmail: owner.email,
    action: 'people.account.delete',
    targetType: 'person',
    targetId: userId,
    summary: 'Deleted a Clerk account and preserved its historical CardForge contribution attribution.',
    outcome: warnings.length ? 'partial' : 'succeeded',
    metadata: { email: account.email, warnings },
  });
  if (!activityRecorded) warnings.push('The deletion completed, but owner history could not record it.');
  return { warnings };
};

export const ownerPeopleErrorFromUnknown = (error: unknown): OwnerPeopleOperationError | null => {
  if (error instanceof OwnerPeopleOperationError) return error;
  if (error instanceof ContributorAccessStoreError) {
    return new OwnerPeopleOperationError(
      error.message,
      error.status,
      error.status >= 500 ? 'owner_people_unavailable' : 'owner_person_invalid',
    );
  }
  return null;
};
