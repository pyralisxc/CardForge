import { createMcpHandler } from 'mcp-handler';

import type { DeveloperCockpitAccess } from '@/features/developer-access/server';
import { summarizeProjectProductionAssets } from '@/features/project/server';
import {
  attachDeveloperTemplateDraftAsset,
  getDeveloperTemplateDraft,
} from './developerTemplateDrafts';
import { createStudioDocumentPreviewToken } from './studioDocumentPreviewToken';
import {
  attachTemplateAssetInputSchema,
  previewTemplateDraftInputSchema,
} from './agentTemplateToolSchemas';

const PREVIEW_RESOURCE_URI = 'ui://cardforge/template-draft-preview.html';
const PREVIEW_RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app';

type RegistrationCallback = Parameters<typeof createMcpHandler>[0];
type McpRegistrationServer = Parameters<RegistrationCallback>[0];
type ToolErrorResult = {
  isError: boolean;
  content: Array<{ type: 'text'; text: string }>;
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
  if (source.startsWith('data:')) return 'embedded' as const;
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

const buildPreviewWidgetHtml = (origin: string) => `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#090b0f;color:#f7ead0;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{overflow:hidden;border:1px solid #2b3039;border-radius:14px;background:#0d1117}.frame{display:block;width:100%;height:min(680px,72vh);border:0;background:#090b0f}.bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-top:1px solid #2b3039}.status{min-width:0;font-size:12px;color:#aab1bd}.status strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f7ead0;font-size:13px}.open{appearance:none;border:1px solid #d5ad54;border-radius:7px;background:#18140d;color:#f5d27b;padding:8px 11px;font:600 12px/1 ui-sans-serif,system-ui;cursor:pointer}.open:disabled{cursor:not-allowed;opacity:.45}.empty{padding:24px;color:#aab1bd;font-size:13px}
</style>
</head>
<body>
<div class="shell">
  <div id="empty" class="empty">Preparing the CardForge preview…</div>
  <iframe id="frame" class="frame" title="CardForge Template preview" referrerpolicy="no-referrer" hidden></iframe>
  <div class="bar">
    <div id="status" class="status">Waiting for the latest draft…</div>
    <button id="open" class="open" type="button" disabled>Open in CardForge</button>
  </div>
</div>
<script>
(() => {
  const allowedOrigin = ${JSON.stringify(origin)};
  const frame = document.getElementById('frame');
  const empty = document.getElementById('empty');
  const status = document.getElementById('status');
  const openButton = document.getElementById('open');
  let openUrl = '';

  const safeUrl = (value, path) => {
    if (typeof value !== 'string') return '';
    try {
      const url = new URL(value);
      return url.origin === allowedOrigin && url.pathname === path ? url.href : '';
    } catch { return ''; }
  };

  const apply = () => {
    const output = window.openai && window.openai.toolOutput;
    if (!output || typeof output !== 'object') return;
    const previewUrl = safeUrl(output.previewUrl, '/mcp-template-preview');
    openUrl = safeUrl(output.openInStudioUrl, '/studio');
    if (previewUrl) {
      if (frame.src !== previewUrl) frame.src = previewUrl;
      frame.hidden = false;
      empty.hidden = true;
    }
    const title = typeof output.title === 'string' ? output.title : 'CardForge draft';
    const revision = Number.isInteger(output.revision) ? 'Revision ' + output.revision : '';
    const remaining = Number.isInteger(output.remainingAssetCount) ? output.remainingAssetCount : 0;
    const ready = output.productionReady === true;
    const warnings = output.composition && Array.isArray(output.composition.warnings)
      ? output.composition.warnings.length
      : 0;
    const productionLabel = ready
      ? 'ready to install'
      : remaining > 0
        ? remaining + ' planned asset' + (remaining === 1 ? '' : 's') + ' still needed'
        : 'draft still needs review';
    const warningLabel = warnings > 0
      ? warnings + ' composition warning' + (warnings === 1 ? '' : 's')
      : '';
    status.innerHTML = '<strong></strong><span></span>';
    status.querySelector('strong').textContent = title;
    status.querySelector('span').textContent = [revision, productionLabel, warningLabel].filter(Boolean).join(' · ');
    openButton.textContent = ready ? 'Open in CardForge' : 'Open draft in CardForge';
    openButton.disabled = !openUrl;
  };

  openButton.addEventListener('click', async () => {
    if (!openUrl) return;
    if (window.openai && typeof window.openai.openExternal === 'function') {
      await window.openai.openExternal({ href: openUrl });
      return;
    }
    window.open(openUrl, '_blank', 'noopener,noreferrer');
  });

  apply();
  window.addEventListener('openai:set_globals', apply);
})();
</script>
</body>
</html>`;

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
  const previewResourceMeta = {
    ui: {
      csp: { frameDomains: [publicOrigin] },
    },
    'openai/widgetDescription': 'Exact CardForge Template preview with a link to install the approved draft in Studio.',
    'openai/widgetPrefersBorder': false,
    'openai/widgetDomain': publicOrigin,
    'openai/widgetCSP': {
      connect_domains: [],
      resource_domains: [],
      frame_domains: [publicOrigin],
    },
  };

  server.registerResource(
    'CardForge Template draft preview',
    PREVIEW_RESOURCE_URI,
    {
      title: 'CardForge Template draft preview',
      description: 'Renders the exact current CardForge Template draft for visual review before Studio installation.',
      mimeType: PREVIEW_RESOURCE_MIME_TYPE,
      _meta: previewResourceMeta,
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: PREVIEW_RESOURCE_MIME_TYPE,
        text: buildPreviewWidgetHtml(publicOrigin),
        _meta: previewResourceMeta,
      }],
    }),
  );

  server.registerTool(
    'attach_template_artwork',
    {
      title: 'Attach generated artwork to a CardForge Template draft',
      description: 'Attach one generated, user-provided, or CardForge-output PNG/JPEG/WebP to one planned artwork requirement. CardForge validates and normalizes it, embeds it into the Template itself, advances the same Studio document revision, and reports the exact native binding and target element ids. Preview after attaching to verify the intended visible slot.',
      inputSchema: attachTemplateAssetInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ documentId, expectedRevision, assetRequirementId, binding, mimeType, data }) => {
      try {
        const access = await getAccess();
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
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'preview_template_draft',
    {
      title: 'Preview the current CardForge Template draft',
      description: 'Render the exact current CardForge Template in chat for visual review. The result reports production completeness plus composition and asset-binding diagnostics. Verify the intended image slot, frame structure, and text borders after meaningful layout or artwork revisions; do not call an asset-incomplete or misbound draft finished.',
      inputSchema: previewTemplateDraftInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: PREVIEW_RESOURCE_URI, visibility: ['model'] },
        'openai/outputTemplate': PREVIEW_RESOURCE_URI,
        'openai/widgetAccessible': false,
      },
    },
    async ({ documentId }) => {
      try {
        const access = await getAccess();
        const document = await getDeveloperTemplateDraft(access, documentId);
        const status = productionStatus(document);
        const composition = compositionDiagnostics(document);
        const token = createStudioDocumentPreviewToken({
          documentId: document.id,
          ownerUserId: access.user.id,
          revision: document.revision,
        });
        const previewUrl = `${publicOrigin}/mcp-template-preview?token=${encodeURIComponent(token)}`;
        const openInStudioUrl = `${publicOrigin}/studio?document=${encodeURIComponent(document.id)}&revision=${document.revision}`;
        const structuredContent = {
          title: document.title,
          revision: document.revision,
          previewUrl,
          openInStudioUrl,
          productionReady: status.productionReady,
          assetSummary: status.assetSummary,
          remainingAssetRequirementIds: status.remainingAssetRequirementIds,
          remainingAssetCount: status.remainingAssetRequirementIds.length,
          composition,
        };
        return {
          content: [{
            type: 'text',
            text: status.productionReady
              ? `Rendered "${document.title}" revision ${document.revision}. All planned production assets are complete; inspect the composition diagnostics and visual preview before opening it in Studio.`
              : `Rendered "${document.title}" revision ${document.revision} as a draft preview. ${status.remainingAssetRequirementIds.length} planned asset requirement${status.remainingAssetRequirementIds.length === 1 ? '' : 's'} remain, so do not describe it as production-complete yet.`,
          }],
          structuredContent,
        };
      } catch (error) {
        return toolError(error);
      }
    },
  );
};
