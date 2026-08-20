import { CloudSetStoreError, deleteCloudSet, getCloudSet } from '@/features/project/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getCloudSetAccount, toCloudSetErrorResponse } from '../_helpers';

export const dynamic = 'force-dynamic';

const readSetId = async (context: { params: Promise<{ setId: string }> }) => {
  const value = (await context.params).setId?.trim();
  return value && value.length <= 160 ? value : null;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ setId: string }> },
) {
  try {
    const setId = await readSetId(context);
    if (!setId) throw new CloudSetStoreError('A valid cloud set id is required.', 400);
    const account = await getCloudSetAccount();
    return createNoStoreJsonResponse(await getCloudSet(account.ownerUserId, setId));
  } catch (error) {
    return toCloudSetErrorResponse(error, 'Unable to load the cloud set.');
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ setId: string }> },
) {
  try {
    const setId = await readSetId(context);
    if (!setId) throw new CloudSetStoreError('A valid cloud set id is required.', 400);
    const account = await getCloudSetAccount();
    await deleteCloudSet(account.ownerUserId, setId);
    return createNoStoreJsonResponse({ ok: true });
  } catch (error) {
    return toCloudSetErrorResponse(error, 'Unable to remove the cloud set.');
  }
}
