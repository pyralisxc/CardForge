import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TCGCardTemplate } from '@/domain/templates';
const boundary = vi.hoisted(() => ({ receipt: vi.fn(), create: vi.fn(), read: vi.fn(), downloads: vi.fn(), require: vi.fn(), verify: vi.fn(), access: vi.fn() }));
vi.mock('@/features/pipeline/server', async () => ({
  assertTemplatePipelineDraftContext: (await import('@/features/pipeline/lib/pipelineRegistryCommands')).assertTemplatePipelineDraftContext,
  readTemplatePipelineDraftAttempt: boundary.receipt,
  createNewSharedTemplateId: () => 'shared-template', createTemplatePipelineDraft: boundary.create,
  isRepositoryTemplate: (t: TCGCardTemplate) => Boolean(t.id && t.freeformCanvas),
  verifySelectedPublishedManagedRaster: boundary.verify,
  PipelineRegistryCommandError: (await import('@/features/pipeline/lib/pipelineRegistryCommandsError')).PipelineRegistryCommandError,
}));
vi.mock('@/features/contributor-access/server', async () => ({ requireContributionScope: boundary.require, getCurrentContributorAccess: boundary.access,
  ContributorAccessError: (await import('@/features/contributor-access/server/access')).ContributorAccessError }));
