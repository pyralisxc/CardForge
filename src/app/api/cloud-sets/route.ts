import {
  listCloudSets,
  saveCloudSet,
  type CloudSetAssetDescriptor,
} from '@/features/project/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getCloudSetAccount, parseCloudSetJson, toCloudSetErrorResponse } from './_helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const account = await getCloudSetAccount();
    return createNoStoreJsonResponse(await listCloudSets(account.ownerUserId, account.slotLimit));
  } catch (error) {
    return toCloudSetErrorResponse(error, 'Unable to list cloud-saved sets.');
  }
}

export async function POST(request: Request) {
  try {
    const account = await getCloudSetAccount();
    const body = await parseCloudSetJson(request);
    const summary = await saveCloudSet({
      ownerUserId: account.ownerUserId,
      slotLimit: account.slotLimit,
      setId: typeof body.setId === 'string' ? body.setId : '',
      name: typeof body.name === 'string' ? body.name : '',
      payload: body.payload,
      assets: Array.isArray(body.assets) ? body.assets as CloudSetAssetDescriptor[] : [],
      expectedRevision: Number.isInteger(body.expectedRevision) ? Number(body.expectedRevision) : null,
    });
    return createNoStoreJsonResponse({ summary });
  } catch (error) {
    return toCloudSetErrorResponse(error, 'Unable to save the cloud set.');
  }
}
