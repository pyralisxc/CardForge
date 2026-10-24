import {describe,expect,it} from 'vitest';
import {parsePipelineRetentionRequest} from '../../../supabase/functions/purge-pipeline-revisions/targeting';
const id='550e8400-e29b-41d4-a716-446655440000';
describe('Pipeline retention target selection',()=>{
  it('preserves ordinary empty scheduled request semantics',()=>{
    expect(parsePipelineRetentionRequest('')).toEqual({mode:'batch'});
    expect(parsePipelineRetentionRequest('{}')).toEqual({mode:'batch'});
  });
  it('accepts only the exact UUID-target intent',()=>{
    expect(parsePipelineRetentionRequest(JSON.stringify({mode:'targeted',submissionId:id})))
      .toEqual({mode:'targeted',submissionId:id});
    for(const input of ['not-json','null','[]','{"submissionId":"'+id+'"}',
      '{"mode":"targeted"}','{"mode":"batch","submissionId":"'+id+'"}',
      '{"mode":"targeted","submissionId":"bad"}',
      '{"mode":"targeted","submissionId":"'+id+'","batch":true}'])
      expect(()=>parsePipelineRetentionRequest(input)).toThrow('invalid_retention_target');
  });
});

import {vi} from 'vitest';
import {routePipelineRetentionClaims} from '../../../supabase/functions/purge-pipeline-revisions/targeting';
describe('targeted worker claim routing',()=>{
  it('never invokes global expiry or claim for targeted requests',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:[{submission_id:id,storage_bucket:null,storage_path:null}],error:null});
    const result=await routePipelineRetentionClaims({mode:'targeted',submissionId:id},rpc);
    expect(result.claims).toHaveLength(1);
    expect(rpc.mock.calls).toEqual([['cardforge_claim_pipeline_revision_purge_target',{p_submission_id:id}]]);
  });
  it('returns no claims for mismatched target, so no Storage deletion can be reached',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:[{submission_id:'550e8400-e29b-41d4-a716-446655440001',storage_bucket:'bucket',storage_path:'unsafe'}],error:null});
    const result=await routePipelineRetentionClaims({mode:'targeted',submissionId:id},rpc);
    expect(result).toEqual({expired:0,claims:[],error:'target_not_eligible'});
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
