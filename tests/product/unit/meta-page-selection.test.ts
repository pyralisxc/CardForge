import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptMarketingToken } from '@/features/marketing-distribution/server/marketingTokenCrypto';
import { completePendingMetaPageSelection, readPendingMetaPageSelection } from '@/features/marketing-distribution/server/metaConnection';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: vi.fn() }));
const key = Buffer.alloc(32, 9).toString('base64');
const owner='owner-fixture';
const id='550e8400-e29b-41d4-a716-446655440000';
const pages=[{id:'page-a',name:'Shared Name',access_token:'private-page-token',instagram_business_account:{id:'ig-a',username:'example'}},{id:'page-b',name:'Shared Name',access_token:'another-private-token'}];
const payload=encryptMarketingToken(JSON.stringify(pages),key);
const fixture={id,owner_user_id:owner,payload_ciphertext:payload.ciphertext,payload_iv:payload.iv,payload_auth_tag:payload.authTag,expires_at:'2099-01-01T00:00:00Z',terminal_receipt:null};
const makeDatabase=(record:typeof fixture | null, outcome: unknown) => {
  const maybeSingle=vi.fn().mockResolvedValue({data:record,error:null});
  const query={select:vi.fn(),eq:vi.fn(),maybeSingle};
  query.select.mockReturnValue(query);query.eq.mockReturnValue(query);
  return {from:vi.fn().mockReturnValue(query),rpc:vi.fn().mockResolvedValue({data:outcome,error:null})};
};
describe('Meta Page-selection failure and identity boundary', () => {
  beforeEach(()=>{process.env.CARDFORGE_SOCIAL_TOKEN_ENCRYPTION_KEY=key;});
  it('passes only the selected discovered Page to the atomic native operation',async()=>{
    const database=makeDatabase(fixture,{cancelled:false,connectionCount:2});
    vi.mocked(getSupabaseServerClient).mockReturnValue(database as never);
    await expect(completePendingMetaPageSelection(id,owner,'page-a')).resolves.toEqual({cancelled:false,connectionCount:2});
    expect(database.rpc).toHaveBeenCalledOnce();
    const [,args]=database.rpc.mock.calls[0];
    expect(args.p_page_id).toBe('page-a');
    expect(args.p_accounts.map((account:{account_id:string})=>account.account_id)).toEqual(['page-a','ig-a']);
    expect(JSON.stringify(args)).not.toContain('private-page-token');
  });
  it('cancels without reading or updating existing identities',async()=>{
    const database=makeDatabase(null,{cancelled:true,connectionCount:0});
    vi.mocked(getSupabaseServerClient).mockReturnValue(database as never);
    await expect(completePendingMetaPageSelection(id,owner,null)).resolves.toEqual({cancelled:true,connectionCount:0});
    expect(database.from).not.toHaveBeenCalled();
    expect(database.rpc.mock.calls[0][1].p_accounts).toEqual([]);
  });
  it('rejects absent rows without claiming expiry',async()=>{
    const database=makeDatabase(null,null);
    vi.mocked(getSupabaseServerClient).mockReturnValue(database as never);
    await expect(readPendingMetaPageSelection(id,owner)).rejects.toThrow('not found');
  });
  it('does not consume a pending selection when the database cannot commit',async()=>{
    const database=makeDatabase(fixture,null);
    database.rpc.mockResolvedValue({data:null,error:{message:'database unavailable'}});
    vi.mocked(getSupabaseServerClient).mockReturnValue(database as never);
    await expect(completePendingMetaPageSelection(id,owner,'page-a')).rejects.toThrow('could not be saved');
    expect(database.rpc).toHaveBeenCalledOnce();
  });
  it('replays a terminal receipt without writing provider connections again',async()=>{
    const database=makeDatabase({...fixture,terminal_receipt:{cancelled:false,connectionCount:2}},null);
    vi.mocked(getSupabaseServerClient).mockReturnValue(database as never);
    await expect(completePendingMetaPageSelection(id,owner,'page-a')).resolves.toEqual({cancelled:false,connectionCount:2});
    expect(database.rpc).not.toHaveBeenCalled();
  });
});
