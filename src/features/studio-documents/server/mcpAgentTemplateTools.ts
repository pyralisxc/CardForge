import { createMcpHandler } from 'mcp-handler';

import type { DeveloperCockpitAccess } from '@/features/developer-access/server';
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
  isError: true;
  content: Array<{ type: 'text'; text: string }>;
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
    status.innerHTML = '<strong></strong><span></span>';
    status.querySelector('strong').textContent = title;
    status.querySelector('span').textContent = revision;
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
  server.registerResource(
    'CardForge Template draft preview',
    PREVIEW_RESOURCE_URI,
    {
      title: 'CardForge Template draft preview',
      description: 'Renders the exact current CardForge Template draft for visual review before Studio installation.',
      mimeType: PREVIEW_RESOURCE_MIME_TYPE,
      _meta: {
        ui: {
          csp: { frameDomains: [publicOrigin] },
        },
        'openai/widgetDescription': 'Exact CardForge Template preview with a link to install the approved draft in Studio.',
        'openai/widgetPrefersBorder': false,
        'openai/widgetCSP': {
          connect_domains: [],
          resource_domains: [],
          frame_domains: [publicOrigin],
        },
      },
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: PREVIEW_RESOURCE_MIME_TYPE,
        text: buildPreviewWidgetHtml(publicOrigin),
      }],
    }),
  );

  server.registerTool(
    'attach_template_artwork',
    {
      title: 'Attach generated artwork to a CardForge Template draft',
      description: 'Attach one generated, user-provided, or CardForge-output PNG/JPEG/WebP to one planned artwork requirement. CardForge validates and normalizes it, embeds it into the Template itself, and advances the same Studio document revision.',
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
        return {
          content: [{
            type: 'text',
            text: `Attached artwork to "${document.title}". The same Studio draft is now revision ${document.revision}.`,
          }],
          structuredContent: {
            documentId: document.id,
            revision: document.revision,
            assetRequirementId,
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
      description: 'Render the exact current CardForge Template in chat for visual review. Use after initial creation and after meaningful layout, copy, style, or artwork revisions, before asking the user to open/install it in Studio.',
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
        const token = createStudioDocumentPreviewToken({
          documentId: document.id,
          ownerUserId: access.user.id,
          revision: document.revision,
        });
        const previewUrl = `${publicOrigin}/mcp-template-preview?token=${encodeURIComponent(token)}`;
        const openInStudioUrl = `${publicOrigin}/studio?document=${encodeURIComponent(document.id)}`;
        const structuredContent = {
          title: document.title,
          revision: document.revision,
          previewUrl,
          openInStudioUrl,
        };
        return {
          content: [{
            type: 'text',
            text: `Rendered "${document.title}" revision ${document.revision} for visual review. Revise this same draft if the user wants changes; open it in Studio only when they are ready to install it.`,
          }],
          structuredContent,
        };
      } catch (error) {
        return toolError(error);
      }
    },
  );
};
