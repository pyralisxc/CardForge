import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
const db=vi.hoisted(()=>({rows:[] as unknown[],rpc:vi.fn()}));
vi.mock('@/infrastructure/database/supabaseServer',()=>({getSupabaseServerClient:()=>({from:()=>({select:()=>({not:()=>({eq:()=>({eq:async()=>({data:db.rows,error:null})})})})}),rpc:db.rpc})}));
import { saveWebsiteRelease } from '@/features/roadmap/server/websiteReleaseStore';
const save=(raw:unknown)=>saveWebsiteRelease(raw,'synthetic-owner');
const input={version:'0.0.1',notes:{improvements:['Precise notes'],fixes:[],knownLimits:[]},sourceSha:null as string|null,candidateSha:null as string|null,expectedUpdatedAt:null as string|null,operationId:'10000000-0000-4000-8000-000000000001',publish:false};
const record={id:'20000000-0000-4000-8000-000000000001',release_version:'0.0.1',release_notes:input.notes,release_source_sha:null as string|null,release_candidate_sha:null as string|null,shipped_at:null as string|null,updated_at:'2026-10-30T00:00:00Z'};
beforeEach(()=>{db.rows=[];db.rpc.mockReset().mockResolvedValue({data:record,error:null});vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('VERCEL_GIT_COMMIT_SHA','a'.repeat(40));});
afterEach(()=>vi.unstubAllEnvs());
it('saves a working snapshot through the native command without publication',async()=>{expect(await save(input)).toMatchObject({version:'0.0.1',shippedAt:null});expect(db.rpc).toHaveBeenCalledWith('cardforge_save_website_release',expect.objectContaining({p_publish:false,p_operation_id:input.operationId,p_notes:input.notes,p_expected_updated_at:null}));});
it('rejects Preview release publication before any native mutation',async()=>{await expect(save({...input,publish:true,sourceSha:'a'.repeat(40),candidateSha:'b'.repeat(40)})).rejects.toMatchObject({status:409});expect(db.rpc).not.toHaveBeenCalled();});
it('requires the current Production SHA for first publication',async()=>{vi.stubEnv('VERCEL_ENV','production');await expect(save({...input,publish:true,sourceSha:'c'.repeat(40),candidateSha:'b'.repeat(40)})).rejects.toMatchObject({status:409});expect(db.rpc).not.toHaveBeenCalled();db.rows=[{...record,release_candidate_sha:'b'.repeat(40)}];await save({...input,publish:true,sourceSha:'a'.repeat(40),candidateSha:'b'.repeat(40)});expect(db.rpc).toHaveBeenCalledTimes(1);});
it('allows an exact historical narrative correction while preserving factual pins',async()=>{db.rows=[{...record,release_source_sha:'c'.repeat(40),release_candidate_sha:'b'.repeat(40),shipped_at:'2026-10-20T00:00:00Z'}];await save({...input,publish:true,sourceSha:'c'.repeat(40),candidateSha:'b'.repeat(40),expectedUpdatedAt:record.updated_at});expect(db.rpc).toHaveBeenCalledTimes(1);});
it('keeps invalid or rebound working data out of native writes',async()=>{await expect(save({...input,sourceSha:'a'.repeat(40)})).rejects.toMatchObject({status:400});await expect(save({...input,version:'v0.0.1'})).rejects.toMatchObject({status:400});expect(db.rpc).not.toHaveBeenCalled();});

it('preserves unknown post-RPC outcomes as unavailable, while confirmed native conflicts remain actionable',async()=>{
 db.rpc.mockResolvedValueOnce({data:null,error:{code:'PGRST000',message:'network lost'}});
 await expect(save(input)).rejects.toMatchObject({status:503});
 db.rpc.mockResolvedValueOnce({data:null,error:{code:'P0001',message:'website_release_conflict'}});
 await expect(save(input)).rejects.toMatchObject({status:409});
});
it('requires the saved approved packet before first publication',async()=>{
 vi.stubEnv('VERCEL_ENV','production');
 await expect(save({...input,publish:true,sourceSha:'a'.repeat(40),candidateSha:'b'.repeat(40)})).rejects.toMatchObject({status:409});
 db.rows=[{...record,release_candidate_sha:'b'.repeat(40)}];
 await expect(save({...input,notes:{...input.notes,fixes:['Unapproved replacement']},publish:true,sourceSha:'a'.repeat(40),candidateSha:'b'.repeat(40)})).rejects.toMatchObject({status:409});
 expect(db.rpc).not.toHaveBeenCalled();
});
it('advances only using the exact canonical Production release readback',async()=>{
 vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL','card-forge.vercel.app');
 const published={version:'0.0.1',notes:input.notes,sourceSha:'a'.repeat(40),candidateSha:'b'.repeat(40),shippedAt:'2026-10-30T00:00:00Z'};
 const fetch=vi.fn().mockResolvedValue(Response.json({releases:[published]}));vi.stubGlobal('fetch',fetch);
 db.rpc.mockResolvedValue({data:{...record,release_version:'0.0.2',release_operation_kind:'working-advanced'},error:null});
 await save({...input,version:'0.0.2',advanceFrom:'0.0.1',expectedUpdatedAt:record.updated_at});
 expect(fetch).toHaveBeenCalledWith('https://card-forge.vercel.app/api/website-updates',expect.objectContaining({redirect:'error',cache:'no-store'}));
 expect(db.rpc).toHaveBeenCalledWith('cardforge_advance_website_release',expect.objectContaining({p_published:published,p_previous_version:'0.0.1',p_next_version:'0.0.2'}));vi.unstubAllGlobals();
});
it('fails closed when Production has no exact preceding release',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({releases:[]})));
 await expect(save({...input,version:'0.0.2',advanceFrom:'0.0.1'})).rejects.toMatchObject({status:409});expect(db.rpc).not.toHaveBeenCalled();vi.unstubAllGlobals();
});
