import { currentUser } from '@clerk/nextjs/server';

import { resolveAccountEntitlement } from '@/lib/accountEntitlement';
import { resolveWithTimeout } from '@/lib/asyncTimeout';
import { resolveOwnerAccess } from '@/lib/ownerAccess';
import { createDeveloperRoadmapItem, createRoadmapSuggestion, getRoadmapForUser, RoadmapStoreError } from '@/lib/roadmapStore';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';

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

    const body = await request.json() as {
      title?: unknown;
      description?: unknown;
      itemType?: unknown;
      status?: unknown;
      visibleMonth?: unknown;
      targetMrrCents?: unknown;
      monthlyCostCents?: unknown;
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
    const entitlement = resolveAccountEntitlement({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses,
      privateMetadata: user.privateMetadata,
      ownerAccess,
    });

    if (wantsDeveloperItem) {
      if (entitlement.accessMode !== 'dev') {
        return createApiErrorResponse(
          403,
          'roadmap_request_invalid',
          'Developer access is required to manage official timeline items.'
        );
      }

      const payload = await createDeveloperRoadmapItem({
        userId: user.id,
        userEmail,
        title: body.title,
        description: body.description,
        itemType: body.itemType,
        status: body.status,
        visibleMonth: body.visibleMonth,
        targetMrrCents: body.targetMrrCents,
        monthlyCostCents: body.monthlyCostCents,
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
