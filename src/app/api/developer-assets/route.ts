import { currentUser } from '@clerk/nextjs/server';

import { resolveAccountEntitlement } from '@/lib/accountEntitlement';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import {
  createDeveloperAssetSubmission,
  DeveloperAssetStoreError,
  getDeveloperAssetProgramView,
  updateDeveloperProgramSettings,
} from '@/lib/developerAssetStore';
import { getCurrentOwnerAccess } from '@/lib/serverOwnerAccess';

export const dynamic = 'force-dynamic';

const getDeveloperAccess = async () => {
  const [user, ownerAccess] = await Promise.all([
    currentUser(),
    getCurrentOwnerAccess(),
  ]);

  if (!user) {
    return {
      ok: false as const,
      response: createApiErrorResponse(401, 'sign_in_required', 'Sign in before using developer asset tools.'),
    };
  }

  const entitlement = resolveAccountEntitlement({
    authConfigured: true,
    isSignedIn: true,
    emailAddresses: user.emailAddresses.map((email) => email.emailAddress),
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
    email: user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null,
  };
};

const getOwnerAccess = async () => {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner) {
    return {
      ok: false as const,
      response: createApiErrorResponse(403, 'owner_access_required', 'Owner access is required for developer program settings.'),
    };
  }
  return { ok: true as const, owner };
};

export async function GET() {
  try {
    const access = await getDeveloperAccess();
    if (!access.ok) return access.response;

    return createNoStoreJsonResponse({
      ownerAccess: access.ownerAccess,
      isDeveloper: access.isDeveloper,
      isOwner: access.isOwner,
      program: await getDeveloperAssetProgramView(access.user.id),
    });
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

    const body = await request.json() as {
      assetType?: unknown;
      name?: unknown;
      description?: unknown;
      previewUrl?: unknown;
      sourceUrl?: unknown;
      sourceFileSizeBytes?: unknown;
      sourceMimeType?: unknown;
      sourceStorageBucket?: unknown;
      sourceStoragePath?: unknown;
    };

    const program = await createDeveloperAssetSubmission({
      developerId: access.user.id,
      developerEmail: access.email,
      input: body,
    });
    return createNoStoreJsonResponse({ program }, { status: 201 });
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

    const body = await request.json() as { settings?: Record<string, unknown> };
    const program = await updateDeveloperProgramSettings(body.settings ?? {});
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
