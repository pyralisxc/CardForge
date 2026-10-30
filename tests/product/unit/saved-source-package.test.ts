import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({published:vi.fn(),candidate:vi.fn(),drive:vi.fn()}));
vi.mock('@/features/pipeline/server',()=>({readExactPublishedSource:mocks.published,readExactCandidateReview:mocks.candidate,exactCandidateIdentitySchema:{safeParse:()=>({success:true,data:{}})},isRepositoryTemplate:()=>false,isRepositoryStyle:()=>false}));
vi.mock('@/features/studio-documents/server/mcpProjectSourceBridge',()=>({readConnectedProjectForAgent:mocks.drive}));
import { buildCardForgeProjectSnapshot,encodeCardForgeProjectPackage,decodeCardForgeProjectPackage,hydrateCardForgeProjectSnapshot } from '@/features/project/lib/projectPackageCodec';
import type { ProjectDocumentV1 } from '@/features/project/model/projectDocument';
import { readSavedSourcePreview } from '@/features/studio-documents/server/savedSourcePreview';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2ZxQAAAAASUVORK5CYII=';
const source={kind:'pipeline' as const,assetId:'asset',submissionId:'11111111-1111-4111-8111-111111111111',lineageId:'22222222-2222-4222-8222-222222222222',selection:'current' as const};
const access={user:{id:'actor'},isOwner:false} as never;
const document: ProjectDocumentV1={version:1,userTemplates:[{id:'t',name:'Exact',aspectRatio:'1:1',templateSource:'user',freeformCanvas:{width:100,height:100,elements:[{id:'i',name:'Artwork',type:'image',x:0,y:0,width:100,height:100,zIndex:1,imageSource:png}]}}],cardSets:[{id:'s',name:'Saved Set'}],storedCards:[{uniqueId:'c',setId:'s',setName:'Saved Set',templateId:'t',data:{artwork:png}}],appearanceStyles:[],exportSettings:{},customAssets:{'cardforge-maker-custom-textures':[],'cardforge-maker-custom-dividers':[],'cardforge-maker-custom-icons':[],'cardforge-maker-custom-images':[]}};
beforeEach(()=>vi.clearAllMocks());
it('inspects selected native packaged cards without changing portable bytes or embedded artwork',async()=>{
 const snapshot=await buildCardForgeProjectSnapshot({document,name:'Saved',savedAt:'2026-10-30T00:00:00Z'});
 const bytes=await encodeCardForgeProjectPackage(snapshot);const before=Buffer.from(bytes);
 mocks.published.mockResolvedValue({assetType:'sets',bytes:Buffer.from(bytes),identity:{submissionId:source.submissionId},sourceVersion:'a'.repeat(64),title:'Saved'});
 const discovery=await readSavedSourcePreview(access,source);expect(discovery.availableSelections?.[0].cardIds).toEqual(['c']);
 const result=await readSavedSourcePreview(access,{...source,setId:'s',cardIds:['c']});
 expect(result.content.kind).toBe('cards');if(result.content.kind==='cards')expect(result.content.document.userTemplates[0].freeformCanvas?.elements[0].imageSource).toBe(png);
 expect(Buffer.from(bytes)).toEqual(before);expect(hydrateCardForgeProjectSnapshot(await decodeCardForgeProjectPackage(bytes)).storedCards[0].data.artwork).toBe(png);
 await expect(readSavedSourcePreview(access,{...source,setId:'s',cardIds:['missing']})).rejects.toMatchObject({status:404});
});
it('refuses non-Owner pending source before calling the exact candidate reader',async()=>{
 await expect(readSavedSourcePreview(access,{kind:'pipeline-candidate',identity:{}})).rejects.toMatchObject({status:403});expect(mocks.candidate).not.toHaveBeenCalled();
});
