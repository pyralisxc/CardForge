import { beforeEach, describe, expect, it, vi } from 'vitest';
const provider = vi.hoisted(() => ({ list: vi.fn(), read: vi.fn(), summary: vi.fn(), write: vi.fn(), create: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/features/project/server', async importOriginal => ({...await importOriginal<object>(),listGoogleDriveProjects:provider.list,getGoogleDriveProject:provider.read,getGoogleDriveProjectSummary:provider.summary,updateGoogleDriveProjectFromServer:provider.write}));
vi.mock('@/features/studio-documents/server/mcpStudioAccess', () => {
 const access=async()=>({user:{id:'synthetic-owner'},entitlement:{isSignedIn:true,accountUserId:'synthetic-owner'}});
 return {getMcpStudioAccess:access,getMcpStudioReadAccess:access};
});
vi.mock('@/features/mcp-usage/server', () => ({observeMcpToolExecution:async({execute}:{execute:()=>Promise<unknown>})=>execute()}));
vi.mock('@/features/studio-documents/server/studioDocumentStore', async importOriginal => ({...await importOriginal<object>(),createStudioDocument:provider.create}));
import { buildCardForgeProjectSnapshot, encodeCardForgeProjectPackage, decodeCardForgeProjectPackage, hydrateCardForgeProjectSnapshot } from '@/features/project/lib/projectPackageCodec';
import type { ProjectDocumentV1 } from '@/features/project/model/projectDocument';
import { cardForgeMcpHandler } from '@/features/studio-documents/server/mcpServer';

const project = {provider:'google-drive',accountId:'synthetic-account',fileId:'synthetic-file',workId:'synthetic-work',name:'Synthetic.cardforge',providerRevision:'head:'+'a'.repeat(64),projectRevision:'b'.repeat(64),modifiedAt:'2026-10-30T00:00:00Z',size:123,webViewLink:null,thumbnailLink:null,driveId:null,resourceKey:null,capabilities:{canDownload:true,canEdit:true,canModifyContent:true,canTrash:true,canDelete:false}};
const connection = {provider:'google-drive',configured:true,connected:true,displayName:'Synthetic Drive',rootFolderId:'synthetic-folder',status:'active',statusNote:null,lastVerifiedAt:null};
const call = async (name='list_connected_projects',args:object={}) => {
  const response=await cardForgeMcpHandler(new Request('https://cardforge.test/mcp',{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}));
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


describe('legacy Drive metadata real MCP transport',()=>{
 beforeEach(()=>vi.clearAllMocks());
 it('returns a decoded full source pin without a checkout, writes or changes to package bytes',async()=>{
  const document:ProjectDocumentV1={version:1,userTemplates:[],cardSets:[{id:'legacy-set',name:'Legacy'}],storedCards:[],appearanceStyles:[],exportSettings:{},customAssets:{'cardforge-maker-custom-textures':[],'cardforge-maker-custom-dividers':[],'cardforge-maker-custom-icons':[],'cardforge-maker-custom-images':[]}};
  const snapshot=await buildCardForgeProjectSnapshot({document,name:'Legacy',savedAt:'2026-10-30T00:00:00Z'});const bytes=await encodeCardForgeProjectPackage(snapshot);const before=Buffer.from(bytes);
  const source={kind:'google-drive',projectId:project.fileId,expectedProviderRevision:project.providerRevision};
  provider.read.mockImplementation(async()=>({summary:{...project,projectRevision:snapshot.manifest.projectRevision},bytes,document:hydrateCardForgeProjectSnapshot(await decodeCardForgeProjectPackage(bytes))}));
  provider.summary.mockResolvedValue({...project,projectRevision:null});
  const result=await call('inspect_saved_source',{source});expect(result.error).toBeUndefined();expect(result.result.isError).not.toBe(true);
  expect(result.result.structuredContent).toMatchObject({source:{...source,expectedProjectRevision:snapshot.manifest.projectRevision},identity:{projectId:project.fileId,providerRevision:project.providerRevision,projectRevision:snapshot.manifest.projectRevision},sourceIntegrity:{kind:'version-bound-package'},availableSelections:[{setId:'legacy-set',totalCards:0,cardIds:[]}]});
  expect(result.result.content[0].text).toContain('Resolved the exact saved package metadata');expect(provider.read).toHaveBeenCalledWith({ownerUserId:'synthetic-owner',fileId:project.fileId,expectedProviderRevision:project.providerRevision});expect(provider.write).not.toHaveBeenCalled();expect(provider.create).not.toHaveBeenCalled();expect(Buffer.from(bytes)).toEqual(before);
  const resolved=result.result.structuredContent.source;provider.summary.mockResolvedValue({...project,providerRevision:'head:'+'c'.repeat(64),projectRevision:null});
  const changed=await call('inspect_saved_source',{source:resolved});expect(changed.result.isError).toBe(true);expect(JSON.stringify(changed.result)).toContain('changed during inspection');
 });
 it.each(['inspect_saved_source','preview_saved_source','export_saved_source'])('does not let %s select or render an unpinned package',async name=>{
  const source={kind:'google-drive',projectId:project.fileId,expectedProviderRevision:project.providerRevision,setId:'legacy-set',cardIds:['card']};
  const result=await call(name,{source,...(name==='inspect_saved_source'?{}:{sourceVersion:'a'.repeat(64),operation:'preview'})});expect(Boolean(result.error||result.result?.isError)).toBe(true);expect(provider.read).not.toHaveBeenCalled();expect(provider.write).not.toHaveBeenCalled();expect(provider.create).not.toHaveBeenCalled();
 });
});
