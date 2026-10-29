import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createTemplatePipelineDraft } from '@/features/pipeline/lib/pipelineRegistryCommands';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { verifySelectedPublishedManagedRaster, assertStaticManagedRasterSlot, prepareManagedRasterTemplateRevision, readManagedRasterAttempt } from '@/features/pipeline/lib/managedRasterAdoption';

vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: vi.fn() }));
const bytes = Uint8Array.from([1,2,3,4]);
const digest = createHash('sha256').update(bytes).digest('hex');
const selection = {registryAssetId:'raster-live',publishedSubmissionId:'submission-v3',elementId:'art'};
const registry = {asset_id:'raster-live',asset_type:'image',status:'published',access_tier:'free',contributor_submission_id:'submission-v3'};
const source = {id:'submission-v3',lineage_id:'lineage-A',revision_number:3,status:'published',
  published_at:'2026-10-28T00:00:00Z',target_registry_asset_id:'raster-live',
  source_storage_bucket:'cardforge-contributor-assets',source_storage_path:'pipeline-owned-v1/fixture/source.png',
  source_mime_type:'image/png',source_file_size_bytes:4,
};
const receipt = {id:'original-upload',lineage_id:'lineage-A',source_upload_token:'token-3',
  source_storage_bucket:'cardforge-contributor-assets',source_storage_path:'pipeline-owned-v1/fixture/source.png',source_content_sha256:digest};
const lineage = {id:'lineage-A',registry_asset_id:'raster-live',upload_state:'owned',
  upload_submission_id:'original-upload',upload_operation_token:'token-3',upload_request:{asset_type:'imageAssets'},
  upload_source_path:'pipeline-owned-v1/fixture/source.png',catalog_trashed_at:null,purge_state:null,
  catalog_claim_token:null,catalog_claimed_at:null,catalog_destructive_uncertainty:null};
function mock(options:{source?:unknown;lineage?:unknown;registry?:unknown;receipt?:unknown;
  file?:Uint8Array|null;storageError?:boolean}={}){
  let submissionReads=0;
  const query=(table:string)=>({upsert:vi.fn(async()=>({error:null})),select:(columns:string)=>({eq:()=>({maybeSingle:async()=>{
    const project=(value:unknown)=>{
      if(value===null || typeof value!=='object') return value;
      return Object.fromEntries(columns.split(',').filter(c=>Object.prototype.hasOwnProperty.call(value,c))
        .map(c=>[c,(value as Record<string,unknown>)[c]]));
    };
    if(table==='cardforge_asset_registry')return{data:project(options.registry===undefined?registry:options.registry),error:null};
    if(table==='cardforge_pipeline_asset_lineages')return{data:project(options.lineage===undefined?lineage:options.lineage),error:null};
    return{data:project(++submissionReads===1?(options.source===undefined?source:options.source):
      (options.receipt===undefined?receipt:options.receipt)),error:null};
  }})})});
  const download=vi.fn(async()=>({data:options.file===null?null:
    new Blob([Uint8Array.from(options.file??bytes).buffer]),error:options.storageError?{message:'unavailable'}:null}));
  const upload=vi.fn(async (_path:string,_bytes:Buffer)=>({error:null}));
  vi.mocked(getSupabaseServerClient).mockReturnValue({from:query,storage:{from:()=>({download,upload,exists:async()=>({data:false,error:null})})}} as never);
  return{download,upload};
}
beforeEach(()=>{vi.resetAllMocks();mock();});
describe('static slot precondition',()=>{
  const basic = { id:'template-1', name:'Template', aspectRatio:'63:88' as const,
    freeformCanvas:{width:630,height:880,elements:[{ id:'art',name:'Image',type:'image' as const,
      x:0,y:0,width:50,height:60,zIndex:0,imageSource:'' }]},
  };
  it('accepts a single static slot without altering any authored content',()=>{
    const before=structuredClone(basic);
    expect(()=>assertStaticManagedRasterSlot(basic,selection)).not.toThrow();
    expect(basic).toEqual(before);
  });
  it('rejects per-card contracts, preview data and bound dynamic sources',()=>{
    expect(()=>assertStaticManagedRasterSlot({...basic,fieldContracts:[
      {key:'art',type:'image' as const,elementId:'art'}]},selection)).toThrow();
    expect(()=>assertStaticManagedRasterSlot({...basic,templatePreviewData:{
      image_image_art:'https://example.invalid/override.png'}},selection)).toThrow();
    expect(()=>assertStaticManagedRasterSlot({...basic,freeformCanvas:{...basic.freeformCanvas,
      elements:[{...basic.freeformCanvas.elements[0],imageSource:'{{art}}'}]}},selection)).toThrow();
  });
});

