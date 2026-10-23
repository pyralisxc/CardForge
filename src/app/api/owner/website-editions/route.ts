import { getCurrentOwnerAccess } from '@/features/owner/server';
import { createWebsiteEdition, listWebsiteEditions, archiveWebsiteEdition, initializeWebsiteEditions, WebsiteEditionStoreError } from '@/features/public-site/server/websiteEditionStore';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { parseJsonBodyWithLimit } from '@/infrastructure/http/apiValidation';
export const dynamic = 'force-dynamic';
const guard = async () => {
 const owner = await getCurrentOwnerAccess();
 return Boolean(owner.isOwner && owner.userId);
};
const fail = (e: unknown) => e instanceof WebsiteEditionStoreError
 ? createApiErrorResponse(e.status, 'website_edition_error', e.message)
 : createApiErrorResponse(503, 'website_edition_unavailable', 'Unable to manage website editions.');
export async function GET() {
 if (!await guard()) return createApiErrorResponse(403, 'owner_access_required', 'Owner access required.');
 try { return createNoStoreJsonResponse({ editions: await listWebsiteEditions() }); } catch(e) { return fail(e); }
}
export async function POST(request: Request) {
 if (!await guard()) return createApiErrorResponse(403, 'owner_access_required', 'Owner access required.');
 try {
   const parsed=await parseJsonBodyWithLimit(request);
   if(!parsed.ok) return createApiErrorResponse(parsed.code==='payload_too_large'?413:400,parsed.code,parsed.message);
   const body=parsed.data;
   if(!body || typeof body!=='object' || Array.isArray(body) || typeof (body as Record<string,unknown>).name!=='string')
     return createApiErrorResponse(400,'website_edition_invalid','Choose an edition name.');
   return createNoStoreJsonResponse({ editionId: await createWebsiteEdition((body as {name:string}).name) });
 } catch(e) { return fail(e); }
}
export async function DELETE(request: Request) {
 if(!await guard()) return createApiErrorResponse(403,'owner_access_required','Owner access required.');
 try {
   const parsed=await parseJsonBodyWithLimit(request);
   if(!parsed.ok) return createApiErrorResponse(parsed.code==='payload_too_large'?413:400,parsed.code,parsed.message);
   const body=parsed.data as Record<string,unknown>;
   if(!body || typeof body.editionId!=='string')
     return createApiErrorResponse(400,'website_edition_invalid','Choose an edition.');
   await archiveWebsiteEdition(body.editionId);
   return createNoStoreJsonResponse({ archived: true });
 } catch(e) { return fail(e); }
}

export async function PUT(request: Request) {
 const owner=await getCurrentOwnerAccess();
 if(!owner.isOwner || !owner.userId) return createApiErrorResponse(403,'owner_access_required','Owner access required.');
 try {
   const parsed=await parseJsonBodyWithLimit(request);
   if(!parsed.ok) return createApiErrorResponse(parsed.code==='payload_too_large'?413:400,parsed.code,parsed.message);
   const body=parsed.data as Record<string,unknown>;
   if(!body || typeof body.operationId!=='string')
     return createApiErrorResponse(400,'website_edition_invalid','An operation identity is required.');
   return createNoStoreJsonResponse({ revisionId: await initializeWebsiteEditions(owner.userId, body.operationId) });
 } catch(e) { return fail(e); }
}
