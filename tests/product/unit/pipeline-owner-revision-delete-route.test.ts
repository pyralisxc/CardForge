import {beforeEach,describe,expect,it,vi} from 'vitest';
import {POST} from '@/app/api/pipeline/[submissionId]/delete-revision/route';
import {getCurrentOwnerAccess,recordOwnerActivity} from '@/features/owner/server';
import {deleteOneTrashedPipelineRevision,RevisionDeleteError} from '@/features/pipeline/server/ownerRevisionDeletion';
vi.mock('@/features/owner/server',()=>({getCurrentOwnerAccess:vi.fn(),recordOwnerActivity:vi.fn()}));
vi.mock('@/features/pipeline/server/ownerRevisionDeletion',()=>({
 deleteOneTrashedPipelineRevision:vi.fn(),
 RevisionDeleteError:class RevisionDeleteError extends Error {constructor(public status:409|503,message:string){super(message);}}
}));
vi.mock('@/features/pipeline/server/catalogCache',()=>({revalidateCardForgeCatalog:vi.fn()}));
const id='550e8400-e29b-41d4-a716-446655440000';
const context={params:Promise.resolve({submissionId:id})};
const post=(value:string)=>POST(new Request('http://localhost/api/pipeline/'+id+'/delete-revision',{
 method:'POST',headers:{'Content-Type':'application/json'},body:value
}),context);
describe('Owner revision deletion boundary',()=>{
 beforeEach(()=>{vi.resetAllMocks();vi.mocked(getCurrentOwnerAccess).mockResolvedValue({
  isOwner:true,userId:'owner-user',email:'owner@example.invalid'
 } as Awaited<ReturnType<typeof getCurrentOwnerAccess>>);});
 it('denies unsigned or non-Owner before reading the deletion request',async()=>{
  vi.mocked(getCurrentOwnerAccess).mockResolvedValueOnce({isOwner:false,userId:'other'} as Awaited<ReturnType<typeof getCurrentOwnerAccess>>);
  expect((await post('{"confirmationName":"asset","storagePath":null}')).status).toBe(403);
  expect(deleteOneTrashedPipelineRevision).not.toHaveBeenCalled();
 });
 it('rejects invalid JSON and absent exact confirmation without claiming',async()=>{
  expect((await post('{')).status).toBe(400);
  expect((await post('{"confirmationName":"asset"}')).status).toBe(400);
  expect(deleteOneTrashedPipelineRevision).not.toHaveBeenCalled();
 });
 it('routes a valid row-only confirmed revision through one server command',async()=>{
  vi.mocked(deleteOneTrashedPipelineRevision).mockResolvedValue(undefined);
  const response=await post('{"confirmationName":"Test revision","storagePath":null}');
  expect(response.status).toBe(200);
  expect(deleteOneTrashedPipelineRevision).toHaveBeenCalledWith({
   submissionId:id,name:'Test revision',storagePath:null
  });
  expect(recordOwnerActivity).toHaveBeenCalledTimes(1);
 });
 it('preserves stale refusal and provider failure without false success activity',async()=>{
  vi.mocked(deleteOneTrashedPipelineRevision).mockRejectedValueOnce(new RevisionDeleteError(409,'Stale revision'));
  expect((await post('{"confirmationName":"Asset","storagePath":null}')).status).toBe(409);
  vi.mocked(deleteOneTrashedPipelineRevision).mockRejectedValueOnce(new RevisionDeleteError(503,'Storage uncertain'));
  expect((await post('{"confirmationName":"Asset","storagePath":null}')).status).toBe(503);
  expect(recordOwnerActivity).not.toHaveBeenCalled();
 });
});
