import { timingSafeEqual } from 'node:crypto';

import { dispatchDueMarketingDeliveries } from '@/features/marketing/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const authorized = (request: Request): boolean => {
  const configured = process.env.CARDFORGE_MARKETING_DISPATCH_SECRET ?? '';
  const received = request.headers.get('authorization')?.replace(/^Bearer\s+/iu, '') ?? '';
  const left = Buffer.from(configured);
  const right = Buffer.from(received);
  return Boolean(configured) && left.length === right.length && timingSafeEqual(left, right);
};

export async function POST(request: Request) {
  if (!authorized(request)) {
    return createApiErrorResponse(403, 'owner_access_required', 'Marketing dispatcher authorization failed.');
  }
  try {
    return createNoStoreJsonResponse(await dispatchDueMarketingDeliveries());
  } catch (error) {
    console.error('Marketing dispatch failed:', error);
    return createApiErrorResponse(500, 'social_publishing_unavailable', error instanceof Error ? error.message : 'Marketing dispatch failed.');
  }
}
