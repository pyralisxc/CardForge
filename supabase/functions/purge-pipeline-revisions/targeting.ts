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
