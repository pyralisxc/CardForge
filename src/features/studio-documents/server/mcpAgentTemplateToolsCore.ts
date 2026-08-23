import { createMcpHandler } from 'mcp-handler';

import type { DeveloperCockpitAccess } from '@/features/developer-access/server';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import { summarizeProjectProductionAssets } from '@/features/project/server';
import {
  attachDeveloperTemplateDraftAsset,
  getDeveloperTemplateDraft,
} from './developerTemplateDrafts';
import { ensureTemplatePreviewArtifact } from './studioRenderArtifacts';
import { renderArtifactImageContent, renderArtifactStructuredContent } from './mcpRenderArtifactResults';
import {
  attachTemplateAssetInputSchema,
  previewTemplateDraftInputSchema,
} from './agentTemplateToolSchemas';
import {
  templateArtworkOutputSchema,
  templatePreviewOutputSchema,
} from './mcpToolOutputSchemas';


type RegistrationCallback = Parameters<typeof createMcpHandler>[0];
type McpRegistrationServer = Parameters<RegistrationCallback>[0];
type ToolErrorResult = {
  isError: boolean;
  content: Array<{ type: 'text'; text: string }>;
  _meta?: Record<string, unknown>;
};

type DeveloperTemplateDraft = Awaited<ReturnType<typeof getDeveloperTemplateDraft>>;

const productionStatus = (document: DeveloperTemplateDraft) => {
  const plan = document.document.productionPlan;
  if (!plan) {
    return {
      productionReady: false,
      assetSummary: null,
      remainingAssetRequirementIds: [] as string[],
    };
  }
  const assetSummary = summarizeProjectProductionAssets(plan);
  const remainingAssetRequirementIds = plan.assets
    .filter((asset) => asset.status !== 'selected')
    .map((asset) => asset.id);
  return {
    productionReady: assetSummary.neededInstances === 0 && assetSummary.placeholderInstances === 0,
    assetSummary,
    remainingAssetRequirementIds,
  };
};

const imageSourceState = (source: string | undefined) => {
  if (!source) return 'empty' as const;
  if (source === 'artworkUrl') return 'placeholder' as const;
  if (source.startsWith('data:') || source.startsWith('cardforge-studio-asset://')) return 'embedded' as const;
  if (source.startsWith('embedded://')) return 'embedded-reference' as const;
  return 'configured' as const;
};

const compositionDiagnostics = (document: DeveloperTemplateDraft) => {
  const template = document.document.userTemplates[0];
  const elements = template?.freeformCanvas?.elements ?? [];
  const plan = document.document.productionPlan;
  const imageElements = elements
    .filter((element) => element.type === 'image')
    .map((element) => ({
      id: element.id,
      name: element.name,
      sourceState: imageSourceState(element.imageSource),
    }));
  const imageElementById = new Map(imageElements.map((element) => [element.id, element]));
  const assetBindings = (plan?.assets ?? []).map((asset) => ({
    id: asset.id,
    role: asset.role,
    kind: asset.kind,
    status: asset.status,
    binding: asset.binding ?? null,
    targetElementIds: asset.targetElementIds ?? [],
  }));
  const borderedTextElementIds = elements
    .filter((element) => {
      if (element.type !== 'text') return false;
      const utilityBorder = element.borderWidth
        && !['_none_', 'none', 'border-0'].includes(element.borderWidth);
      const appearanceBorder = element.appearance?.border?.kind
        && element.appearance.border.kind !== 'none'
        && (element.appearance.border.width ?? 1) > 0;
      return Boolean(utilityBorder || appearanceBorder);
    })
    .map((element) => element.id);
  const warnings: string[] = [];

  for (const asset of plan?.assets ?? []) {
    if (asset.binding !== 'element.image') continue;
    const targets = asset.targetElementIds ?? [];
    if (targets.length === 0) {
      warnings.push(`Asset ${asset.id} uses element.image but does not target an image element.`);
      continue;
    }
    for (const targetId of targets) {
      const target = imageElementById.get(targetId);
      if (!target) {
        warnings.push(`Asset ${asset.id} targets ${targetId}, which is not a native image element.`);
        continue;
      }
      if (asset.status === 'selected' && ['empty', 'placeholder'].includes(target.sourceState)) {
        warnings.push(`Asset ${asset.id} is selected but image element ${targetId} still has ${target.sourceState} artwork.`);
      }
    }
  }

  return {
    assetBindings,
    imageElements,
    borderedTextElementIds,
    warnings,
  };
};

