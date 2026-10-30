import { z } from 'zod/v4';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { websiteReleaseNotesSchema, websiteReleaseVersionSchema, websiteReleaseSourceSchema, type WebsiteReleaseRecord } from '../model/websiteRelease';
import { RoadmapStoreError } from './RoadmapStoreError';

const releaseRow = z.object({id:z.string().uuid(),release_version:websiteReleaseVersionSchema,release_notes:websiteReleaseNotesSchema,release_source_sha:websiteReleaseSourceSchema.nullable(),release_candidate_sha:websiteReleaseSourceSchema.nullable(),shipped_at:z.string().nullable(),updated_at:z.string(),release_operation_kind:z.enum(['working-saved','release-published','narrative-corrected','working-advanced']).nullable().optional(),release_operation_id:z.string().uuid().nullable().optional(),release_operation_payload:z.record(z.string(),z.unknown()).nullable().optional()});
const mapRow=(raw:unknown):WebsiteReleaseRecord=>{const r=releaseRow.parse(raw);return {id:r.id,version:r.release_version,notes:r.release_notes,sourceSha:r.release_source_sha,candidateSha:r.release_candidate_sha,shippedAt:r.shipped_at,updatedAt:r.updated_at,mutationKind:r.release_operation_kind??null,operationId:r.release_operation_id??null,advanceFrom:typeof r.release_operation_payload?.advanceFrom==='string'?r.release_operation_payload.advanceFrom:null};};
export async function getWebsiteReleaseRecords():Promise<WebsiteReleaseRecord[]> {
 const db=getSupabaseServerClient();
 if(!db) throw new RoadmapStoreError('Website updates are temporarily unavailable.',503);
 const {data,error}=await db.from('cardforge_roadmap_items').select('id,release_version,release_notes,release_source_sha,release_candidate_sha,shipped_at,updated_at,release_operation_id,release_operation_payload,release_operation_kind').not('release_version','is',null).eq('source','official').eq('item_type','shipped_update');
 if(error) throw new RoadmapStoreError('Website updates are temporarily unavailable.',503);
 return (data??[]).map(mapRow);
}
export const websiteReleaseCommandSchema=z.object({version:websiteReleaseVersionSchema,notes:websiteReleaseNotesSchema,sourceSha:websiteReleaseSourceSchema.nullable(),candidateSha:websiteReleaseSourceSchema.nullable(),expectedUpdatedAt:z.string().datetime({offset:true}).nullable(),operationId:z.string().uuid(),publish:z.boolean(),advanceFrom:websiteReleaseVersionSchema.optional()}).strict();
export async function saveWebsiteRelease(raw:unknown, actorId:string):Promise<WebsiteReleaseRecord> {
 const parsed=websiteReleaseCommandSchema.safeParse(raw);
 if(!parsed.success) throw new RoadmapStoreError('Provide valid version, typed notes and the exact saved revision/attempt.',400);
 const input=parsed.data;
 if(input.advanceFrom) return advanceWebsiteRelease(input,actorId);
 const prior=(await getWebsiteReleaseRecords()).find(row=>row.version===input.version);
 const narrativeCorrection=Boolean(prior?.shippedAt && prior.sourceSha===input.sourceSha && prior.candidateSha===input.candidateSha);
 if(!input.publish && input.sourceSha!==null) throw new RoadmapStoreError('Working notes do not have a released deployment SHA.',400);
 if(input.publish && !narrativeCorrection && (process.env.VERCEL_ENV!=='production' || !process.env.VERCEL_GIT_COMMIT_SHA || input.sourceSha!==process.env.VERCEL_GIT_COMMIT_SHA || !input.candidateSha)) {
  throw new RoadmapStoreError('A released entry requires the verified current Production deployment SHA and approved candidate snapshot. Preview working notes remain unreleased.',409);
 }
 if(input.publish&&!narrativeCorrection&&(!prior||JSON.stringify(prior.notes)!==JSON.stringify(input.notes)||prior.candidateSha!==input.candidateSha))throw new RoadmapStoreError('Save and review the exact approved notes/candidate packet before recording a release.',409);
 const db=getSupabaseServerClient(); if(!db) throw new RoadmapStoreError('Website updates are temporarily unavailable.',503);
 const {data,error}=await db.rpc('cardforge_save_website_release',{p_version:input.version,p_notes:input.notes,p_source_sha:input.sourceSha,p_candidate_sha:input.candidateSha,p_expected_updated_at:input.expectedUpdatedAt,p_operation_id:input.operationId,p_publish:input.publish,p_actor_id:actorId});
 if(error)translateReleaseWriteError(error);
 return mapRow(Array.isArray(data)?data[0]:data);
}

