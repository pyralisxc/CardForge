import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { WEBSITE_DRAFT_MEDIA_BUCKET } from '@/features/public-site/server/websiteEditionStore';
import { getCurrentOwnerAccess } from '@/features/owner/server';
import { stageOwnerWebsiteEditionMedia } from '@/features/owner/server/ownerMediaCommands';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { SiteMediaStoreError } from '@/features/public-site/server';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
 const owner=await getCurrentOwnerAccess();
 if(!owner.isOwner||!owner.userId) return createApiErrorResponse(403,'owner_access_required','Owner access required.');
 try {
   const form=await request.formData();
   const image=form.get('image');
   const presentation=JSON.parse(String(form.get('presentation')??'{}')) as unknown;
   const db=getSupabaseServerClient();
   const bucket=await db?.storage.getBucket(WEBSITE_DRAFT_MEDIA_BUCKET);
   if(!bucket || bucket.error || bucket.data?.public !== false)
     return createApiErrorResponse(503,'site_media_unavailable','Protected website draft media storage is not ready.');
   const candidate=await stageOwnerWebsiteEditionMedia({
     actor:{userId:owner.userId,email:owner.email},
     slot:String(form.get('slot')??''),
     image:image instanceof File && image.size>0?image:null,
     currentStoragePath: form.get('storagePath')===null || form.get('storagePath')==='null'
       ?null:String(form.get('storagePath')),
     alt:String(form.get('alt')??''),presentation,
   });
   return createNoStoreJsonResponse(candidate);
 } catch(error) {
   if(error instanceof SiteMediaStoreError) return createApiErrorResponse(error.status,
     error.status===409?'site_media_invalid':error.status>=500?'site_media_unavailable':'site_media_invalid',error.message);
   if(error instanceof SyntaxError) return createApiErrorResponse(400,'site_media_invalid','Invalid image presentation.');
   return createApiErrorResponse(503,'site_media_unavailable','Unable to stage this image.');
 }
}

export async function GET() {
 const owner=await getCurrentOwnerAccess();
 if(!owner.isOwner||!owner.userId) return createApiErrorResponse(403,'owner_access_required','Owner access required.');
 const db=getSupabaseServerClient();
 if(!db) return createNoStoreJsonResponse({ready:false});
 const {data,error}=await db.storage.getBucket(WEBSITE_DRAFT_MEDIA_BUCKET);
 // Never allow staging into a missing or accidentally public bucket.
 return createNoStoreJsonResponse({ready: !error && data?.public === false});
}
