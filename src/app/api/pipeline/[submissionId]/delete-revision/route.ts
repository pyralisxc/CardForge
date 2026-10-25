import {createApiErrorResponse,createNoStoreJsonResponse} from '@/infrastructure/http/apiResponses';
import {getCurrentOwnerAccess,recordOwnerActivity} from '@/features/owner/server';
import {deleteOneTrashedPipelineRevision} from '@/features/pipeline/server/ownerRevisionDeletion';
import {revalidateCardForgeCatalog} from '@/features/pipeline/server/catalogCache';
export async function POST(request:Request,{params}:{params:Promise<{submissionId:string}>}){
 const owner=await getCurrentOwnerAccess();
 if(!owner.isOwner||!owner.userId)return createApiErrorResponse(403,'owner_access_required','Owner access required');
 try{
  const id=(await params).submissionId;
  const body=await request.json() as {confirmationName?:unknown;storagePath?:unknown};
  if(typeof body.confirmationName!=='string'||typeof body.storagePath!=='string')
   return createApiErrorResponse(400,'invalid_confirmation','Exact name and path required');
  await deleteOneTrashedPipelineRevision({submissionId:id,name:body.confirmationName,storagePath:body.storagePath});
  revalidateCardForgeCatalog();
  await recordOwnerActivity({actorUserId:owner.userId,actorEmail:owner.email,
   action:'library.asset.delete',targetType:'contributor_asset_revision',targetId:id,
   summary:'Owner-confirmed permanent deletion of one trashed Pipeline revision.'});
  return createNoStoreJsonResponse({deleted:true,submissionId:id});
 }catch(error){
  return createApiErrorResponse(409,'revision_delete_unconfirmed',
   error instanceof Error?error.message:'Selected revision could not be deleted');
 }
}
