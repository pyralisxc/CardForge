import {createApiErrorResponse,createNoStoreJsonResponse} from '@/infrastructure/http/apiResponses';
import {getCurrentOwnerAccess,recordOwnerActivity} from '@/features/owner/server';
import {deleteOneTrashedPipelineRevision,RevisionDeleteError} from '@/features/pipeline/server/ownerRevisionDeletion';
import {revalidateCardForgeCatalog} from '@/features/pipeline/server/catalogCache';
export async function POST(request:Request,{params}:{params:Promise<{submissionId:string}>}){
 const owner=await getCurrentOwnerAccess();
 if(!owner.isOwner||!owner.userId)return createApiErrorResponse(403,'owner_access_required','Owner access required');
 try{
  const id=(await params).submissionId;
  const body=await request.json() as {confirmationName?:unknown;storagePath?:unknown};
  if(typeof body.confirmationName!=='string'||!(typeof body.storagePath==='string'||body.storagePath===null))
   return createApiErrorResponse(400,'pipeline_request_invalid','Exact name and path required');
  await deleteOneTrashedPipelineRevision({submissionId:id,name:body.confirmationName,storagePath:body.storagePath});
  revalidateCardForgeCatalog();
  await recordOwnerActivity({actorUserId:owner.userId,actorEmail:owner.email,
   action:'library.asset.delete',targetType:'contributor_asset_revision',targetId:id,
   summary:'Owner-confirmed permanent deletion of one trashed Pipeline revision.'});
  return createNoStoreJsonResponse({deleted:true,submissionId:id});
 }catch(error){
  return createApiErrorResponse(error instanceof SyntaxError?400:error instanceof RevisionDeleteError?error.status:503,'pipeline_request_invalid',
   error instanceof Error?error.message:'Selected revision could not be deleted');
 }
}
