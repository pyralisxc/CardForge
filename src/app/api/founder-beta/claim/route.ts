import { clerkClient, currentUser } from '@clerk/nextjs/server';

import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import {
  claimFounderBetaAccess,
  FounderBetaStoreError,
  isClerkAuthConfigured,
  resolveAccountEntitlement,
} from '@/features/account/server';
import { resolveOwnerAccess } from '@/domain/entitlements';
import { consumeRateLimit, getRequestClientAddress, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

const claimFailureCopy: Record<string, string> = {
  campaign_paused: 'Founder Beta claiming is paused right now.',
  manual_grant_required: 'Founder Beta access is currently being granted manually.',
  release_slots_full: 'This Founder Beta wave is full. More slots may open as the forge stabilizes.',
  not_configured: 'Founder Beta is not configured yet.',
};

export async function POST(request: Request) {
  try {
    if (!isClerkAuthConfigured()) {
      return createApiErrorResponse(
        503,
        'account_auth_unconfigured',
        'Account sign-in is not configured yet.'
      );
    }

    const user = await currentUser();
    if (!user) {
      return createApiErrorResponse(401, 'sign_in_required', 'Sign in before claiming Founder Beta access.');
    }

    const decisions = await Promise.all([
      consumeRateLimit({ action: 'founder-claim-user', identity: user.id, limit: 5, windowSeconds: 3600 }),
      consumeRateLimit({ action: 'founder-claim-ip', identity: getRequestClientAddress(request), limit: 20, windowSeconds: 3600 }),
    ]);
    if (decisions.some((decision) => !decision.allowed)) {
      return createApiErrorResponse(429, 'rate_limited', 'Too many claim attempts. Please try again later.');
    }

    const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
    const result = await claimFounderBetaAccess({ userId: user.id, email });

    if (!result.claimed || !result.access_expires_at) {
      return createApiErrorResponse(
        409,
        'founder_beta_claim_unavailable',
        claimFailureCopy[result.reason] ?? 'Founder Beta access is unavailable right now.'
      );
    }

    const privateMetadata = {
      ...user.privateMetadata,
      cardforgeAccess: 'paid',
      cardforgeAccessExpiresAt: result.access_expires_at,
      cardforgeFounderBetaClaimedAt: new Date().toISOString(),
    };
    const client = await clerkClient();
    await client.users.updateUserMetadata(user.id, {
      privateMetadata,
    });
    const emailAddresses = user.emailAddresses.map((emailAddress) => emailAddress.emailAddress);
    const ownerAccess = resolveOwnerAccess({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses,
      privateMetadata,
      publicMetadata: user.publicMetadata,
    });

    return createNoStoreJsonResponse({
      ok: true,
      accessExpiresAt: result.access_expires_at,
      entitlement: resolveAccountEntitlement({
        authConfigured: true,
        isSignedIn: true,
        emailAddresses,
        privateMetadata,
        ownerAccess,
      }),
      reason: result.reason,
      campaign: result.campaign,
      claimedSlots: result.claimed_slots,
      releaseSlotCap: result.release_slot_cap,
      publicSlotCap: result.public_slot_cap,
    });
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return createApiErrorResponse(503, 'service_unavailable', error.message);
    }
    if (error instanceof FounderBetaStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 503 ? 'founder_beta_unavailable' : 'founder_beta_claim_unavailable',
        error.message
      );
    }

    console.error('Failed to claim Founder Beta access:', error);
    return createApiErrorResponse(
      500,
      'founder_beta_claim_unavailable',
      'Unable to claim Founder Beta access.'
    );
  }
}