export const registerAgentTemplateTools = ({
  server,
  publicOrigin,
  getAccess,
  toolError,
}: {
  server: McpRegistrationServer;
  publicOrigin: string;
  getAccess: () => Promise<DeveloperCockpitAccess>;
  toolError: (error: unknown) => ToolErrorResult;
}) => {
  const runObserved = async <Result>({
    toolName,
    input,
    execute,
  }: {
    toolName: string;
    input: unknown;
    execute: (access: DeveloperCockpitAccess) => Promise<Result>;
  }): Promise<Result | ToolErrorResult> => {
    try {
      const access = await getAccess();
      return await observeMcpToolExecution({
        ownerUserId: access.user.id,
        toolName,
        input,
        execute: async () => execute(access),
      });
    } catch (error) {
      return toolError(error);
    }
  };


  server.registerTool(
    'attach_template_artwork',
    {
      title: 'Attach generated artwork to a CardForge Template draft',
      description: 'Attach one generated, user-provided, or CardForge-output PNG/JPEG/WebP to one planned artwork requirement. CardForge validates and normalizes it, embeds it into the Template itself, advances the same Studio document revision, and reports the exact native binding and target element ids. Preview after attaching to verify the intended visible slot.',
      inputSchema: attachTemplateAssetInputSchema,
      outputSchema: templateArtworkOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({ documentId, expectedRevision, assetRequirementId, binding, mimeType, data }) => {
      return runObserved({
        toolName: 'attach_template_artwork',
        input: { documentId, expectedRevision, assetRequirementId, binding, mimeType, data },
        execute: async (access) => {
        const document = await attachDeveloperTemplateDraftAsset({
          access,
          documentId,
          expectedRevision,
          assetRequirementId,
          binding,
          mimeType,
          data,
        });
        const status = productionStatus(document);
        const attachedRequirement = document.document.productionPlan?.assets.find(
          (asset) => asset.id === assetRequirementId,
        );
        return {
          content: [{
            type: 'text',
            text: status.productionReady
              ? `Attached artwork to "${document.title}". Revision ${document.revision} now has every planned production asset attached or selected.`
              : `Attached artwork to "${document.title}". Revision ${document.revision} still has ${status.remainingAssetRequirementIds.length} planned asset requirement${status.remainingAssetRequirementIds.length === 1 ? '' : 's'} to complete.`,
          }],
          structuredContent: {
            documentId: document.id,
            revision: document.revision,
            assetRequirementId,
            binding: attachedRequirement?.binding ?? binding,
            targetElementIds: attachedRequirement?.targetElementIds ?? [],
            composition: compositionDiagnostics(document),
            ...status,
          },
          };
        },
      });
    },
  );

  server.registerTool(
    'preview_template_draft',
    {
      title: 'Preview the current CardForge Template draft',
      description: 'Export the exact current CardForge Template as a native PNG shown directly in chat for visual review. The result reports production completeness plus composition and asset-binding diagnostics, with the exact revision-bound Studio URL kept separately. Verify the intended image slot, frame structure, and text borders after meaningful layout or artwork revisions; do not call an asset-incomplete or misbound draft finished.',
      inputSchema: previewTemplateDraftInputSchema,
      outputSchema: templatePreviewOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ documentId }) => {
      return runObserved({
        toolName: 'preview_template_draft',
        input: { documentId },
        execute: async (access) => {
        const document = await getDeveloperTemplateDraft(access, documentId);
        const status = productionStatus(document);
        const composition = compositionDiagnostics(document);
        const artifact = await ensureTemplatePreviewArtifact({
          ownerUserId: access.user.id,
          document,
          publicOrigin,
        });
        const openInStudioUrl = `${publicOrigin}/studio?document=${encodeURIComponent(document.id)}&revision=${document.revision}`;
        const structuredContent = {
          title: document.title,
          revision: document.revision,
          renderArtifact: renderArtifactStructuredContent(artifact),
          openInStudioUrl,
          productionReady: status.productionReady,
          assetSummary: status.assetSummary,
          remainingAssetRequirementIds: status.remainingAssetRequirementIds,
          remainingAssetCount: status.remainingAssetRequirementIds.length,
          composition,
        };
        return {
          content: [{
            type: 'text' as const,
            text: status.productionReady
              ? `Rendered "${document.title}" revision ${document.revision} through the canonical CardForge renderer. All planned production assets are complete; inspect this exact CardForge PNG before opening Studio.`
              : `Rendered "${document.title}" revision ${document.revision} through the canonical CardForge renderer. ${status.remainingAssetRequirementIds.length} planned asset requirement${status.remainingAssetRequirementIds.length === 1 ? '' : 's'} remain, so do not describe it as production-complete yet.`,
          }, renderArtifactImageContent(artifact)],
          structuredContent,
          };
        },
      });
    },
  );
};
