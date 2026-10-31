import { expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
const state=vi.hoisted(()=>({rows:[] as Record<string,unknown>[]}));
vi.mock('@/infrastructure/database/supabaseServer',()=>({getSupabaseServerConfigStatus:()=>({configured:true}),getSupabaseServerClient:()=>({from:(table:string)=>{const q={select:()=>q,neq:()=>q,eq:()=>q,order:()=>q,in:()=>q,then:(resolve:(r:unknown)=>unknown)=>Promise.resolve(resolve({data:table==='cardforge_roadmap_votes'?[{item_id:'legacy',user_id:'viewer',vote:'up'}]:state.rows,count:0,error:null}))};return q;}})}));
vi.mock('@/features/billing/server',()=>({getCurrentCreatorPassRevenue:async()=>({available:true,activeSubscriberCount:0,grossMonthlyRevenueCents:0})}));
vi.mock('@/features/roadmap/server/roadmapSettingsStore',async()=>({getRoadmapSettings:async()=>(await import('@/features/roadmap/model/roadmap')).DEFAULT_ROADMAP_SETTINGS}));
import { getRoadmapForUser } from '@/features/roadmap/server/roadmapStore';
it('does not advertise numbered working batches as public shipped progress and keeps legacy votes',async()=>{
 const row={title:'Legacy progress',description:null,item_type:'shipped_update',source:'official',visible_month:'2026-10',created_at:'2026-10-01T00:00:00Z',sort_order:1};
 state.rows=[{...row,id:'working',title:'Website 0.0.1',status:'in_progress',shipped_at:null,release_version:'0.0.1'},
 {...row,id:'legacy',status:'shipped',shipped_at:'2026-10-02T00:00:00Z',release_version:null},
 {...row,id:'released',title:'Website 0.0.0',status:'shipped',shipped_at:'2026-10-03T00:00:00Z',release_version:'0.0.0'}];
 const result=await getRoadmapForUser('viewer');
 expect(result.items.map(r=>r.id)).toEqual(['legacy','released']);
 expect(result.items.find(r=>r.id==='legacy')).toMatchObject({upVotes:1,userVote:'up'});
});