vi.mock('@/features/studio-documents/server/studioDocumentStore', () => ({ getStudioDocument: boundary.read }));
vi.mock('@/features/studio-documents/server/studioDocumentAccess', () => ({ getStudioDocumentRetentionHours: async () => 24 }));
vi.mock('@/features/studio-documents/server/studioDocumentAssetStore', () => ({ getStudioDocumentAssetDownloads: boundary.downloads }));
vi.mock('@/features/account/server', () => ({ getCurrentCardforgeEntitlement: vi.fn() }));
vi.mock('@/features/pipeline/server/catalogCache', () => ({ getCachedCardForgeCatalog: vi.fn() }));
import { submitTemplateWorkingDocumentToPipeline } from '@/features/studio-documents/server/templateWorkingDocuments';
import { pipelineInputSchema } from '@/features/studio-documents/server/mcpToolInputSchemas';
import { GET } from '@/app/api/assets/route';
import { POST } from '@/app/api/templates/submissions/route';
vi.mock('@/infrastructure/security/abuseProtection', () => ({ consumeRateLimit: async () => ({allowed:true}), RateLimitUnavailableError: class extends Error {} }));
import { PipelineRegistryCommandError } from '@/features/pipeline/lib/pipelineRegistryCommandsError';
import { managedRasterSlotIssue, canUseDefaultAsFixedPicture } from '@/features/pipeline/lib/managedRasterSelection';
const selection = { registryAssetId: 'managed-image', publishedSubmissionId: '11111111-1111-4111-8111-111111111111', elementId: 'art' };
const template: TCGCardTemplate = { id: 'local-template', name: 'Synthetic', aspectRatio: '63:88', templateSource: 'user', freeformCanvas: { width: 630, height: 880, elements: [{id:'art', name:'Art', type:'image', x:0,y:0,width:100,height:100,zIndex:0,imageSource:''}] } };
let document: { id: string; revision: number; document: { userTemplates: TCGCardTemplate[] } };
const access = {user:{id:'actor'},email:'actor@example.invalid',entitlement:{}} as Parameters<typeof submitTemplateWorkingDocumentToPipeline>[0]['access'];
beforeEach(() => {
  vi.clearAllMocks(); document = {id:'22222222-2222-4222-8222-222222222222',revision:1,document:{userTemplates:[structuredClone(template)]}};
  boundary.read.mockImplementation(async () => document); boundary.downloads.mockResolvedValue([]);
  boundary.create.mockResolvedValue({id:'draft'}); boundary.access.mockResolvedValue(access); boundary.verify.mockResolvedValue({sourcePath:'private',originalSha256:'secret-internal'});
});
describe('managed raster authoring handoff', () => {
  it('carries only exact intent through the actual MCP command, leaves the Studio payload unchanged and binds retries to source/slot/document', async () => {
    const before = structuredClone(document);
    const args = {access,documentId:document.id,managedRasterSelection:selection};
    await submitTemplateWorkingDocumentToPipeline(args); await submitTemplateWorkingDocumentToPipeline(args);
    const first = boundary.create.mock.calls[0][0];
    expect(first.managedRasterSelection).toEqual(selection);
    expect(first.template).not.toHaveProperty('managedRasterSelection'); expect(document).toEqual(before);
    expect(boundary.create.mock.calls[1][0].submissionKey).toBe(first.submissionKey);
    for (const changed of [{...selection,registryAssetId:'other'}, {...selection,elementId:'other'}, {...selection,publishedSubmissionId:'33333333-3333-4333-8333-333333333333'}]) {
      await submitTemplateWorkingDocumentToPipeline({...args,managedRasterSelection:changed});
      expect(boundary.create.mock.lastCall![0].submissionKey).not.toBe(first.submissionKey);
    }
    await submitTemplateWorkingDocumentToPipeline({...args,managedRasterSelection:{elementId:selection.elementId,publishedSubmissionId:selection.publishedSubmissionId,registryAssetId:selection.registryAssetId}});
    expect(boundary.create.mock.lastCall![0].submissionKey).toBe(first.submissionKey);
    document.revision++;
    await submitTemplateWorkingDocumentToPipeline(args); expect(boundary.create.mock.lastCall![0].submissionKey).not.toBe(first.submissionKey);
  });
  it('preserves server conflicts and does not convert stale source failures to successful handoff', async () => {
    boundary.create.mockRejectedValue(new PipelineRegistryCommandError('Source changed',409));
    await expect(submitTemplateWorkingDocumentToPipeline({access,documentId:document.id,managedRasterSelection:selection})).rejects.toMatchObject({status:409});
  });
  it('strict MCP schema rejects caller evidence and paths', async () => {
    const validate = (pipelineInputSchema as unknown as {'~standard':{validate:(v:unknown)=>Promise<{issues?:unknown}>}})['~standard'].validate;
    expect((await validate({documentId:document.id,managedRasterSelection:selection})).issues).toBeUndefined();
    expect((await validate({documentId:document.id,managedRasterSelection:{...selection,digest:'spoof'}})).issues).toBeDefined();
  });
  it('rejects dynamic effective slots without altering the contract or preview', () => {
    expect(managedRasterSlotIssue(template,'art')).toBeNull();
    for (const changed of [{...template,templatePreviewData:{art:'override'}}, {...template,fieldContracts:[{key:'art',elementId:'art',type:'image' as const,required:false}]}, {...template,freeformCanvas:{...template.freeformCanvas!,elements:[{...template.freeformCanvas!.elements[0],content:'override'}]}}]) {
      const before=structuredClone(changed); expect(managedRasterSlotIssue(changed,'art')).not.toBeNull(); expect(changed).toEqual(before);
    }
  });
  it('rejects a saved exact-base Review draft in HTTP and MCP before any asset materialization or draft command', async () => {
    const review = {...template,templatePipelineContext:{expectedBase:{assetId:'published-base'}}} as TCGCardTemplate;
    document.document.userTemplates=[review];
    const response=await POST(new Request('https://example.invalid/api/templates/submissions',{method:'POST',headers:{'Idempotency-Key':'review-attempt'},body:JSON.stringify({...review,managedRasterSelection:selection})}));
    expect(response.status).toBe(409);expect((await response.json()).error.code).toBe('managed_raster_review_unsupported');
    await expect(submitTemplateWorkingDocumentToPipeline({access,documentId:document.id,managedRasterSelection:selection})).rejects.toMatchObject({status:409,code:'managed_raster_review_unsupported'});
    expect(boundary.downloads).not.toHaveBeenCalled();expect(boundary.create).not.toHaveBeenCalled();
  });
  it('exposes permanent ordinary-only eligibility distinctly from temporary read unavailability', async () => {
    boundary.verify.mockRejectedValue(new PipelineRegistryCommandError('No verified original upload digest. Ordinary picture only.',409,'managed_raster_ineligible'));
    const response=await GET(new Request(`https://example.invalid/api/assets?${new URLSearchParams(selection)}`));
    expect(response.status).toBe(409);expect((await response.json()).error).toMatchObject({code:'managed_raster_ineligible',retryable:false});
  });
  it('reads the exact historical snapshot without creating or materializing and fences a changed account', async () => {
    boundary.receipt.mockResolvedValue('original-draft');
    const request = (actor = 'actor') => new Request('https://example.invalid/api/templates/submissions?lookup=1', {
      method:'POST',headers:{'Idempotency-Key':'original-attempt','X-Pipeline-Contributor':actor},
      body:JSON.stringify({...template,managedRasterSelection:selection}),
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).openInPipelineUrl).toContain('submission=original-draft');
    expect(boundary.receipt).toHaveBeenCalledWith(expect.objectContaining({contributorId:'actor',submissionKey:'original-attempt',managedRasterSelection:selection}));
    expect(boundary.create).not.toHaveBeenCalled(); expect(boundary.downloads).not.toHaveBeenCalled();
    expect((await POST(request('another-actor'))).status).toBe(409);
    expect(boundary.receipt).toHaveBeenCalledTimes(1);
    boundary.receipt.mockResolvedValue(null);
    expect(await (await POST(request())).json()).toEqual({openInPipelineUrl:null});
    boundary.receipt.mockRejectedValue(new PipelineRegistryCommandError('Uncertain',503));
    expect((await POST(request())).status).toBe(503);
  });
  it('browser HTTP handoff carries selection separately from the authored Template and rejects caller authority', async () => {
    const send = (pins: unknown) => POST(new Request('https://example.invalid/api/templates/submissions', {method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'synthetic-attempt'},body:JSON.stringify({...template,managedRasterSelection:pins})}));
    const response=await send(selection); expect(response.status).toBe(201);
    expect(boundary.create.mock.lastCall![0].managedRasterSelection).toEqual(selection);
    expect(boundary.create.mock.lastCall![0].template).not.toHaveProperty('managedRasterSelection');
    expect((await send({...selection,sourcePath:'spoof'})).status).toBe(400);
  });
  it('source observation authenticates and returns pins only, never paths or digests', async () => {
    const response = await GET(new Request(`https://example.invalid/api/assets?${new URLSearchParams(selection)}`));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({state:'ready',selection});
    expect(boundary.require).toHaveBeenCalledWith(access,'library.submit'); expect(boundary.verify).toHaveBeenCalledWith(selection);
  });
  it.each([409,503])('preserves source conflict versus unavailable (%s)', async status => {
    boundary.verify.mockRejectedValue(new PipelineRegistryCommandError('Source cannot be checked',status));
    const response = await GET(new Request(`https://example.invalid/api/assets?${new URLSearchParams(selection)}`));
    expect(response.status).toBe(status);
    expect((await response.json()).error.code).toBe(status === 409 ? 'managed_raster_conflict' : 'pipeline_unavailable');
  });
});

