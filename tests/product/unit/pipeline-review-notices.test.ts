import { beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ account: vi.fn(), capabilities: vi.fn(), page: vi.fn(), database: vi.fn(), settings: vi.fn(), identities: vi.fn() }));
vi.mock('@/features/account/server', () => ({ getCurrentAccountToolAccess: f.account, AccountToolAccessError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));
vi.mock('@/features/contributor-access/server', () => ({ readContributorCapabilities: f.capabilities, hasContributionScope: (scopes: string[], scope: string) => scopes.includes(scope) }));
vi.mock('@/features/pipeline/lib/pipelineProjections', () => ({ fetchPipelineSubmissionPage: f.page }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: f.database }));
vi.mock('@/features/pipeline/server', async () => ({ PipelineStoreError: (await import('@/features/pipeline/lib/pipelineStoreError')).PipelineStoreError }));
import { GET } from '@/app/api/pipeline/review-notices/route';
const id='10000000-0000-4000-8000-000000000001', lineage='20000000-0000-4000-8000-000000000001';
const row={ id,lineageId:lineage,contributorId:'author', name:'Reviewed item',revisionNumber:2,submittedAt:'2026-11-26T12:00:00Z', status:'voting',purgeState:null,editorialReviewNote:'PRIVATE REASON',sourcePayload:{private:true} };
beforeEach(()=>{
 vi.resetAllMocks(); f.account.mockResolvedValue({user:{id:'reviewer'},isOwner:false,entitlement:{}}); f.capabilities.mockResolvedValue({active:true,scopes:['assets.review']});
 f.settings.mockResolvedValue({data:{review_notices_started_at:'2026-11-26T11:00:00Z',allow_contributor_self_voting:true},error:null});
 f.identities.mockResolvedValue({data:[{id,contributor_id:'author',template_review_context:null,media_presentation:null}],error:null});
 f.database.mockReturnValue({from:(table:string)=>table==='cardforge_contributor_program_settings'?{select:()=>({eq:()=>({single:f.settings})})}:{select:()=>({in:()=>({gte:f.identities})})}});
 f.page.mockResolvedValue({submissions:[row],total:1});
});
it('returns exact eligible metadata without private content or enrollment',async()=>{
 const response=await GET(); expect(response.status).toBe(200);
 expect(await response.json()).toEqual({items:[{submissionId:id,lineageId:lineage,name:'Reviewed item',revisionNumber:2,submittedAt:row.submittedAt}]});
 expect(f.page).toHaveBeenCalledWith(expect.objectContaining({currentUserId:'reviewer',allowSelfVoting:true,query:{scope:'review',trash:'all',page:1,pageSize:50}}));
});
it('does not backfill pre-rollout work or private drafts',async()=>{
 f.page.mockResolvedValue({submissions:[{...row,submittedAt:'2026-11-26T10:00:00Z'}, {...row,status:'draft'}],total:2});
 expect(await (await GET()).json()).toEqual({items:[]});expect(f.identities).not.toHaveBeenCalled();
});
it('excludes the known submitter, not the credited author, and permits unknown media actors',async()=>{
 f.identities.mockResolvedValueOnce({data:[{id,contributor_id:'author',template_review_context:{actorId:'reviewer'},media_presentation:null}],error:null});
 expect(await (await GET()).json()).toEqual({items:[]});
 f.identities.mockResolvedValueOnce({data:[{id,contributor_id:'reviewer',template_review_context:{actorId:'owner'},media_presentation:null}],error:null});
 expect((await (await GET()).json()).items).toHaveLength(1);
 f.identities.mockResolvedValueOnce({data:[{id,contributor_id:'reviewer',template_review_context:null,media_presentation:{}}],error:null});
 expect((await (await GET()).json()).items).toHaveLength(1);
});
it('denies revoked review access before reading the list',async()=>{
 f.capabilities.mockResolvedValue({active:false,scopes:[]}); expect((await GET()).status).toBe(403);expect(f.page).not.toHaveBeenCalled();
});
it('does not represent unavailable rollout configuration or review list as empty',async()=>{
 f.settings.mockResolvedValueOnce({data:null,error:{}});expect((await GET()).status).toBe(503);expect(f.page).not.toHaveBeenCalled();
 f.page.mockRejectedValueOnce(new Error('provider unavailable'));expect((await GET()).status).toBe(503);
 f.database.mockReturnValue(null);expect((await GET()).status).toBe(503);
});
