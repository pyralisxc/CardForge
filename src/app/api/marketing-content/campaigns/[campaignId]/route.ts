import { getCurrentAccountToolAccess } from '@/features/account/server';
import { getCampaignDraft, getCampaignCreationReceipt, createMarketingContentErrorResponse } from '@/features/marketing-content/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
export const dynamic = 'force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{campaignId:string}>}) {
 try {
  const account=await getCurrentAccountToolAccess(), {campaignId}=await params;
  // Literal route reserved for read-only lost-create identity lookup; no create RPC is called.
  const result=campaignId==='creation-receipt'?await getCampaignCreationReceipt(account.user.id,{idempotencyKey:new URL(request.url).searchParams.get('idempotencyKey')}):await getCampaignDraft(account.user.id,{campaignId});
  return createNoStoreJsonResponse(result);
 }catch(error){return createMarketingContentErrorResponse(error,'Unable to read the exact Campaign package or creation receipt.');}
}
