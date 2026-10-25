// One revision deletion processor for scheduled expiry and confirmed Owner intent.
// Claims are produced by guarded database RPCs; only this function removes bytes.
export type RevisionPurgeClaim = { submission_id:string;storage_bucket:string|null;storage_path:string|null;claim_token:string };
export type RevisionPurgeClient = {
  storage:{from:(bucket:string)=>{remove:(paths:string[])=>Promise<{error:unknown}>}};
  rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
};
export async function processRevisionPurge(
  client:RevisionPurgeClient,claim:RevisionPurgeClaim,
):Promise<{purged:boolean;failed:boolean}>{
  try {
    if(claim.storage_bucket && claim.storage_path){
      const {error}=await client.storage.from(claim.storage_bucket).remove([claim.storage_path]);
      if(error)throw error;
    }
    const {data,error}=await client.rpc('cardforge_finalize_pipeline_revision_purge',{p_submission_id:claim.submission_id,p_claim_token:claim.claim_token});
    if(error)throw error;
    if(data!==true)throw new Error('revision_finalization_unconfirmed');
    return {purged:true,failed:false};
  }catch(error){
    console.error('Pipeline revision purge incomplete', {submissionId:claim.submission_id,error});
    await client.rpc('cardforge_release_pipeline_revision_purge',{p_submission_id:claim.submission_id});
    return {purged:false,failed:true};
  }
}
