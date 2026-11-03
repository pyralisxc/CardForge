import { fromJsonSchema, type JsonSchemaType } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import { pipelineSettingsReadInput, pipelineSettingsSaveInput, pipelineSettingsSnapshot, settingsSaveResult, routingReadInput, routingReadOutput, routingSaveInput, routingSaveResult } from '@/features/pipeline/server';
import { getOwnerPipelineProgramSettings, saveOwnerPipelineProgramSettings, getOwnerPipelineStudioRouting, saveOwnerPipelineStudioRouting } from './ownerProgramRoutingCommands';
import type { registerOwnerReadTools } from './mcpOwnerTools';
export function registerOwnerProgramRoutingTools({ server, getAccess, toolError }: Parameters<typeof registerOwnerReadTools>[0]) {
  const tools = [
    { name: 'get_pipeline_program_settings', input: pipelineSettingsReadInput, output: pipelineSettingsSnapshot, write: false, action: getOwnerPipelineProgramSettings, description: 'Owner only. Read canonical Contributor Pipeline rules. configured:false means fallback defaults, not observed persisted configuration. Native policy fixes self-voting enabled and Owner weight 1; publish caps derive from tier caps. Read does not enroll or grant access.' },
    { name: 'save_pipeline_program_settings', input: pipelineSettingsSaveInput, output: settingsSaveResult, write: true, action: saveOwnerPipelineProgramSettings, description: 'Owner only. Save complete editable Pipeline rules through the existing native transaction. CONSEQUENTIAL GLOBAL REBALANCE: existing voting/editorial/lifecycle policy may change status, access, vote-driven Trash and registry publication. Not an inert configuration draft, enrollment or security grant. Native forced self-voting/Owner weight and derived caps remain unchanged. No caller CAS/version/key exists. Zero integer native ACK is valid, never a publication count. Commit survives follow-up failure; unknown ACK requires exact settings readback, no automatic replay or causation inferred from matching state.' },
    { name: 'get_pipeline_studio_routing', input: routingReadInput, output: routingReadOutput, write: false, action: getOwnerPipelineStudioRouting, description: 'Owner only. Read server-paginated Studio Map filters/counts, or exactly one assetId without page filters. Both use the same canonical routing projection and compatibility rules. A missing exact asset is not a sibling or latest substitute. No caller version is provided.' },
    { name: 'save_pipeline_studio_routing', input: routingSaveInput, output: routingSaveResult, write: true, action: saveOwnerPipelineStudioRouting, description: 'Owner only. Save exact registry asset placement through its locked native command. Automatic mode recomputes contract destinations; Owner mode enforces compatibility and empty destinations hide from Studio. Order/featured affect presentation, not content approval/publication or permissions. Native boolean true alone acknowledges commit; no fabricated CAS/key. Follow-up failures retain commit; unknown ACK requires exact asset readback, no automatic replay or causal inference from matching state.' },
  ] as const;
  for (const tool of tools) server.registerTool(tool.name, { description: tool.description,
    inputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(tool.input, { io: 'input' }) as JsonSchemaType), outputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(tool.output) as JsonSchemaType),
    annotations: { readOnlyHint: false, destructiveHint: tool.write, openWorldHint: false },
  }, async input => { try { const access = await getAccess(); return await observeMcpToolExecution({ ownerUserId: access.user.id, toolName: tool.name, input, execute: async () => {
    const raw = await tool.action(access.user.id, input), result = tool.output.parse('program' in raw ? { snapshot: raw.snapshot, receipt: raw.receipt } : raw);
    return { ...('receipt' in result && result.receipt.outcome === 'uncertain' ? { isError: true } : {}), content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
  } }); } catch (error) { return toolError(error); } });
}
