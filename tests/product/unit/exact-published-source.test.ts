import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
const state=vi.hoisted(()=>({rows:{} as Record<string,Record<string,unknown>|null>,error:false,reads:0,after:null as null|(()=>void),download:vi.fn()}));
vi.mock('@/infrastructure/database/supabaseServer',()=>({getSupabaseServerClient:()=>({from:(table:string)=>{const query={select:()=>query,eq:()=>query,maybeSingle:async()=>{state.reads++;if(state.reads===4)state.after?.();return {data:state.rows[table],error:state.error?{}:null};}};return query;},storage:{from:()=>({download:state.download})}})}));
import { readExactPublishedSource } from '@/features/pipeline/server/exactPublishedSource';
const target={assetId:'asset',submissionId:'submission',lineageId:'lineage',selection:'current' as 'current'|'historical'};
const access={user:{id:'viewer'},isOwner:false,entitlement:{accessMode:'free'}} as never;
const names={s:'cardforge_contributor_asset_submissions',r:'cardforge_asset_registry',l:'cardforge_pipeline_asset_lineages'};
const style={id:'style',name:'Exact',kind:'material',targets:['shape'],appearance:{material:{baseColor:'#cc0000'}}};
describe('exact Pipeline source visibility and identity',()=>{
 beforeEach(()=>{state.error=false;state.reads=0;state.after=null;state.rows={
 [names.s]:{id:'submission',lineage_id:'lineage',contributor_id:'author',asset_type:'elementPresets',name:'Exact',status:'published',published_at:'then',revision_number:1,registry_asset_id:'asset',source_payload:style,updated_at:'s1'},
 [names.r]:{asset_id:'asset',contributor_submission_id:'submission',status:'published',access_tier:'free',metadata:{style:{...style,name:'Wrong latest'}},updated_at:'r1'},
 [names.l]:{id:'lineage',registry_asset_id:'asset'},
 };state.download.mockReset();});
 it('uses selected submission payload and publication epoch for an accessible current revision',async()=>{const read=await readExactPublishedSource(access,target);expect(read.content).toEqual(style);expect(read.identity.publicationUpdatedAt).toBe('r1');expect(state.download).not.toHaveBeenCalled();});
 it('keeps exact historical source independent from newer catalog content',async()=>{state.rows[names.r]!.contributor_submission_id='newer';const read=await readExactPublishedSource({...access as object,isOwner:true} as never,{...target,selection:'historical'});expect(read.content).toEqual(style);expect(read.identity.publicationUpdatedAt).toBeNull();});
 it('does not give unrelated viewers access to historical private source',async()=>{state.rows[names.r]!.contributor_submission_id='newer';await expect(readExactPublishedSource(access,{...target,selection:'historical'})).rejects.toMatchObject({status:403});});
 it('allows original contributor exact history while preserving selection',async()=>{state.rows[names.r]!.contributor_submission_id='newer';state.rows[names.s]!.contributor_id='viewer';expect((await readExactPublishedSource(access,{...target,selection:'historical'})).content).toEqual(style);});
 it('refuses stale current selection rather than substituting latest',async()=>{state.rows[names.r]!.contributor_submission_id='newer';await expect(readExactPublishedSource({...access as object,isOwner:true} as never,target)).rejects.toMatchObject({status:409});});
 it('does not use current registry payload for missing history',async()=>{state.rows[names.s]!.source_payload=null;await expect(readExactPublishedSource({...access as object,isOwner:true} as never,{...target,selection:'historical'})).rejects.toMatchObject({status:400});});
 it('permits authoritative current legacy metadata without inventing history',async()=>{state.rows[names.s]!.source_payload=null;expect((await readExactPublishedSource(access,target)).content).toMatchObject({name:'Wrong latest'});});
 it.each(['catalog_trashed_at','catalog_claimed_at','purge_state'])('rejects retained lineage %s',async key=>{state.rows[names.l]![key]='pending';await expect(readExactPublishedSource(access,target)).rejects.toMatchObject({status:409});});
 it('rejects a changed registry epoch during hydration',async()=>{state.after=()=>{state.rows[names.r]={...state.rows[names.r],updated_at:'r2'};};await expect(readExactPublishedSource(access,target)).rejects.toMatchObject({status:409});});
 it('does not flatten database unavailability into missing source',async()=>{state.error=true;await expect(readExactPublishedSource(access,target)).rejects.toMatchObject({status:503});});
 it('denies paid catalog access to Free viewers',async()=>{state.rows[names.r]!.access_tier='paid';await expect(readExactPublishedSource(access,target)).rejects.toMatchObject({status:403});});
 it('labels digestless retained media as observed bytes and changes its version when those bytes change',async()=>{
  state.rows[names.s]={...state.rows[names.s],asset_type:'images',source_payload:null,source_storage_bucket:'cardforge-contributor-assets',source_storage_path:'legacy/source.png',source_mime_type:'image/png',source_content_sha256:null};
  state.download.mockResolvedValue({data:new Blob(['first'],{type:'image/png'}),error:null});
  const first=await readExactPublishedSource(access,target);
  expect(first.sourceIntegrity).toMatchObject({kind:'observed-source-bytes',notice:expect.stringContaining('Original publication bytes are not certified')});
  state.download.mockResolvedValue({data:new Blob(['other'],{type:'image/png'}),error:null});
  const second=await readExactPublishedSource(access,target);
  expect(second.sourceVersion).not.toBe(first.sourceVersion);expect(second.sourceIntegrity.kind).toBe('observed-source-bytes');
 });

it('does not download or replace resource-looking printable text in a selected published payload',async()=>{
 const label='cardforge-pipeline-asset://'+'a'.repeat(64);
 state.rows[names.s]!.source_payload={...style,name:'https://example.com/style',updates:{content:label}};
 const result=await readExactPublishedSource(access,target);
 expect(result.content).toMatchObject({name:'https://example.com/style',updates:{content:label}});
 expect(state.download).not.toHaveBeenCalled();
});

it('hydrates only a typed published image binding, not identical printable managed-URI text',async()=>{
 const bytes=Buffer.from('immutable image specimen');const hash=createHash('sha256').update(bytes).digest('hex');const uri='cardforge-pipeline-asset://'+hash;
 state.rows[names.s]={...state.rows[names.s],asset_type:'templates',source_payload:{id:'t',name:uri,aspectRatio:'1:1',templatePreviewData:{artworkUrl:uri,caption:uri,imageSource:'https://example.com/prose'},freeformCanvas:{width:100,height:100,elements:[{id:'i',name:'Art',type:'image',imageSource:'artworkUrl',x:0,y:0,width:100,height:100,zIndex:1}]}}};
 state.download.mockResolvedValue({data:new Blob([bytes]),error:null});
 const result=await readExactPublishedSource(access,target);
 expect(result.content).toMatchObject({name:uri,templatePreviewData:{artworkUrl:'data:image/webp;base64,'+bytes.toString('base64'),caption:uri,imageSource:'https://example.com/prose'}});
 expect(state.download).toHaveBeenCalledExactlyOnceWith('template-assets/'+hash+'.webp');
});

it('fails closed on shared printable/artwork managed data and ignores unused image content fallback bindings',async()=>{
 const bytes=Buffer.from('immutable image specimen');const hash=createHash('sha256').update(bytes).digest('hex');const uri='cardforge-pipeline-asset://'+hash;
 const template={id:'t',name:'Exact',aspectRatio:'1:1',templatePreviewData:{portrait:uri},freeformCanvas:{width:100,height:100,elements:[{id:'i',name:'Art',type:'image',imageSource:'portrait',x:0,y:0,width:100,height:100,zIndex:1},{id:'text',name:'Text',type:'text',content:'{{portrait}}',x:0,y:0,width:100,height:20,zIndex:2}]}};
 state.rows[names.s]={...state.rows[names.s],asset_type:'templates',source_payload:template};
 await expect(readExactPublishedSource(access,target)).rejects.toMatchObject({status:400});expect(state.download).not.toHaveBeenCalled();
 template.freeformCanvas.elements[0].imageSource='data:image/png;base64,YQ==';template.freeformCanvas.elements[0].content='{{portrait}}';
 const result=await readExactPublishedSource(access,target);expect(result.content).toMatchObject({templatePreviewData:{portrait:uri}});expect(state.download).not.toHaveBeenCalled();
});

});
