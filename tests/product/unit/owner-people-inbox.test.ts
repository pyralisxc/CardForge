import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({ account: vi.fn(), oauth: vi.fn(), activity: vi.fn(), clerkGet: vi.fn(), clerkList: vi.fn(), profiles: vi.fn(), rpc: vi.fn(), configured: true, dbFail: false, readFail: false, updateFail: false, lostAck: false, ack: undefined as unknown, contacts: [] as Record<string, unknown>[], queries: [] as unknown[][][] }));
vi.mock('@clerk/nextjs/server', () => ({ auth: f.oauth, clerkClient: async () => ({ users: { getUser: f.clerkGet, getUserList: f.clerkList } }) }));
vi.mock('@/features/account/server', async original => ({ ...await original<object>(), getAccountToolAccessForUserId: f.account }));
vi.mock('@/features/contributor-access/server', async original => ({ ...await original<object>(), fetchContributorProfileRowsForOwner: f.profiles }));
vi.mock('@/features/owner/server/ownerActivityStore', () => ({ recordOwnerActivity: f.activity }));
vi.mock('@/features/owner/server', async original => ({ ...await original<object>(), getCurrentOwnerAccess: async () => ({ userId: 'owner', isOwner: true, email: 'owner@example.invalid' }) }));
vi.mock('@/features/mcp-usage/server', async original => ({ ...await original<object>(), observeMcpToolExecution: ({ execute }: { execute: () => unknown }) => execute() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerConfigStatus: () => ({ configured: f.configured }), getSupabaseServerClient: () => ({ rpc: f.rpc, from: (table: string) => {
  let id: unknown, update: Record<string, unknown> | undefined; const calls: unknown[][] = [['from',table]]; f.queries.push(calls);
  const q = { select: (columns: string) => { calls.push(['select',columns]); return q; }, eq: (key: string, value: unknown) => { id = value; calls.push(['eq',key,value]); return q; }, order: (...args: unknown[]) => { calls.push(['order',...args]); return q; }, update: (value: Record<string,unknown>) => { update=value; calls.push(['update',value]); return q; },
    maybeSingle: async () => ({ data: f.contacts.find(row=>row.id===id) ?? null, error: f.dbFail || f.readFail ? { message:'unavailable' } : null }),
    limit: async (limit: number) => {
      calls.push(['limit',limit]);
      if (!update) return { data: f.contacts.slice(0,limit), error: f.dbFail ? { message:'unavailable' } : null };
      if (f.updateFail) return { data:null, error:{ message:'unknown outcome' } };
      const found=f.contacts.find(row=>row.id===id); if (found) Object.assign(found,update); if(f.lostAck) throw new Error('ACK lost');
      return { data: f.ack !== undefined ? f.ack : found ? [{id:found.id,status:found.status}] : [], error:null };
    },
  }; return q;
} }) }));
import { readOwnerPeople, readOwnerInbox, saveOwnerInboxStatus } from '@/features/owner/server/ownerPeopleInboxCommands';
import { cardForgeOwnerMcpHandler } from '@/features/owner/server/mcpOwnerServer';
import { PATCH, GET as exactInboxGet } from '@/app/api/owner/contact-requests/[requestId]/route';
import { GET as inboxList } from '@/app/api/owner/contact-requests/route';
import { GET as peopleList } from '@/app/api/owner/people/route';
const requestId='1f5bd520-ff5c-4e25-bcb3-c1e828c277ab';
const request = (id=requestId,status='received') => ({id,kind:'support',name:'Synthetic sender',email:'sender@example.invalid',subject:'Synthetic support',message:'Untrusted message text',page_url:null,status,resend_email_id:'synthetic-delivery',created_at:'2026-11-02T00:00:00Z',private_extra:'not sanctioned'});
const user=(id='user_exact')=>({id,firstName:'Synthetic',lastName:'Person',emailAddresses:[{emailAddress:'person@example.invalid'}],primaryEmailAddressId:null,publicMetadata:{unrelated:'not sanctioned'},privateMetadata:{privateSecret:'never serialize',cardforgeOwnerCommercialPlan:'free'},createdAt:1,lastSignInAt:2});
const profile=(id='user_exact')=>({clerk_user_id:id,email:'person@example.invalid',first_name:'Synthetic',last_name:'Person',status:'inactive',can_draft_campaigns:false,monthly_submission_limit_override:null,monthly_published_requirement_override:null,owner_note:'Synthetic retained note'});
beforeEach(()=>{
  vi.resetAllMocks(); f.configured=true; f.dbFail=false;f.readFail=false;f.updateFail=false;f.lostAck=false;f.ack=undefined;f.contacts=[request()];f.queries=[];
  f.oauth.mockResolvedValue({userId:'oauth-owner'});f.account.mockResolvedValue({user:{id:'owner'},isOwner:true,email:'owner@example.invalid'});f.activity.mockResolvedValue(true);f.profiles.mockResolvedValue([]);f.clerkGet.mockImplementation(async(id:string)=>user(id));f.clerkList.mockImplementation(async({limit=12,offset=0,userId:ids,query}:{limit?:number;offset?:number;userId?:string[];query?:string}={})=>{const rows=Array.from({length:15},(_,i)=>user(`user_${i}`)).filter(row=>(!ids||ids.includes(row.id))&&(!query||row.id.includes(query)));return {data:rows.slice(offset,offset+limit),totalCount:rows.length};});f.rpc.mockResolvedValue({data:[],error:null});
});
it('People exact connected/account-only/history-only projection contains no raw Clerk metadata',async()=>{
  let result=await readOwnerPeople('owner',{userId:'user_exact'});expect(result.person).toMatchObject({id:'user_exact',identityState:'account_only'});expect(JSON.stringify(result)).not.toContain('never serialize');expect(result.person).not.toHaveProperty('privateMetadata');
  f.profiles.mockResolvedValue([profile()]);result=await readOwnerPeople('owner',{userId:'user_exact'});expect(result.person?.identityState).toBe('connected');
  f.clerkGet.mockRejectedValue({status:404});result=await readOwnerPeople('owner',{userId:'user_exact'});expect(result.person).toMatchObject({id:'user_exact',identityState:'history_only'});
});
it('People only authoritative absence yields 404; provider/profile failures and wrong identity are unavailable',async()=>{
  f.clerkGet.mockRejectedValueOnce({status:404});await expect(readOwnerPeople('owner',{userId:'absent'})).rejects.toMatchObject({status:404});
  f.profiles.mockResolvedValue([profile()]);f.clerkGet.mockRejectedValueOnce({status:503});await expect(readOwnerPeople('owner',{userId:'user_exact'})).rejects.toMatchObject({status:503});
  f.clerkGet.mockResolvedValueOnce(user('sibling'));await expect(readOwnerPeople('owner',{userId:'user_exact'})).rejects.toMatchObject({status:503});
  f.profiles.mockRejectedValueOnce(new Error('profile unavailable'));await expect(readOwnerPeople('owner',{})).rejects.toMatchObject({status:503});
});
it('People directory preserves page totals and exact identity browser route without mutations',async()=>{
  const result=await readOwnerPeople('owner',{page:2,pageSize:12,filter:'all'});expect(result.page).toMatchObject({page:2,pageSize:12,total:15});expect(result.page?.items).toHaveLength(3);
  const response=await peopleList(new Request('https://cardforge.test?userId=user_exact'));expect(response.status).toBe(200);expect(await response.json()).toMatchObject({people:null,person:{id:'user_exact'}});expect(f.queries.every(calls=>calls.every(call=>call[0]!=='update'))).toBe(true);expect(f.activity).not.toHaveBeenCalled();
});
it('Inbox latest-50 filters/counts are explicit; exact authoritative read reaches older request',async()=>{
  f.contacts=Array.from({length:51},(_,i)=>request(`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,i%2?'closed':'received'));
  const window=await readOwnerInbox('owner',{status:'closed',page:2,pageSize:8,query:'Synthetic',kind:'support'});expect(window.window).toMatchObject({scope:'latest_50',windowLimit:50,windowCount:50,filteredCount:25,page:2,totalPages:4});expect(window.window?.items).toHaveLength(8);
  const older=String(f.contacts[50].id);expect((await readOwnerInbox('owner',{requestId:older})).request?.id).toBe(older);expect(f.queries.at(-1)).toContainEqual(['eq','id',older]);expect(f.queries.at(-1)).not.toContainEqual(['limit',50]);expect(JSON.stringify(window)).not.toContain('not sanctioned');
});
it('Inbox genuine empty differs from unavailable/unconfigured/malformed and exact missing',async()=>{
  f.contacts=[];expect((await readOwnerInbox('owner',{})).window).toMatchObject({windowCount:0,filteredCount:0,items:[]});await expect(readOwnerInbox('owner',{requestId})).rejects.toMatchObject({status:404});
  f.configured=false;await expect(readOwnerInbox('owner',{})).rejects.toMatchObject({status:503});f.configured=true;f.dbFail=true;await expect(readOwnerInbox('owner',{})).rejects.toMatchObject({status:503});expect((await inboxList(new Request('https://cardforge.test'))).status).toBe(503);
  f.dbFail=false;f.contacts=[{...request(),status:'unknown'}];await expect(readOwnerInbox('owner',{})).rejects.toMatchObject({status:503});
});
for(const ack of [null,{},[{id:'other',status:'closed'}],[{id:requestId,status:'received'}],[{id:requestId,status:'closed'},{id:requestId,status:'closed'}]])it(`invalid affected-row ACK ${JSON.stringify(ack)} never confirms status`,async()=>{
  f.ack=ack;const result=await saveOwnerInboxStatus('owner',{requestId,status:'closed'});expect(result.receipt).toMatchObject({committed:null,outcome:'uncertain',retryable:false,nextAction:'read'});expect(f.activity).not.toHaveBeenCalled();
  expect((await readOwnerInbox('owner',{requestId})).request?.status).toBe('closed');expect(result.receipt.committed).toBeNull();
});
it('close/reopen changes only workflow status and preserves delivery history and message content',async()=>{
  const before=structuredClone(f.contacts[0]);
  expect((await saveOwnerInboxStatus('owner',{requestId,status:'closed'})).receipt.committed).toBe(true);
  const reopened=await saveOwnerInboxStatus('owner',{requestId,status:'received'});
  expect(reopened).toMatchObject({status:'received',receipt:{committed:true},snapshot:{resendEmailId:'synthetic-delivery',message:'Untrusted message text'}});expect(f.contacts[0]).toEqual(before);
});
it('missing status target is known 404, not a committed or fabricated update',async()=>{f.contacts=[];await expect(saveOwnerInboxStatus('owner',{requestId,status:'closed'})).rejects.toMatchObject({status:404});expect(f.activity).not.toHaveBeenCalled();});
for(const mode of ['activity_false','activity_reject','readback'] as const)it(`confirmed status survives ${mode} in shared command and browser route`,async()=>{
  if(mode==='activity_false')f.activity.mockResolvedValue(false);if(mode==='activity_reject')f.activity.mockRejectedValue(new Error('audit failed'));if(mode==='readback')f.readFail=true;
  const response=await PATCH(new Request('https://cardforge.test',{method:'PATCH',body:JSON.stringify({status:'closed'})}),{params:Promise.resolve({requestId})});expect(response.status).toBe(200);expect(await response.json()).toMatchObject({requestId,status:'closed',receipt:{committed:true,outcome:'committed',nextAction:'read',warnings:[expect.any(String)]}});expect(f.activity).toHaveBeenCalledOnce();expect(f.queries.filter(calls=>calls.some(call=>call[0]==='update'))).toHaveLength(1);
});
it('lost update ACK stays uncertain; exact read observes state but never proves operation causation',async()=>{
  f.lostAck=true;const response=await PATCH(new Request('https://cardforge.test',{method:'PATCH',body:JSON.stringify({status:'closed'})}),{params:Promise.resolve({requestId})});expect(response.status).toBe(503);expect(await response.json()).toMatchObject({receipt:{committed:null,outcome:'uncertain',retryable:false},error:{retryable:false}});expect(f.activity).not.toHaveBeenCalled();
  expect((await exactInboxGet(new Request('https://cardforge.test'),{params:Promise.resolve({requestId})})).status).toBe(200);expect(f.queries.filter(calls=>calls.some(call=>call[0]==='update'))).toHaveLength(1);
});
for(const input of [{requestId,status:'emailed'},{requestId,status:'email_failed'},{requestId,status:'closed',send:true},{requestId,status:'closed',expectedUpdatedAt:'fake'},{requestId,status:'closed',operationId:'fake'}])it(`rejects unsupported status/action fields ${JSON.stringify(input)}`,async()=>{await expect(saveOwnerInboxStatus('owner',input)).rejects.toMatchObject({status:400});expect(f.queries).toEqual([]);});
it('fresh non-Owner canonical denial precedes private reads and status writes',async()=>{
  f.account.mockResolvedValue({user:{id:'other'},isOwner:false});for(const operation of [()=>readOwnerPeople('other',{}),()=>readOwnerInbox('other',{}),()=>saveOwnerInboxStatus('other',{requestId,status:'closed'})])await expect(operation()).rejects.toMatchObject({status:403});expect(f.clerkList).not.toHaveBeenCalled();expect(f.profiles).not.toHaveBeenCalled();expect(f.queries).toEqual([]);
});
const http=async(id:number,method:string,params:object)=>{const response=await cardForgeOwnerMcpHandler(new Request('https://cardforge.test/mcp/owner',{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id,method,params})}));const text=await response.text();return {status:response.status,body:JSON.parse(text.startsWith('event:')?text.split('data: ')[1].split('\n')[0]:text)};};
it('initialized actual HTTP lists 57 tools and calls exactly the three private Owner adapters',async()=>{
  expect((await http(1,'initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'test',version:'1'}})).body.result.serverInfo.version).toBe('1.17.0');const tools=(await http(2,'tools/list',{})).body.result.tools;expect(tools).toHaveLength(57);const tool=tools.find((entry:{name:string})=>entry.name==='save_owner_inbox_status');expect(tool.inputSchema.properties.status.enum).toEqual(['received','closed']);expect(tool.inputSchema.additionalProperties).toBe(false);expect(tools.some((entry:{name:string})=>/send_owner|delete_owner_person|save_owner_person/.test(entry.name))).toBe(false);
  const person=(await http(3,'tools/call',{name:'get_owner_people',arguments:{userId:'user_exact'}})).body.result.structuredContent.person;expect(person.id).toBe('user_exact');expect(JSON.stringify(person)).not.toContain('never serialize');
  expect((await http(4,'tools/call',{name:'get_owner_inbox',arguments:{requestId}})).body.result.structuredContent.request.id).toBe(requestId);expect((await http(5,'tools/call',{name:'save_owner_inbox_status',arguments:{requestId,status:'closed'}})).body.result.structuredContent.receipt.committed).toBe(true);
});
it('actual endpoint denies non-Owner discovery/call and revoked role without private access',async()=>{
  f.account.mockResolvedValue({user:{id:'other'},isOwner:false});expect((await http(1,'tools/list',{})).status).toBe(403);expect((await http(2,'tools/call',{name:'get_owner_inbox',arguments:{}})).status).toBe(403);f.account.mockResolvedValueOnce({user:{id:'owner'},isOwner:true}).mockResolvedValueOnce({user:{id:'owner'},isOwner:true}).mockResolvedValueOnce({user:{id:'other'},isOwner:false});expect((await http(3,'tools/call',{name:'save_owner_inbox_status',arguments:{requestId,status:'closed'}})).body.result.isError).toBe(true);expect(f.queries).toEqual([]);
});
it('actual HTTP unknown status result is structured non-retryable, never a generic successful write',async()=>{f.lostAck=true;const result=(await http(1,'tools/call',{name:'save_owner_inbox_status',arguments:{requestId,status:'closed'}})).body.result;expect(result.isError).toBe(true);expect(result.structuredContent.receipt).toMatchObject({outcome:'uncertain',committed:null,retryable:false});});
