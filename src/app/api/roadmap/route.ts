import { currentUser } from '@clerk/nextjs/server';

import { resolveWithTimeout } from '@/shared/asyncTimeout';
import { resolveOwnerAccess } from '@/domain/entitlements';
import { createContributorRoadmapItem, createRoadmapSuggestion, getRoadmapForUser, RoadmapStoreError } from '@/features/roadmap/server';
import { createApiErrorResponse, createNoStoreJsonResponse, createRateLimitErrorResponse } from '@/infrastructure/http/apiResponses';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';
const CLERK_READ_TIMEOUT_MS = 3000;

export async function GET() {
  try {
    const user = await resolveWithTimeout(currentUser(), {
      fallback: null,
      timeoutMs: CLERK_READ_TIMEOUT_MS,
    });
    return createNoStoreJsonResponse(await getRoadmapForUser(user?.id ?? null));
  } catch (error) {
    console.error('Failed to load roadmap:', error);
    return createApiErrorResponse(
      500,
      'roadmap_database_unavailable',
      'Unable to load the Card Forge roadmap.'
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return createApiErrorResponse(
        401,
        'sign_in_required',
        'Sign in before suggesting a feature.'
      );
    }

    const rateLimit = await consumeRateLimit({
      action: 'roadmap-create',
      identity: user.id,
      limit: 10,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse('Too many roadmap submissions.', {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        resource: 'roadmap_submissions',
        maximum: 10,
        unit: 'attempts_per_hour',
      });
    }

    const body = await request.json() as {
      title?: unknown;
      description?: unknown;
      itemType?: unknown;
      status?: unknown;
      visibleMonth?: unknown;
      monthlyCostCents?: unknown;
      expenseProvider?: unknown;
      expensePlan?: unknown;
      expenseSourceUrl?: unknown;
      expenseVerifiedAt?: unknown;
      developerItem?: unknown;
    };

    const userEmail = user.primaryEmailAddress?.emailAddress ?? null;
    const wantsDeveloperItem = body.developerItem === true;
    const emailAddresses = user.emailAddresses.map((email) => email.emailAddress);
    const ownerAccess = resolveOwnerAccess({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses,
      publicMetadata: user.publicMetadata,
      privateMetadata: user.privateMetadata,
    });
    if (wantsDeveloperItem) {
      if (!ownerAccess.isOwner) {
        return createApiErrorResponse(
          403,
          'owner_access_required',
          'Owner access is required to manage CardForge-authored timeline items.'
        );
      }

      const payload = await createContributorRoadmapItem({
        userId: user.id,
        userEmail,
        title: body.title,
        description: body.description,
        itemType: body.itemType,
        status: body.status,
        visibleMonth: body.visibleMonth,
        monthlyCostCents: body.monthlyCostCents,
        expenseProvider: body.expenseProvider,
        expensePlan: body.expensePlan,
        expenseSourceUrl: body.expenseSourceUrl,
        expenseVerifiedAt: body.expenseVerifiedAt,
      });

      return createNoStoreJsonResponse(payload, { status: 201 });
    }

    const payload = await createRoadmapSuggestion({
      userId: user.id,
      userEmail,
      title: body.title,
    });

    return createNoStoreJsonResponse(payload, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof RateLimitUnavailableError) {
      return createApiErrorResponse(503, 'roadmap_database_unavailable', error.message);
    }
    if (error instanceof RoadmapStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 503 ? 'roadmap_database_unavailable' : 'roadmap_request_invalid',
        error.message
      );
    }

    console.error('Failed to create roadmap suggestion:', error);
    return createApiErrorResponse(
      500,
      'roadmap_request_invalid',
      'Unable to create feature suggestion.'
    );
  }
}
