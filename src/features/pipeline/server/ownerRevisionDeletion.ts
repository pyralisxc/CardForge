export class RevisionDeleteError extends Error {constructor(public readonly status:409|503,message:string){super(message);}}
import {getSupabaseServerClient} from '@/infrastructure/database/supabaseServer';
import {processRevisionPurge} from '../../../../supabase/functions/purge-pipeline-revisions/processor';
export async function deleteOneTrashedPipelineRevision(args:{
 submissionId:string;name:string;storagePath:string|null
}):Promise<void>{
 const db=getSupabaseServerClient();
 if(!db)throw new RevisionDeleteError(503,'Pipeline database unavailable');
 const {data,error}=await db.rpc('cardforge_claim_pipeline_revision_purge_owner',{
  p_submission_id:args.submissionId,p_expected_name:args.name,p_expected_storage_path:args.storagePath
 });
 if(error)throw new RevisionDeleteError(503,'Owner claim could not be completed');
 const claims=data as {submission_id:string;storage_bucket:string|null;storage_path:string|null;claim_token:string}[]|null;
 if(claims?.length!==1||claims[0].submission_id!==args.submissionId||claims[0].storage_path!==args.storagePath)
  throw new RevisionDeleteError(409,'Exact revision claim was not confirmed');
 const result=await processRevisionPurge(db,claims[0]);
 if(!result.purged)throw new RevisionDeleteError(503,'Revision deletion incomplete; reconcile its Storage and claim state');
 const {data:remaining,error:readError}=await db.from('cardforge_contributor_asset_submissions')
  .select('id').eq('id',args.submissionId).limit(1);
 if(readError||remaining?.length)throw new RevisionDeleteError(503,'Deletion readback is unavailable or incomplete');
}