describe('explicit default-picture conversion eligibility',()=>{
  const fresh={...template,freeformCanvas:{...template.freeformCanvas!,elements:[{...template.freeformCanvas!.elements[0],imageSource:'artworkUrl',content:'artworkUrl'}]}};
  it('offers only the untouched placeholder, without mutating geometry or content',()=>{
    const before=structuredClone(fresh);
    expect(canUseDefaultAsFixedPicture(fresh,'art')).toBe(true);
    expect(fresh).toEqual(before);
  });
  it('refuses real content, contracts, preview overrides, missing and ambiguous slots',()=>{
    expect(canUseDefaultAsFixedPicture({...fresh,fieldContracts:[{key:'art',type:'image',elementId:'art'}]},'art')).toBe(false);
    expect(canUseDefaultAsFixedPicture({...fresh,templatePreviewData:{art:'value'}},'art')).toBe(false);
    for(const imageSource of ['https://example.invalid/a.png','data:image/png;base64,YQ==','otherField','']) {
      expect(canUseDefaultAsFixedPicture({...fresh,freeformCanvas:{...fresh.freeformCanvas,elements:[{...fresh.freeformCanvas.elements[0],imageSource}]}},'art')).toBe(false);
    }
    expect(canUseDefaultAsFixedPicture(fresh,'other')).toBe(false);
    expect(canUseDefaultAsFixedPicture({...fresh,freeformCanvas:{...fresh.freeformCanvas,elements:[...fresh.freeformCanvas.elements,...fresh.freeformCanvas.elements]}},'art')).toBe(false);
  });
});
