export type PipelineRetentionSelection =
  | {mode:"batch"}
  | {mode:"targeted";submissionId:string};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const parsePipelineRetentionRequest=(body:string):PipelineRetentionSelection=>{
  if (!body.trim()) return {mode:"batch"};
  let data:unknown;
  try {data=JSON.parse(body);} catch {throw new Error("invalid_retention_target");}
  if (!data || typeof data!=="object" || Array.isArray(data)) throw new Error("invalid_retention_target");
  const row=data as Record<string,unknown>;
  if (!Object.keys(row).length) return {mode:"batch"};
  if (Object.keys(row).length!==2 || row.mode!=="targeted" ||
    typeof row.submissionId!=="string" || !UUID.test(row.submissionId))
    throw new Error("invalid_retention_target");
  return {mode:"targeted",submissionId:row.submissionId.toLowerCase()};
};

export type TargetPurgeClaim = { submission_id:string;storage_bucket:string|null;storage_path:string|null;claim_token:string };
export const routePipelineRetentionClaims=async (
  selection: PipelineRetentionSelection,
  rpc:(name:string,args:Record<string,unknown>)=>Promise<{data:unknown;error:unknown}>,
):Promise<{expired:number;claims:TargetPurgeClaim[];error?:'expiry_failed'|'purge_claim_failed'|'target_not_eligible'}>=>{
  let expired=0;
  if(selection.mode==="batch"){
    const result=await rpc("cardforge_expire_inactive_pipeline_reviews",{p_limit:100});
    if(result.error)return {expired:0,claims:[],error:"expiry_failed"};
    expired=Number(result.data??0);
  }
  const result=selection.mode==="targeted"
    ?await rpc("cardforge_claim_pipeline_revision_purge_target",{p_submission_id:selection.submissionId})
    :await rpc("cardforge_claim_pipeline_revision_purges",{p_limit:50});
  if(result.error)return {expired,claims:[],error:"purge_claim_failed"};
  const claims=(result.data??[]) as TargetPurgeClaim[];
  if(selection.mode==="targeted"&&(claims.length!==1||claims[0].submission_id!==selection.submissionId))
    return {expired,claims:[],error:"target_not_eligible"};
  return {expired,claims};
};
