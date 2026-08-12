import { resolveAccountEntitlement } from '@/features/account/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import {
  createUploadedDeveloperAssetSubmission,
  DeveloperAssetStoreError,
  getDeveloperAssetProgramView,
  updateDeveloperProfileOverrides,
  updateDeveloperProgramSettings,
} from '@/features/developer-assets/server';
import { upsertDeveloperProfile } from '@/features/developer-access/server';
import { getCurrentCardforgeUserAccess } from '@/features/account/server';
import { getCurrentOwnerAccess } from '@/features/owner/server';
import { createServerTimingTracker } from '@/infrastructure/http/serverTiming';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

const getDeveloperAccess = async () => {
  const { authConfigured, user, ownerAccess } = await getCurrentCardforgeUserAccess();

  if (!user) {
    return {
      ok: false as const,
      response: createApiErrorResponse(401, 'sign_in_required', 'Sign in before using developer asset tools.'),
    };
  }

  const entitlement = resolveAccountEntitlement({
    authConfigured,
    isSignedIn: true,
    emailAddresses: user.emailAddresses,
    privateMetadata: user.privateMetadata,
    ownerAccess,
  });

  const isDeveloper = entitlement.accessMode === 'dev';
  if (!isDeveloper && !ownerAccess.isOwner) {
    return {
      ok: false as const,
      response: createApiErrorResponse(403, 'developer_access_required', 'Developer access is required for asset submissions.'),
    };
  }

  return {
    ok: true as const,
    user,
    ownerAccess,
    isOwner: ownerAccess.isOwner,
    isDeveloper,
    email: user.email,
  };
};

const getOwnerAccess = async () => {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner || !owner.userId) {
    return {
      ok: false as const,
      response: createApiErrorResponse(403, 'owner_access_required', 'Owner access is required for developer program settings.'),
    };
  }
  return { ok: true as const, owner };
};

const getContributorIds = (userId: string) => [userId];

const syncDeveloperProfile = async (access: Awaited<ReturnType<typeof getDeveloperAccess>> & { ok: true }) => {
  await upsertDeveloperProfile({
    developerId: access.user.id,
    email: access.email,
    firstName: access.user.firstName,
    lastName: access.user.lastName,
  });
};

export async function GET() {
  const timing = createServerTimingTracker();
  try {
    const access = await timing.track('developer_access', getDeveloperAccess);
    if (!access.ok) return access.response;
    await timing.track('profile_sync', () => syncDeveloperProfile(access));
    const program = await timing.track(
      'program_view',
      () => getDeveloperAssetProgramView(access.user.id, getContributorIds(access.user.id)),
    );

    const response = createNoStoreJsonResponse({
      ownerAccess: access.ownerAccess,
      isDeveloper: access.isDeveloper,
      isOwner: access.isOwner,
      program,
    });
    response.headers.set('Server-Timing', timing.header());
    return response;
  } catch (error) {
    console.error('Failed to load developer asset program:', error);
    return createApiErrorResponse(
      500,
      'developer_asset_unavailable',
      'Unable to load developer asset program.'
    );
  }
}

export async function POST(request: Request) {
  try {
    const access = await getDeveloperAccess();
    if (!access.ok) return access.response;
    const rateLimit = await consumeRateLimit({
      action: 'developer-submission',
      identity: access.user.id,
      limit: 30,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createApiErrorResponse(429, 'rate_limited', 'Too many developer submissions. Please try again later.');
    }
    await syncDeveloperProfile(access);

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return createApiErrorResponse(400, 'developer_asset_request_invalid', 'Choose a source file to upload.');
    }
    const program = await createUploadedDeveloperAssetSubmission({
      developerId: access.user.id,
      developerEmail: access.email,
      currentContributorIds: getContributorIds(access.user.id),
      assetType: formData.get('assetType'),
      name: formData.get('name'),
      description: formData.get('description'),
      previewUrl: formData.get('previewUrl'),
      file,
    });
    return createNoStoreJsonResponse({ program }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return createApiErrorResponse(503, 'developer_asset_unavailable', error.message);
    }
    if (error instanceof DeveloperAssetStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 503 ? 'developer_asset_unavailable' : 'developer_asset_request_invalid',
        error.message
      );
    }

    console.error('Failed to create developer asset submission:', error);
    return createApiErrorResponse(
      500,
      'developer_asset_request_invalid',
      'Unable to create developer asset submission.'
    );
  }
}

export async function PUT(request: Request) {
  try {
    const access = await getOwnerAccess();
    if (!access.ok) return access.response;

    const ownerUserId = access.owner.userId;
    if (!ownerUserId) {
      return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required for developer program settings.');
    }
    const body = await request.json() as { settings?: Record<string, unknown> };
    const program = await updateDeveloperProgramSettings(
      body.settings ?? {},
      ownerUserId,
      getContributorIds(ownerUserId)
    );
    return createNoStoreJsonResponse({ program });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof DeveloperAssetStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 503 ? 'developer_asset_unavailable' : 'developer_asset_request_invalid',
        error.message
      );
    }

    console.error('Failed to update developer asset settings:', error);
    return createApiErrorResponse(
      500,
      'developer_asset_request_invalid',
      'Unable to update developer asset settings.'
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await getOwnerAccess();
    if (!access.ok) return access.response;

    const ownerUserId = access.owner.userId;
    if (!ownerUserId) {
      return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required for developer profile settings.');
    }
    const body = await request.json() as {
      developerId?: unknown;
      profile?: {
        status?: unknown;
        monthlySubmissionLimitOverride?: unknown;
        monthlyPublishedRequirementOverride?: unknown;
        profitShareEligible?: unknown;
        ownerNote?: unknown;
      };
    };
    const program = await updateDeveloperProfileOverrides({
      developerId: typeof body.developerId === 'string' ? body.developerId : '',
      input: body.profile ?? {},
      currentUserId: ownerUserId,
      currentContributorIds: getContributorIds(ownerUserId),
    });
    return createNoStoreJsonResponse({ program });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof DeveloperAssetStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 503 ? 'developer_asset_unavailable' : 'developer_asset_request_invalid',
        error.message
      );
    }

    console.error('Failed to update developer profile settings:', error);
    return createApiErrorResponse(
      500,
      'developer_asset_request_invalid',
      'Unable to update developer profile settings.'
    );
  }
}
