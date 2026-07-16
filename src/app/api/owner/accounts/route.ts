import { clerkClient } from '@clerk/nextjs/server';

import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import {
  buildOwnerAccountMetadataPatch,
  mapOwnerAccountSummary,
  normalizeOwnerAccountRoleInput,
} from '@/features/owner/server';
import { getCurrentOwnerAccess } from '@/features/owner/server';

export const dynamic = 'force-dynamic';

const findUserByEmail = async (email: string) => {
  const client = await clerkClient();
  const response = await client.users.getUserList({ emailAddress: [email], limit: 1 });
  return response.data[0] ?? null;
};

export async function POST(request: Request) {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner) {
    return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  }

  const body = await request.json().catch(() => null) as { email?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) {
    return createApiErrorResponse(400, 'owner_account_invalid', 'Email is required.');
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return createApiErrorResponse(404, 'owner_account_unavailable', 'No Clerk user was found for that email.');
  }

  return createNoStoreJsonResponse({ account: mapOwnerAccountSummary(user) });
}

export async function PATCH(request: Request) {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner) {
    return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  }

  const body = await request.json().catch(() => null) as { userId?: unknown; role?: Record<string, unknown> } | null;
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  if (!userId) {
    return createApiErrorResponse(400, 'owner_account_invalid', 'User id is required.');
  }

  const normalized = normalizeOwnerAccountRoleInput(body?.role ?? {});
  if (!normalized.ok) {
    return createApiErrorResponse(400, 'owner_account_invalid', normalized.message);
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const privateMetadata = buildOwnerAccountMetadataPatch({
      existingMetadata: user.privateMetadata ?? {},
      input: normalized.value,
    });

    await client.users.updateUserMetadata(userId, { privateMetadata });
    const updatedUser = await client.users.getUser(userId);

    return createNoStoreJsonResponse({ account: mapOwnerAccountSummary(updatedUser) });
  } catch (error) {
    console.error('Failed to update owner-managed account metadata:', error);
    return createApiErrorResponse(500, 'owner_account_unavailable', 'Unable to update account.');
  }
}
