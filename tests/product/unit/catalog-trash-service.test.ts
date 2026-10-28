import { beforeEach, describe, expect, it, vi } from 'vitest';
const { access, rpc, database } = vi.hoisted(() => ({access:vi.fn(),rpc:vi.fn(),database:vi.fn()}));
vi.mock('@/features/account/server', () => ({getAccountToolAccessForUserId:access}));
vi.mock('@/infrastructure/database/supabaseServer', () => ({getSupabaseServerClient:database}));
import type { CatalogTrashExpectedState } from '@/features/pipeline/lib/catalogTrashContract';
import { changeCatalogTrash, readCatalogTrash } from '@/features/pipeline/server/catalogTrash';
const identity = {lineageId:'00000000-0000-4000-8000-000000000001',submissionId:'00000000-0000-4000-8000-000000000002',registrySubmissionId:'00000000-0000-4000-8000-000000000002',revisionHighWater:3};
const active = {identity,trashedAt:null,purgeAfter:null,held:false};
const trashed = {...active,trashedAt:'2026-10-26T00:00:00Z',purgeAfter:'2026-11-25T00:00:00Z'};
const receipt = (state: CatalogTrashExpectedState = trashed) => ({name:'Native catalog',state,retentionDays:30,reasons:[],entryReasons:[]});
beforeEach(() => {vi.resetAllMocks();access.mockResolvedValue({isOwner:true});database.mockReturnValue({rpc});rpc.mockResolvedValue({data:receipt(),error:null});});
describe('canonical catalog recovery service', () => {
  it('rechecks Owner authority before read or mutation', async () => {
    access.mockResolvedValue({isOwner:false});
    await expect(readCatalogTrash('viewer',identity.submissionId)).rejects.toMatchObject({status:403});
    await expect(changeCatalogTrash('viewer',{action:'trash',expected:active})).rejects.toMatchObject({status:403});
    expect(database).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled();
  });
  it('does not substitute an empty inventory when native read fails', async () => {
    rpc.mockResolvedValue({data:null,error:{message:'missing function'}});
    await expect(readCatalogTrash('owner',identity.submissionId)).rejects.toMatchObject({status:503});
  });
  it('passes the full observed state to the native command without dependency claims', async () => {
    await expect(changeCatalogTrash('owner',{action:'trash',expected:active})).resolves.toEqual(receipt());
    expect(rpc).toHaveBeenCalledExactlyOnceWith('cardforge_change_catalog_trash',{p_actor_user_id:'owner',p_action:'trash',p_expected:active,p_held:null});
  });
  it('rejects storage-resource targets and client timers before any RPC', async () => {
    await expect(readCatalogTrash('owner','template-assets/shared.webp')).rejects.toMatchObject({status:400});
    await expect(changeCatalogTrash('owner',{action:'trash',expected:active,retentionDays:0})).rejects.toMatchObject({status:400});
    expect(rpc).not.toHaveBeenCalled();
  });
  it('preserves claim/dependency conflicts without automatic retries', async () => {
    for (const message of ['catalog_trash_already_claimed','catalog_trash_dependency_blocked']) {
      rpc.mockResolvedValue({data:null,error:{message}});
      await expect(changeCatalogTrash('owner',{action:'restore',expected:trashed})).rejects.toMatchObject({status:409,code:message});
    }
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('does not claim success for a different identity or mismatched state', async () => {
    rpc.mockResolvedValue({data:receipt({...trashed,identity:{...identity,revisionHighWater:4}}),error:null});
    await expect(changeCatalogTrash('owner',{action:'trash',expected:active})).rejects.toMatchObject({code:'catalog_trash_unconfirmed'});
    rpc.mockResolvedValue({data:receipt(),error:null});
    await expect(changeCatalogTrash('owner',{action:'restore',expected:trashed})).rejects.toMatchObject({code:'catalog_trash_unconfirmed'});
    await expect(changeCatalogTrash('owner',{action:'hold',expected:trashed,held:true})).rejects.toMatchObject({code:'catalog_trash_unconfirmed'});
  });
});

it('returns native blocker identities without turning diagnostics into command proof', async () => {
  const inventoryDetails = [{origin:'registry',recordId:'other-style',payloadKind:'elementPreset',conditions:['outside_supported_native_payload_subset']}];
  const blocked = {...receipt(active),entryReasons:['json_consumer_inventory_unverified'],inventoryDetails};
  rpc.mockResolvedValue({data:blocked,error:null});
  await expect(readCatalogTrash('owner',identity.submissionId)).resolves.toEqual(blocked);
  rpc.mockClear();
  await expect(changeCatalogTrash('owner',{action:'trash',expected:active,inventoryDetails:[]})).rejects.toMatchObject({status:400});
  expect(rpc).not.toHaveBeenCalled();
});

it('rejects malformed native diagnostics rather than reporting an empty inventory', async () => {
  rpc.mockResolvedValue({data:{...receipt(active),inventoryDetails:[{origin:'registry',recordId:'',payloadKind:'style',conditions:[]}]},error:null});
  await expect(readCatalogTrash('owner',identity.submissionId)).rejects.toMatchObject({status:503});
});
