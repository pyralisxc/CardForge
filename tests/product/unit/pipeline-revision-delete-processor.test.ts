import {describe,it,expect,vi} from 'vitest';
import {processRevisionPurge} from '../../../supabase/functions/purge-pipeline-revisions/processor';
const claim={submission_id:'550e8400-e29b-41d4-a716-446655440000',storage_bucket:'test-bucket',storage_path:'disposable/test.png',claim_token:'550e8400-e29b-41d4-a716-446655440001'};
describe('shared Pipeline revision deletion processor',()=>{
 it('removes Storage before finalizing exactly one claimed revision',async()=>{
  const order:string[]=[];
  const remove=vi.fn(async()=>{order.push('storage');return {error:null};});
  const rpc=vi.fn(async()=>{order.push('finalizer');return {data:true,error:null};});
  const result=await processRevisionPurge({storage:{from:()=>({remove})},rpc},claim);
  expect(result).toEqual({purged:true,failed:false});
  expect(order).toEqual(['storage','finalizer']);
  expect(remove).toHaveBeenCalledWith(['disposable/test.png']);
  expect(rpc).toHaveBeenCalledWith('cardforge_finalize_pipeline_revision_purge',{p_submission_id:claim.submission_id,p_claim_token:claim.claim_token});
 });
 it('retains the committed claim when Storage removal fails',async()=>{
  const remove=vi.fn(async()=>({error:new Error('storage failed')}));
  const rpc=vi.fn(async()=>({data:true,error:null}));
  expect(await processRevisionPurge({storage:{from:()=>({remove})},rpc},claim)).toEqual({purged:false,failed:true});
  expect(rpc).not.toHaveBeenCalled();
 });
 it('retains the committed claim after Storage success and finalizer failure',async()=>{
  const rpc=vi.fn(async(name:string)=>name==='cardforge_finalize_pipeline_revision_purge'
   ?{data:false,error:null}:{data:true,error:null});
  const remove=vi.fn(async()=>({error:null}));
  expect(await processRevisionPurge({storage:{from:()=>({remove})},rpc},claim)).toEqual({purged:false,failed:true});
  expect(remove).toHaveBeenCalledOnce();
  expect(rpc).toHaveBeenCalledExactlyOnceWith('cardforge_finalize_pipeline_revision_purge',{p_submission_id:claim.submission_id,p_claim_token:claim.claim_token});
 });
});

describe('revision-only processing without attached Storage',()=>{
 it('finalizes a valid row-only Template revision without Storage API calls',async()=>{
  const from=vi.fn();
  const rpc=vi.fn(async()=>({data:true,error:null}));
  const rowOnly={...claim,storage_bucket:null,storage_path:null};
  expect(await processRevisionPurge({storage:{from},rpc},rowOnly)).toEqual({purged:true,failed:false});
  expect(from).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith('cardforge_finalize_pipeline_revision_purge',{
    p_submission_id:claim.submission_id,p_claim_token:claim.claim_token,
  });
 });
 it('does not erase an interrupted row-only claim',async()=>{
  const rpc=vi.fn(async(name:string)=>({data:name!=='cardforge_finalize_pipeline_revision_purge',error:null}));
  const from=vi.fn();
  expect(await processRevisionPurge({storage:{from},rpc},{...claim,storage_bucket:null,storage_path:null}))
   .toEqual({purged:false,failed:true});
  expect(rpc).toHaveBeenCalledExactlyOnceWith('cardforge_finalize_pipeline_revision_purge',{
    p_submission_id:claim.submission_id,p_claim_token:claim.claim_token,
  });
 });
});
