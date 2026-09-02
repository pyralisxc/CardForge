import { clerkClient } from '@clerk/nextjs/server';
import { resolveOwnerAccess } from '@/domain/entitlements';

import {
  buildOwnerAccountMetadataPatch,
  mapOwnerAccountSummary,
  normalizeOwnerAccountRoleInput,
} from '@/features/account/server';
import {
  CONTRIBUTOR_PROFILE_STATUSES,
  ContributorAccessStoreError,
  fetchContributorProfileRows,
  updateContributorProfileControl,
  upsertContributorProfile,
  type ContributorProfileStatus,
} from '@/features/contributor-access/server';
import {
  getCurrentOwnerAccess,
  getOwnerPeople,
  recordOwnerActivity,
} from '@/features/owner/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

const requireOwner = async () => {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner || !owner.userId) return null;
  return { ...owner, userId: owner.userId };
};

const readPage = (value: string | null, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : fallback;
};

const normalizeNullableOverride = (value: unknown, minimum: number, maximum: number): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new Error(`Contributor override must be between ${minimum} and ${maximum}, or left blank.`);
  return Math.trunc(parsed);
};

const findProfile = async (contributorId: string) => (
  (await fetchContributorProfileRows()).find((profile) => profile.clerk_user_id === contributorId) ?? null
);

