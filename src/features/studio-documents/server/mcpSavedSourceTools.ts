import { createMcpHandler } from 'mcp-handler';
import { fromJsonSchema, type JsonSchemaType } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { getPublishedRegistryRows } from '@/features/pipeline/server';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import { createRenderArtifactDownload } from '@/features/render-artifacts/server';
import type { StudioAgentAccess } from './studioAgentAccess';
import { savedSourceSelectionSchema, sourceRenderRequestSchema, type SavedSourceSelection, type SourceRenderRequest } from '../sourcePreview';
import { readSavedSourcePreview } from './savedSourcePreview';
import { renderSavedSource } from './savedSourceArtifacts';
import { createRenderArtifactPreviewResult, renderArtifactStructuredContent } from './mcpRenderArtifactResults';

const output = (properties: Record<string, unknown>, required: string[]) => fromJsonSchema({type:'object',properties,required,additionalProperties:false} as JsonSchemaType);
const identity = {type:'object',additionalProperties:{type:['string','number','null']}};
const sourceProperty = z.toJSONSchema(savedSourceSelectionSchema);
const arbitraryObject = {type:'object',additionalProperties:true};

type Server = Parameters<Parameters<typeof createMcpHandler>[0]>[0];
export function registerSavedSourceTools({ server, publicOrigin, getAccess, toolError }: { server: Server; publicOrigin: string; getAccess: () => Promise<StudioAgentAccess>; toolError: (error: unknown) => { isError: boolean; content: Array<{type:'text';text:string}> } }) {
  const run = async <T>(name: string, input: unknown, execute: (access: StudioAgentAccess) => Promise<T>) => {
    try { const access = await getAccess(); return await observeMcpToolExecution({ ownerUserId: access.user.id, toolName: name, input, execute: () => execute(access) }); }
    catch (error) { return toolError(error); }
  };
  server.registerTool('discover_pipeline_previews', {
    title: 'Find exact published Pipeline preview identities',
    outputSchema: output({items:{type:'array',items:arbitraryObject}},['items']),
    description: 'Current accessible publications only, using native scoped catalog discovery. Returns immutable submission/lineage and current publication metadata, never name-based source substitution.',
    inputSchema: fromJsonSchema<{query?:string;limit?:number}>({ type:'object', additionalProperties:false, properties:{query:{type:'string',maxLength:200},limit:{type:'integer',minimum:1,maximum:50}} }),
    annotations: {readOnlyHint:false,destructiveHint:false,openWorldHint:false},
  }, async input => run('discover_pipeline_previews', input, async access => {
    const rows = await getPublishedRegistryRows(access.entitlement.accessMode);
    const items = rows.filter(row => row.contributor_submission_id && row.lineage_id && row.name.toLowerCase().includes((input.query ?? '').toLowerCase())).slice(0,input.limit ?? 20).map(row => ({
      name:row.name,assetType:row.asset_type,publicationUpdatedAt:row.updated_at,
      source:{kind:'pipeline',assetId:row.asset_id,submissionId:row.contributor_submission_id,lineageId:row.lineage_id,selection:'current'},
    }));
    return {content:[{type:'text' as const,text:`Found ${items.length} exact accessible publications.`}],structuredContent:{items}};
  }));
  server.registerTool('inspect_saved_source', {
    title:'Inspect exact Pipeline or saved Drive source',
    outputSchema: output({title:{type:'string'},source:sourceProperty,sourceVersion:{type:'string'},identity,specimen:{type:'string'},availableSelections:{type:'array',items:arbitraryObject}},['title','source','sourceVersion','identity','specimen']),
    description:'Read exact source identity and supported native specimen without checkout or provider writes. Drive requires exact provider/project revision and selected Set/card ids. Historical Pipeline never substitutes the latest publication. Pending Templates require Owner and the existing exact candidate identity/base/hash contract.',
    inputSchema:fromJsonSchema<{source:SavedSourceSelection}>(z.toJSONSchema(z.object({source:savedSourceSelectionSchema}).strict()) as JsonSchemaType),
    annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false},
  }, async input => run('inspect_saved_source',input, async access => {
    const result = await readSavedSourcePreview(access,input.source);
    return { content:[{type:'text' as const,text:result.content.kind==='unsupported'?result.content.reason:`Exact ${result.title} is available for native inspection.`}],structuredContent:{title:result.title,source:input.source,sourceVersion:result.sourceVersion,identity:result.identity,specimen:result.content.kind,availableSelections:result.availableSelections} };
  }));
  for (const operation of ['preview','export'] as const) server.registerTool(`${operation}_saved_source`, {
    outputSchema: output({source:sourceProperty,sourceVersion:{type:'string'},identity,branded:{type:'boolean'},renderArtifacts:{type:'array',items:arbitraryObject},downloads:{type:'array',items:arbitraryObject},displayImages:{type:'array',items:arbitraryObject},openInCardForgeUrl:{type:'string'}},['source','sourceVersion','identity','branded','renderArtifacts','downloads','displayImages','openInCardForgeUrl']),
    title:operation==='preview'?'Show a branded exact source in chat':'Export an exact source with current entitlement',
    description:operation==='preview'?'Canonical compact chat image, visibly branded at every tier, with an exact CardForge link. Does not create an editable copy or modify portable bytes.':'Explicit PNG export. Rechecks current source access and canExportClean before cache access/delivery. clean-export denies without current entitlement; ordinary export is watermarked for Free. Full canonical download links expire after 60 seconds; display reduction never changes original package bytes.',
    inputSchema:fromJsonSchema<SourceRenderRequest>(z.toJSONSchema(sourceRenderRequestSchema) as JsonSchemaType),
    annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false},
  }, async input => run(`${operation}_saved_source`,input, async access => {
    const request = {...input,operation:operation==='preview'?'preview' as const:input.operation==='clean-export'?'clean-export' as const:'export' as const};
    const result = await renderSavedSource({actorUserId:access.user.id,request,publicOrigin});
    const downloads = operation==='export' ? await Promise.all(result.artifacts.map(async artifact => ({artifactId:artifact.artifactId,url:await createRenderArtifactDownload({ownerUserId:access.user.id,artifact}),expiresInSeconds:60}))) : [];
    return createRenderArtifactPreviewResult({ artifacts:result.artifacts,text:`${result.snapshot.title} · ${result.branded?'CardForge branded':'clean entitled export'} · exact selected source.`, structuredContent:{source:input.source,sourceVersion:result.snapshot.sourceVersion,identity:result.snapshot.identity,branded:result.branded,renderArtifacts:result.artifacts.map(renderArtifactStructuredContent),downloads,openInCardForgeUrl:result.openInCardForgeUrl} });
  }));
}
