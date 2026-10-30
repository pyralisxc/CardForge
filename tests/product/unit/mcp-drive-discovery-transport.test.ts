import { describe, expect, it, vi } from 'vitest';
const provider = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/features/project/server', async importOriginal => ({...await importOriginal<object>(),listGoogleDriveProjects:provider.list}));
vi.mock('@/features/studio-documents/server/mcpStudioAccess', () => ({getMcpStudioAccess:async()=>({user:{id:'synthetic-owner'},entitlement:{isSignedIn:true,accountUserId:'synthetic-owner'}})}));
vi.mock('@/features/mcp-usage/server', () => ({observeMcpToolExecution:async({execute}:{execute:()=>Promise<unknown>})=>execute()}));
import { cardForgeMcpHandler } from '@/features/studio-documents/server/mcpServer';

const project = {provider:'google-drive',accountId:'synthetic-account',fileId:'synthetic-file',workId:'synthetic-work',name:'Synthetic.cardforge',providerRevision:'head:'+'a'.repeat(64),projectRevision:'b'.repeat(64),modifiedAt:'2026-10-30T00:00:00Z',size:123,webViewLink:null,thumbnailLink:null,driveId:null,resourceKey:null,capabilities:{canDownload:true,canEdit:true,canModifyContent:true,canTrash:true,canDelete:false}};
const connection = {provider:'google-drive',configured:true,connected:true,displayName:'Synthetic Drive',rootFolderId:'synthetic-folder',status:'active',statusNote:null,lastVerifiedAt:null};
const call = async () => {
  const response=await cardForgeMcpHandler(new Request('https://cardforge.test/mcp',{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'list_connected_projects',arguments:{}}})}));
  expect(response.status).toBe(200);
  const body=await response.text();
  return JSON.parse(body.split('\n').find(line=>line.startsWith('data: '))!.slice(6));
};
describe('Drive discovery real MCP output validation',()=>{
  it('retains the current provider summary and complete-list cursor through transport',async()=>{
    provider.list.mockResolvedValue({connection,projects:[project,{...project,fileId:'shared-file',driveId:'shared-drive',resourceKey:'synthetic-resource-key'}],nextPageToken:null});
    const result=await call();
    expect(result.error).toBeUndefined();
    expect(result.result.isError).not.toBe(true);
    expect(result.result.structuredContent).toMatchObject({connection,projects:[project,{...project,fileId:'shared-file',driveId:'shared-drive',resourceKey:'synthetic-resource-key'}],nextPageToken:null});
    expect(provider.list).toHaveBeenCalledWith('synthetic-owner');
  });
  it('still rejects arbitrary provider additions rather than relaxing object schemas',async()=>{
    provider.list.mockResolvedValue({connection,projects:[{...project,unexpectedAuthority:true}],nextPageToken:null});
    const result=await call();
    expect(Boolean(result.error || result.result?.isError)).toBe(true);
  });
});