export async function GET(request: Request) {
  const owner = await requireOwner();
  if (!owner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  try {
    const url = new URL(request.url);
    const requestedFilter = url.searchParams.get('filter');
    const filter = requestedFilter === 'contributors' || requestedFilter === 'active' || requestedFilter === 'needs_attention'
      ? requestedFilter
      : 'all';
    const people = await getOwnerPeople({
      query: url.searchParams.get('query') ?? '',
      filter,
      page: readPage(url.searchParams.get('page'), 1),
      pageSize: readPage(url.searchParams.get('pageSize'), 12),
    });
    return createNoStoreJsonResponse({ people });
  } catch (error) {
    console.error('Failed to load owner people directory:', error);
    return createApiErrorResponse(500, 'owner_people_unavailable', 'Unable to load people and contributor access.');
  }
}

export async function PATCH(request: Request) {
  const owner = await requireOwner();
  if (!owner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  try {
    const body = await request.json() as {
      action?: unknown;
      userId?: unknown;
      account?: Record<string, unknown>;
      contributor?: Record<string, unknown>;
    };
    const action = body.action === 'revoke' || body.action === 'deactivate_history' ? body.action : 'update';
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    if (!userId) return createApiErrorResponse(400, 'owner_person_invalid', 'Choose an account or retained profile.');
    if (userId === owner.userId && action !== 'update') {
      return createApiErrorResponse(400, 'owner_person_protected', 'The signed-in owner cannot revoke their own access.');
    }
    const client = await clerkClient();
    const profile = await findProfile(userId);
    const warnings: string[] = [];
    let account = null;

    if (action === 'deactivate_history') {
      if (!profile) return createApiErrorResponse(404, 'owner_person_unavailable', 'Retained contributor profile not found.');
      await updateContributorProfileControl({
        contributorId: userId,
        status: 'inactive',
        canDraftCampaigns: false,
        monthlySubmissionLimitOverride: profile.monthly_submission_limit_override ?? null,
        monthlyPublishedRequirementOverride: profile.monthly_published_requirement_override ?? null,
        ownerNote: profile.owner_note ?? '',
      });
    } else {
      const user = await client.users.getUser(userId);
      const currentAccount = mapOwnerAccountSummary(user);
      const targetOwnerAccess = resolveOwnerAccess({ authConfigured: true, isSignedIn: true, emailAddresses: user.emailAddresses.map((address) => address.emailAddress), publicMetadata: user.publicMetadata, privateMetadata: user.privateMetadata });
      if (userId === owner.userId && body.account?.owner !== true) {
        return createApiErrorResponse(400, 'owner_person_protected', 'Keep owner access enabled for the signed-in owner.');
      }
      const normalizedAccount = action === 'revoke'
        ? { commercialPlan: 'free' as const, contributor: false, owner: false, note: currentAccount.note }
        : normalizeOwnerAccountRoleInput(body.account ?? {});
      if ('ok' in normalizedAccount && !normalizedAccount.ok) {
        return createApiErrorResponse(400, 'owner_person_invalid', normalizedAccount.message);
      }
      const accountValue = 'ok' in normalizedAccount ? normalizedAccount.value : normalizedAccount;
      if (targetOwnerAccess.source === 'environment' && !accountValue.owner) {
        return createApiErrorResponse(400, 'owner_person_protected', 'This owner is controlled by the Vercel owner-email allowlist. Change that provider setting before removing owner authority.');
      }
      const privateMetadata = buildOwnerAccountMetadataPatch({ existingMetadata: user.privateMetadata ?? {}, input: accountValue });
      await client.users.updateUserMetadata(userId, { privateMetadata });
      account = mapOwnerAccountSummary(await client.users.getUser(userId));

      if (profile || accountValue.contributor || accountValue.owner) {
        if (!profile) {
          await upsertContributorProfile({
            contributorId: userId,
            email: account.email,
            firstName: user.firstName,
            lastName: user.lastName,
          });
        }
        const requestedStatus = body.contributor?.status;
        const status: ContributorProfileStatus = action === 'revoke' || (!accountValue.contributor && !accountValue.owner)
          ? 'inactive'
          : typeof requestedStatus === 'string' && CONTRIBUTOR_PROFILE_STATUSES.includes(requestedStatus as ContributorProfileStatus)
            ? requestedStatus as ContributorProfileStatus
            : profile?.status ?? 'active';
        try {
          await updateContributorProfileControl({
            contributorId: userId,
            status,
            canDraftCampaigns: action !== 'revoke' && body.contributor?.canDraftCampaigns === true,
            monthlySubmissionLimitOverride: normalizeNullableOverride(body.contributor?.monthlySubmissionLimitOverride ?? profile?.monthly_submission_limit_override, 1, 250),
            monthlyPublishedRequirementOverride: normalizeNullableOverride(body.contributor?.monthlyPublishedRequirementOverride ?? profile?.monthly_published_requirement_override, 0, 100),
            ownerNote: typeof body.contributor?.ownerNote === 'string' ? body.contributor.ownerNote : profile?.owner_note ?? '',
          });
        } catch (error) {
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
    return createNoStoreJsonResponse({ account, warnings });
  } catch (error) {
    if (error instanceof SyntaxError) return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    if (error instanceof ContributorAccessStoreError) return createApiErrorResponse(error.status, 'owner_person_invalid', error.message);
    if (error instanceof Error && error.message.startsWith('Contributor override must be')) return createApiErrorResponse(400, 'owner_person_invalid', error.message);
    console.error('Failed to update owner person:', error);
    return createApiErrorResponse(500, 'owner_people_unavailable', 'Unable to update account and contributor access.');
  }
}

export async function DELETE(request: Request) {
  const owner = await requireOwner();
  if (!owner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  try {
    const body = await request.json() as { userId?: unknown; confirmation?: unknown };
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const confirmation = typeof body.confirmation === 'string' ? body.confirmation.trim().toLowerCase() : '';
    if (!userId || userId === owner.userId) return createApiErrorResponse(400, 'owner_person_protected', 'The signed-in owner account cannot be deleted here.');
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const account = mapOwnerAccountSummary(user);
    const targetOwnerAccess = resolveOwnerAccess({ authConfigured: true, isSignedIn: true, emailAddresses: user.emailAddresses.map((address) => address.emailAddress), publicMetadata: user.publicMetadata, privateMetadata: user.privateMetadata });
    if (targetOwnerAccess.isOwner) return createApiErrorResponse(400, 'owner_person_protected', targetOwnerAccess.source === 'environment' ? 'Remove this email from the Vercel owner allowlist before deleting the account.' : 'Remove owner authority before deleting this account.');
    if (!confirmation || confirmation !== (account.email ?? userId).toLowerCase()) {
      return createApiErrorResponse(400, 'owner_person_confirmation_required', `Type ${account.email ?? userId} to confirm account deletion.`);
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
    return createNoStoreJsonResponse({ warnings });
  } catch (error) {
    if (error instanceof SyntaxError) return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    console.error('Failed to delete owner-managed account:', error);
    return createApiErrorResponse(500, 'owner_people_unavailable', 'Unable to delete this account.');
  }
}
