import { beforeEach, expect, it, vi } from 'vitest';
import type { TCGCardTemplate } from '@/domain/templates';
const f=vi.hoisted(()=>({create:vi.fn(),read:vi.fn(),downloads:vi.fn(),access:vi.fn(),require:vi.fn()}));
vi.mock('@/features/pipeline/server',async()=>({
  contributorTemplateRevisionBase:(await import('@/features/pipeline/lib/contributorDraftContract')).contributorTemplateRevisionBase,
  assertTemplatePipelineDraftContext:(await import('@/features/pipeline/lib/pipelineRegistryCommands')).assertTemplatePipelineDraftContext,
  createNewSharedTemplateId:()=> 'fresh-shared-id', createTemplatePipelineDraft:f.create, readTemplatePipelineDraftAttempt:vi.fn(),
  isRepositoryTemplate:(value:TCGCardTemplate)=>Boolean(value.id && value.freeformCanvas),
  PipelineRegistryCommandError:(await import('@/features/pipeline/lib/pipelineRegistryCommandsError')).PipelineRegistryCommandError,
}));
vi.mock('@/features/contributor-access/server',async()=>({requireContributionScope:f.require,getCurrentContributorAccess:f.access,
 ContributorAccessError:(await import('@/features/contributor-access/server/access')).ContributorAccessError}));
vi.mock('@/features/studio-documents/server/studioDocumentStore',()=>({getStudioDocument:f.read}));
vi.mock('@/features/studio-documents/server/studioDocumentAccess',()=>({getStudioDocumentRetentionHours:async()=>24}));
vi.mock('@/features/studio-documents/server/studioDocumentAssetStore',()=>({getStudioDocumentAssetDownloads:f.downloads}));
vi.mock('@/infrastructure/security/abuseProtection',()=>({consumeRateLimit:async()=>({allowed:true}),RateLimitUnavailableError:class extends Error {}}));
import { POST } from '@/app/api/templates/submissions/route';
import { submitTemplateWorkingDocumentToPipeline } from '@/features/studio-documents/server/templateWorkingDocuments';
import { pipelineInputSchema } from '@/features/studio-documents/server/mcpToolInputSchemas';
const template:TCGCardTemplate={id:'personal-renamed',name:'Renamed personal Template',aspectRatio:'63:88',templateSource:'user',freeformCanvas:{width:630,height:880,elements:[]}};
const base={parentSubmissionId:'11111111-1111-4111-8111-111111111111',assetId:'original-shared-id',reviewedAt:'2026-11-26T12:00:00Z',parentContentVersion:'a'.repeat(32)};
const access={user:{id:'actor'},email:'actor@example.invalid',entitlement:{}} as Parameters<typeof submitTemplateWorkingDocumentToPipeline>[0]['access'];
const document={id:'22222222-2222-4222-8222-222222222222',revision:3,document:{userTemplates:[template]}};
beforeEach(()=>{vi.clearAllMocks();f.access.mockResolvedValue(access);f.read.mockResolvedValue(document);f.downloads.mockResolvedValue([]);f.create.mockResolvedValue({id:'new-draft'});});
it('browser handoff carries exact reviewed base without changing the private Template',async()=>{
 const before=structuredClone(template);
 const response=await POST(new Request('https://example.invalid/api/templates/submissions',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'exact-attempt'},body:JSON.stringify({...template,revisionBase:base})}));
 expect(response.status).toBe(201);expect(f.create).toHaveBeenCalledWith(expect.objectContaining({contributorId:'actor',submissionKey:'exact-attempt',revisionBase:base,template:expect.objectContaining({id:base.assetId,name:template.name})}));
 expect(f.create.mock.calls[0][0].template).not.toHaveProperty('revisionBase');expect(template).toEqual(before);
});
it('Studio handoff uses the same exact base and a stable attempt for the same document revision',async()=>{
 const args={access,documentId:document.id,revisionBase:base};await submitTemplateWorkingDocumentToPipeline(args);await submitTemplateWorkingDocumentToPipeline(args);
 expect(f.create.mock.calls[0][0]).toMatchObject({revisionBase:base,template:{id:base.assetId},contributorId:'actor'});
 expect(f.create.mock.calls[0][0].submissionKey).toBe(f.create.mock.calls[1][0].submissionKey);
 const validate=(pipelineInputSchema as unknown as {'~standard':{validate:(v:unknown)=>Promise<{issues?:unknown}>}})['~standard'].validate;
 expect((await validate({documentId:document.id,revisionBase:base})).issues).toBeUndefined();
 expect((await validate({documentId:document.id,revisionBase:{...base,actorId:'spoof'}})).issues).toBeDefined();
});
