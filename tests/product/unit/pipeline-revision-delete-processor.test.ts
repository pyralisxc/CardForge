import {describe,it,expect,vi} from 'vitest';
import {processRevisionPurge} from '../../../supabase/functions/purge-pipeline-revisions/processor';
const claim={submission_id:'550e8400-e29b-41d4-a716-446655440000',storage_bucket:'test-bucket',storage_path:'disposable/test.png'};
describe('shared Pipeline revision deletion processor',()=>{
 it('removes Storage before finalizing exactly one claimed revision',async()=>{
  const order:string[]=[];
  const remove=vi.fn(async()=>{order.push('storage');return {error:null};});
  const rpc=vi.fn(async()=>{order.push('finalizer');return {data:true,error:null};});
  const result=await processRevisionPurge({storage:{from:()=>({remove})},rpc},claim);
  expect(result).toEqual({purged:true,failed:false});
  expect(order).toEqual(['storage','finalizer']);
  expect(remove).toHaveBeenCalledWith(['disposable/test.png']);
  expect(rpc).toHaveBeenCalledWith('cardforge_finalize_pipeline_revision_purge',{p_submission_id:claim.submission_id});
 });
 it('does not finalize when Storage removal fails; releases exact claim',async()=>{
  const remove=vi.fn(async()=>({error:new Error('storage failed')}));
  const rpc=vi.fn(async()=>({data:true,error:null}));
  expect(await processRevisionPurge({storage:{from:()=>({remove})},rpc},claim)).toEqual({purged:false,failed:true});
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('cardforge_release_pipeline_revision_purge',{p_submission_id:claim.submission_id});
 });
 it('releases claim if finalization cannot confirm deletion',async()=>{
  const rpc=vi.fn(async(name:string)=>name==='cardforge_finalize_pipeline_revision_purge'
   ?{data:false,error:null}:{data:true,error:null});
  const remove=vi.fn(async()=>({error:null}));
  expect(await processRevisionPurge({storage:{from:()=>({remove})},rpc},claim)).toEqual({purged:false,failed:true});
  expect(rpc).toHaveBeenNthCalledWith(2,'cardforge_release_pipeline_revision_purge',{p_submission_id:claim.submission_id});
 });
});