describe('published raster immutable-source observation',()=>{
  it('observes original digest and verified lineage without writing normalized storage',async()=>{
    const result=await verifySelectedPublishedManagedRaster(selection);
    expect(result).toMatchObject({submissionId:'submission-v3',lineageId:'lineage-A',originalSha256:digest});
    expect(result).not.toHaveProperty('normalizedReference');
    expect(result).not.toHaveProperty('templateWebpSha256');
  });
  it('rejects uncommitted legacy digest, spoofed lineage or independent submission',async()=>{
    mock({receipt:{...receipt,source_content_sha256:null}});
    await expect(verifySelectedPublishedManagedRaster(selection)).rejects.toMatchObject({status:409});
    mock({source:{...source,lineage_id:'other'}});
    await expect(verifySelectedPublishedManagedRaster(selection)).rejects.toMatchObject({status:409});
    mock({source:{...source,id:'independent-submission'}});
    await expect(verifySelectedPublishedManagedRaster(selection)).rejects.toMatchObject({status:409});
  });
  it('rejects same-sized replacement bytes even when source tuple is unchanged',async()=>{
    mock({file:Uint8Array.from([4,3,2,1])});
    await expect(verifySelectedPublishedManagedRaster(selection)).rejects.toMatchObject({status:409});
  });
  it('observes a current pointer but leaves transaction races for native locked proof',async()=>{
    mock({registry:{...registry,contributor_submission_id:'other'}});
    await expect(verifySelectedPublishedManagedRaster(selection)).rejects.toMatchObject({status:409});
  });
  it('rejects non-owned uploads, wrong storage source and active Trash/claim',async()=>{
    mock({lineage:{...lineage,upload_state:'pending'}});
    await expect(verifySelectedPublishedManagedRaster(selection)).rejects.toMatchObject({status:409});
    mock({source:{...source,source_storage_bucket:'arbitrary-public'}});
    await expect(verifySelectedPublishedManagedRaster(selection)).rejects.toMatchObject({status:409});
    mock({lineage:{...lineage,catalog_trashed_at:'2026-10-28T00:00:00Z'}});
    await expect(verifySelectedPublishedManagedRaster(selection)).rejects.toMatchObject({status:409});
  });
  it('accepts the original upload receipt distinct from the current published revision, but rejects wrong receipt tuples',async()=>{
    const result=await verifySelectedPublishedManagedRaster(selection);
    expect(result.submissionId).toBe('submission-v3');
    mock({receipt:{...receipt,source_storage_path:'another/path.png'}});
    await expect(verifySelectedPublishedManagedRaster(selection)).rejects.toMatchObject({status:409});
    mock({lineage:{...lineage,catalog_claimed_at:'2026-10-28T00:00:00Z'}});
    await expect(verifySelectedPublishedManagedRaster(selection)).rejects.toMatchObject({status:409});
  });
  it('rejects missing bytes and unexpected sizes',async()=>{
    mock({file:null});
    await expect(verifySelectedPublishedManagedRaster(selection)).rejects.toMatchObject({status:503});
    mock({source:{...source,source_file_size_bytes:5}});
    await expect(verifySelectedPublishedManagedRaster(selection)).rejects.toMatchObject({status:409});
  });
});


describe('managed raster actual preparation and receipt recovery',()=>{
  const template={id:'new-template',name:'New Template',aspectRatio:'63:88' as const,
    freeformCanvas:{width:630,height:880,elements:[{id:'art',name:'Art',type:'image' as const,
      x:0,y:0,width:120,height:180,zIndex:0,imageSource:'',content:''}]}};
  it('decodes actual accepted PNG and binds a distinct WebP identity without changing geometry',async()=>{
    const png=await sharp({create:{width:2,height:2,channels:4,background:'#ff8800'}}).png().toBuffer();
    const originalSha=createHash('sha256').update(png).digest('hex');
    const {upload}=mock({file:png,source:{...source,source_file_size_bytes:png.length},
      receipt:{...receipt,source_content_sha256:originalSha}});
    const prepared=await prepareManagedRasterTemplateRevision(template,selection);
    expect(upload).toHaveBeenCalledTimes(1);
    const normalized=upload.mock.calls[0][1];
    expect((await sharp(normalized).metadata()).format).toBe('webp');
    expect(prepared.adoption.originalSha256).toBe(originalSha);
    expect(prepared.adoption.normalizedSha256).toBe(createHash('sha256').update(normalized).digest('hex'));
    expect(prepared.adoption.normalizedSha256).not.toBe(originalSha);
    expect(prepared.template.freeformCanvas?.elements[0]).toMatchObject({x:0,y:0,width:120,height:180});
    expect(template.freeformCanvas.elements[0].imageSource).toBe('');
  });
  it('recovers an exact committed draft before touching unavailable or changed raster storage',async()=>{
    let prior:unknown=null;
    const download=vi.fn(()=>{throw new Error('Source unavailable after commit');});
    const rpc=vi.fn(()=>{throw new Error('Must recover, not create again');});
    const row={id:'saved-draft',status:'draft',base_revision_number:0,revision_number:1,target_registry_asset_id:template.id};
    const chain={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn(async()=>({data:prior,error:null})),
      limit:vi.fn(async()=>({data:[row],error:null}))};
    chain.select.mockReturnValue(chain);chain.eq.mockReturnValue(chain);
    const from=vi.fn((table:string)=>{expect(table).toBe('cardforge_contributor_asset_submissions');return chain;});
    vi.mocked(getSupabaseServerClient).mockReturnValue({from,rpc,storage:{from:()=>({download})}} as never);
    const args={template,contributorId:'author',contributorEmail:null,submissionKey:'same-saved-attempt',managedRasterSelection:selection};
    const initial=await readManagedRasterAttempt(template,selection,'author',null,args.submissionKey,'draft',0);
    prior={id:row.id,catalog_dependencies:{managedRaster:{request:{requestFingerprint:initial.requestFingerprint}}}};
    await expect(createTemplatePipelineDraft(args)).resolves.toMatchObject({id:row.id,revisionNumber:1});
    expect(download).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled();
    await expect(createTemplatePipelineDraft({...args,template:{...template,name:'Different snapshot'}})).rejects.toMatchObject({status:409});
    chain.maybeSingle.mockResolvedValueOnce({data:null,error:{message:'unavailable'}} as never);
    await expect(createTemplatePipelineDraft(args)).rejects.toMatchObject({status:503});
    expect(download).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled();
  });
});
