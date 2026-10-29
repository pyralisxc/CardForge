import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { verifySelectedPublishedManagedRaster, assertStaticManagedRasterSlot } from '@/features/pipeline/lib/managedRasterAdoption';

vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: vi.fn() }));
const bytes = Uint8Array.from([1,2,3,4]);
const digest = createHash('sha256').update(bytes).digest('hex');
const selection = {registryAssetId:'raster-live',publishedSubmissionId:'submission-v3',elementId:'art'};
const registry = {asset_id:'raster-live',asset_type:'image',status:'published',contributor_submission_id:'submission-v3'};
const source = {id:'submission-v3',lineage_id:'lineage-A',revision_number:3,status:'published',
  published_at:'2026-10-28T00:00:00Z',target_registry_asset_id:'raster-live',
  source_storage_bucket:'cardforge-contributor-assets',source_storage_path:'owned/revision-3.png',
  source_mime_type:'image/png',source_file_size_bytes:4,
  source_content_sha256:digest,source_upload_token:'token-3'};
const lineage = {id:'lineage-A',registry_asset_id:'raster-live',upload_state:'owned',
  upload_submission_id:'submission-v3',upload_operation_token:'token-3',
  upload_source_path:'owned/revision-3.png',catalog_trashed_at:null,purge_state:null,
  catalog_claim_token:null,catalog_destructive_uncertainty:null};
function mock(options:{source?:unknown;lineage?:unknown;registry?:unknown;laterRegistry?:unknown;
  file?:Uint8Array|null;storageError?:boolean}={}){
  let registryReads=0;
  const query=(table:string)=>({select:()=>({eq:()=>({maybeSingle:async()=>{
    if(table==='cardforge_asset_registry')return{data:++registryReads===1?(options.registry===undefined?registry:options.registry):
      (options.laterRegistry===undefined?registry:options.laterRegistry),error:null};
    if(table==='cardforge_pipeline_asset_lineages')return{data:options.lineage===undefined?lineage:options.lineage,error:null};
    return{data:options.source===undefined?source:options.source,error:null};
  }})})});
  const download=vi.fn(async()=>({data:options.file===null?null:
    new Blob([Uint8Array.from(options.file??bytes).buffer]),error:options.storageError?{message:'unavailable'}:null}));
  vi.mocked(getSupabaseServerClient).mockReturnValue({from:query,storage:{from:()=>({download})}} as never);
  return{download};
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
    mock({source:{...source,source_content_sha256:null}});
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
  it('rejects changed live pointer or wrong source revision',async()=>{
    mock({laterRegistry:{...registry,contributor_submission_id:'other'}});
    await expect(verifySelectedPublishedManagedRaster(selection)).rejects.toMatchObject({status:409});
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
  it('rejects missing bytes and unexpected sizes',async()=>{
    mock({file:null});
    await expect(verifySelectedPublishedManagedRaster(selection)).rejects.toMatchObject({status:503});
    mock({source:{...source,source_file_size_bytes:5}});
    await expect(verifySelectedPublishedManagedRaster(selection)).rejects.toMatchObject({status:409});
  });
});
