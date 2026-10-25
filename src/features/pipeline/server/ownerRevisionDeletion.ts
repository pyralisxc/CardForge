import {getSupabaseServerClient} from '@/infrastructure/database/supabaseServer';
import {processRevisionPurge} from '../../../../supabase/functions/purge-pipeline-revisions/processor';
export async function deleteOneTrashedPipelineRevision(args:{
 submissionId:string;name:string;storagePath:string
}):Promise<void>{
 const db=getSupabaseServerClient();
 if(!db)throw new Error('Pipeline database unavailable');
 const {data,error}=await db.rpc('cardforge_claim_pipeline_revision_purge_owner',{
  p_submission_id:args.submissionId,p_expected_name:args.name,p_expected_storage_path:args.storagePath
 });
 if(error)throw new Error('Selected revision is no longer eligible');
 const claims=data as {submission_id:string;storage_bucket:string|null;storage_path:string|null}[]|null;
 if(claims?.length!==1||claims[0].submission_id!==args.submissionId||claims[0].storage_path!==args.storagePath)
  throw new Error('Exact revision claim was not confirmed');
 const result=await processRevisionPurge(db,claims[0]);
 if(!result.purged)throw new Error('Revision deletion incomplete; retry after verifying the native claim');
 const {data:remaining,error:readError}=await db.from('cardforge_contributor_asset_submissions')
  .select('id').eq('id',args.submissionId).limit(1);
 if(readError||remaining?.length)throw new Error('Deletion could not be independently confirmed');
}
