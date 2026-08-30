import { createMcpHandler } from 'mcp-handler';

import type { StudioAgentAccess } from './studioAgentAccess';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import {
  summarizeProjectProductionAssets,
  type ProjectAssetBinding,
  type ProjectAssetRequirement,
} from '@/features/project/server';
import {
  attachTemplateWorkingDocumentAsset,
  getTemplateWorkingDocument,
} from './templateWorkingDocuments';
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

type TemplateWorkingDocument = Awaited<ReturnType<typeof getTemplateWorkingDocument>>;
type TemplateElement = NonNullable<TemplateWorkingDocument['document']['userTemplates'][number]['freeformCanvas']>['elements'][number];

const productionStatus = (document: TemplateWorkingDocument) => {
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
  if (source.startsWith('data:') || source.startsWith('cardforge-studio-asset://')) return 'stored' as const;
  if (source.startsWith('embedded://')) return 'stored-reference' as const;
  return 'configured' as const;
};

const inferEmbeddedAssetBinding = (
  asset: ProjectAssetRequirement,
  elements: TemplateElement[],
): ProjectAssetBinding | null => {
  if (asset.binding) return asset.binding;
  if (!asset.embeddedAssetId) return null;
  const targetIds = asset.targetElementIds ?? [];
  if (targetIds.length === 0) return null;
  const targets = targetIds.map((id) => elements.find((element) => element.id === id));
  if (targets.some((target) => !target)) return null;
  if (targets.every((target) => target?.type === 'image')) return 'element.image';
  if (targets.every((target) => target?.type === 'icon')) return 'element.icon';
  if (targets.every((target) => target?.type === 'shape' && (target.shapeKind === 'line' || target.shapeRole === 'divider'))) {
    return 'element.divider';
  }
  return null;
};

const compositionDiagnostics = (document: TemplateWorkingDocument) => {
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
  const effectiveBindingByAssetId = new Map((plan?.assets ?? []).map((asset) => [
    asset.id,
    inferEmbeddedAssetBinding(asset, elements),
  ]));
  const assetBindings = (plan?.assets ?? []).map((asset) => ({
    id: asset.id,
    role: asset.role,
    kind: asset.kind,
    status: asset.status,
    binding: effectiveBindingByAssetId.get(asset.id) ?? null,
    bindingSource: asset.binding ? 'stored' as const : effectiveBindingByAssetId.get(asset.id) ? 'inferred_from_native_target' as const : 'unknown' as const,
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
    if (effectiveBindingByAssetId.get(asset.id) !== 'element.image') continue;
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
  getAccess: () => Promise<StudioAgentAccess>;
  toolError: (error: unknown) => ToolErrorResult;
}) => {
  const runObserved = async <Result>({
    toolName,
    input,
    execute,
  }: {
    toolName: string;
    input: unknown;
    execute: (access: StudioAgentAccess) => Promise<Result>;
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
      description: 'Attach one generated, user-provided, or CardForge-output PNG/JPEG/WebP to one planned artwork requirement. CardForge decodes, normalizes, stores, and binds it, but storage is not visual proof: use canonical preview to confirm decode/render health. Prefer attach_template_artworks for multi-asset batches.',
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
        const document = await attachTemplateWorkingDocumentAsset({
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
        const compositionEnvelope = {
          composition: compositionDiagnostics(document),
        };
        return {
          content: [{
            type: 'text',
            text: status.productionReady
              ? `Stored and bound artwork for "${document.title}" at revision ${document.revision}. Every planned production asset is now attached or selected, but canonical rendering is still required before calling the artwork visually healthy.`
              : `Stored and bound artwork for "${document.title}" at revision ${document.revision}. ${status.remainingAssetRequirementIds.length} planned asset requirement${status.remainingAssetRequirementIds.length === 1 ? '' : 's'} remain; canonical rendering has not been checked yet.`,
          }],
          structuredContent: {
            documentId: document.id,
            revision: document.revision,
            assetRequirementId,
            binding: attachedRequirement?.binding ?? binding,
            targetElementIds: attachedRequirement?.targetElementIds ?? [],
            composition: {
              ...compositionEnvelope.composition,
              renderHealth: 'not_checked',
            },
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
      description: 'Export the exact current CardForge Template as a native PNG shown directly in chat for visual review. Canonical rendering is the source of truth for decode/render health. The result reports production completeness plus composition and normalized asset-binding diagnostics, with the exact revision-bound Studio URL kept separately.',
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
        const document = await getTemplateWorkingDocument(access, documentId);
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
          composition: {
            ...composition,
            renderHealth: 'rendered',
          },
        };
        return {
          content: [{
            type: 'text' as const,
            text: status.productionReady
              ? `Rendered "${document.title}" revision ${document.revision} through the canonical CardForge renderer. Render health is rendered for this exact revision; all planned production assets are complete.`
              : `Rendered "${document.title}" revision ${document.revision} through the canonical CardForge renderer. Render health is rendered for this exact revision, but ${status.remainingAssetRequirementIds.length} planned asset requirement${status.remainingAssetRequirementIds.length === 1 ? '' : 's'} remain.`,
          }, renderArtifactImageContent(artifact)],
          structuredContent,
          };
        },
      });
    },
  );
};
