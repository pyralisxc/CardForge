import {
  prepareCloudSetUploads,
  type CloudSetAssetDescriptor,
} from '@/features/project/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getCloudSetAccount, parseCloudSetJson, toCloudSetErrorResponse } from '../_helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const account = await getCloudSetAccount();
    const body = await parseCloudSetJson(request);
    const prepared = await prepareCloudSetUploads({
      ownerUserId: account.ownerUserId,
      slotLimit: account.slotLimit,
      setId: typeof body.setId === 'string' ? body.setId : '',
      name: typeof body.name === 'string' ? body.name : '',
      payload: body.payload,
      assets: Array.isArray(body.assets) ? body.assets as CloudSetAssetDescriptor[] : [],
    });
    return createNoStoreJsonResponse(prepared);
  } catch (error) {
    return toCloudSetErrorResponse(error, 'Unable to prepare the cloud set upload.');
  }
}