const releasedRecordSchema=z.object({version:websiteReleaseVersionSchema,notes:websiteReleaseNotesSchema,sourceSha:websiteReleaseSourceSchema,candidateSha:websiteReleaseSourceSchema,shippedAt:z.string().datetime({offset:true})});
async function advanceWebsiteRelease(input:z.infer<typeof websiteReleaseCommandSchema>,actorId:string):Promise<WebsiteReleaseRecord>{
 if(process.env.VERCEL_ENV==='production'||input.publish||input.sourceSha!==null||input.candidateSha!==null) throw new RoadmapStoreError('Advancing working versions is a Preview operation after a verified Production release.',409);
 const receipt=(await getWebsiteReleaseRecords()).find(row=>row.version===input.version&&row.operationId===input.operationId);
 if(receipt){if(receipt.advanceFrom!==input.advanceFrom||JSON.stringify(receipt.notes)!==JSON.stringify(input.notes))throw new RoadmapStoreError('The saved attempt belongs to another exact snapshot.',409);return receipt;}
 const host=process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()||'cardforges.com';
 if(!/^(?:[a-z0-9-]+\.)*(?:vercel\.app|cardforges\.com)$/i.test(host)) throw new RoadmapStoreError('The canonical Production release reader is unavailable.',503);
 let published:z.infer<typeof releasedRecordSchema>;
 try {
  const response=await fetch(`https://${host}/api/website-updates`,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw new Error('Unavailable');
  const records=z.object({releases:z.array(releasedRecordSchema)}).parse(await response.json()).releases;
  const exact=records.find(row=>row.version===input.advanceFrom);if(!exact) throw new RoadmapStoreError('The exact preceding version has no verified Production release. Working notes were preserved.',409);
  published=exact;
 }catch(error){if(error instanceof RoadmapStoreError)throw error;throw new RoadmapStoreError('Production release verification is unavailable. No working version was advanced.',503);}
 const db=getSupabaseServerClient();if(!db)throw new RoadmapStoreError('Website updates are temporarily unavailable.',503);
 const {data,error}=await db.rpc('cardforge_advance_website_release',{p_previous_version:input.advanceFrom,p_expected_updated_at:input.expectedUpdatedAt,p_published:published,p_next_version:input.version,p_next_notes:input.notes,p_operation_id:input.operationId,p_actor_id:actorId});
 if(error)translateReleaseWriteError(error);
 return mapRow(Array.isArray(data)?data[0]:data);
}

function translateReleaseWriteError(error:{code?:string;message?:string}):never{
 const conflicts=new Set(['website_release_conflict','website_release_attempt_conflict','website_release_approved_snapshot_conflict','website_release_published_immutable','website_release_advance_requires_verified_release','website_release_approved_snapshot_missing']);
 if(error.code==='P0001'&&conflicts.has(error.message??'')||error.code==='23505')throw new RoadmapStoreError('The exact release snapshot changed or published facts are immutable. Read current records before editing.',409);
 if(error.code==='P0001'&&error.message==='website_release_invalid'||error.code==='23514')throw new RoadmapStoreError('The release values were rejected. Correct the saved draft before another attempt.',400);
 throw new RoadmapStoreError('The write outcome is unavailable. Retain the exact attempt and read saved records before any new action.',503);
}
