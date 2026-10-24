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
