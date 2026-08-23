import fs from 'node:fs';

const replaceOrThrow = (source, search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Missing refactor target: ${label}`);
  return source.replace(search, replacement);
};

const templatePath = 'src/features/studio-documents/server/mcpAgentTemplateToolsCore.ts';
let template = fs.readFileSync(templatePath, 'utf8');
template = replaceOrThrow(template,
  "import { createStudioDocumentPreviewToken } from './studioDocumentPreviewToken';\n",
  "import { ensureTemplatePreviewArtifact } from './studioRenderArtifacts';\nimport { renderArtifactImageContent, renderArtifactStructuredContent } from './mcpRenderArtifactResults';\n",
  'template preview imports',
);
template = template.replace("const PREVIEW_RESOURCE_URI = 'ui://cardforge/template-draft-preview.html';\nconst PREVIEW_RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app';\n", '');
template = template.replace(/const buildPreviewWidgetHtml = \(origin: string\) => `<!doctype html>[\s\S]*?<\/html>`;\n\n/, '');
template = template.replace(/\n  const previewResourceMeta = \{[\s\S]*?\n  server\.registerTool\(\n    'attach_template_artwork'/, "\n\n  server.registerTool(\n    'attach_template_artwork'");
template = template.replace(/\n      _meta: \{\n        ui: \{ resourceUri: PREVIEW_RESOURCE_URI, visibility: \['model'\] \},\n        'openai\/outputTemplate': PREVIEW_RESOURCE_URI,\n        'openai\/widgetAccessible': false,\n      \},/, '');
template = replaceOrThrow(template,
`        const token = createStudioDocumentPreviewToken({
          documentId: document.id,
          ownerUserId: access.user.id,
          revision: document.revision,
        });
        const previewUrl = \`${'${publicOrigin}'}/mcp-template-preview?token=${'${encodeURIComponent(token)}'}&revision=${'${document.revision}'}\`;
        const openInStudioUrl = \`${'${publicOrigin}'}/studio?document=${'${encodeURIComponent(document.id)}'}&revision=${'${document.revision}'}\`;
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
              ? \`Exported "${'${document.title}'}" revision ${'${document.revision}'} as a PNG in chat. All planned production assets are complete; inspect the composition diagnostics and exported image before opening the separate Studio link.\`
              : \`Exported "${'${document.title}'}" revision ${'${document.revision}'} as a draft PNG in chat. ${'${status.remainingAssetRequirementIds.length}'} planned asset requirement${'${status.remainingAssetRequirementIds.length === 1 ? \'\' : \'s\'}'} remain, so do not describe it as production-complete yet.\`,
          }],
          structuredContent,
          };`,
`        const artifact = await ensureTemplatePreviewArtifact({
          ownerUserId: access.user.id,
          document,
          publicOrigin,
        });
        const openInStudioUrl = \`${'${publicOrigin}'}/studio?document=${'${encodeURIComponent(document.id)}'}&revision=${'${document.revision}'}\`;
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
              ? \`Rendered "${'${document.title}'}" revision ${'${document.revision}'} through the canonical CardForge renderer. All planned production assets are complete; inspect this exact CardForge PNG before opening Studio.\`
              : \`Rendered "${'${document.title}'}" revision ${'${document.revision}'} through the canonical CardForge renderer. ${'${status.remainingAssetRequirementIds.length}'} planned asset requirement${'${status.remainingAssetRequirementIds.length === 1 ? \'\' : \'s\'}'} remain, so do not describe it as production-complete yet.\`,
          }, renderArtifactImageContent(artifact)],
          structuredContent,
          };`,
  'template native image result',
);
fs.writeFileSync(templatePath, template);

const cardPath = 'src/features/studio-documents/server/mcpAgentCardTools.ts';
let card = fs.readFileSync(cardPath, 'utf8');
card = replaceOrThrow(card,
  "import { createStudioDocumentPreviewToken } from './studioDocumentPreviewToken';\n",
  "import { ensureSetContactSheetArtifact } from './studioRenderArtifacts';\nimport { renderArtifactImageContent, renderArtifactStructuredContent } from './mcpRenderArtifactResults';\n",
  'set preview imports',
);
card = card.replace("const SET_PREVIEW_RESOURCE_URI = 'ui://cardforge/card-set-preview.html';\nconst SET_PREVIEW_RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app';\nconst MAX_RENDERED_PREVIEW_CARDS = 12;\n", '');
card = card.replace(/const buildSetPreviewWidgetHtml = \(origin: string\) => `<!doctype html>[\s\S]*?<\/html>`;\n\n/, '');
card = card.replace(/\n  const previewResourceMeta = \{[\s\S]*?\n  server\.registerTool\(\n    'get_card_generation_contract'/, "\n\n  server.registerTool(\n    'get_card_generation_contract'");
card = card.replace(/\n      _meta: \{\n        ui: \{ resourceUri: SET_PREVIEW_RESOURCE_URI, visibility: \['model'\] \},\n        'openai\/outputTemplate': SET_PREVIEW_RESOURCE_URI,\n        'openai\/widgetAccessible': false,\n      \},/, '');
card = replaceOrThrow(card,
`        const applied = document.lastInstalledRevision === document.revision;
        const token = createStudioDocumentPreviewToken({
          documentId: document.id,
          ownerUserId: access.user.id,
          revision: document.revision,
        });
        const previewUrl = \`${'${publicOrigin}'}/mcp-card-set-preview?token=${'${encodeURIComponent(token)}'}&setId=${'${encodeURIComponent(set.id)}'}&revision=${'${document.revision}'}\`;
        const previewSampleCount = Math.min(cards.length, MAX_RENDERED_PREVIEW_CARDS);
        return {
          content: [{
            type: 'text',
            text: \`Reviewed "${'${set.name}'}" at revision ${'${document.revision}'}: ${'${cards.length}'} card${'${cards.length === 1 ? \'\' : \'s\'}'}, ${'${artwork.counts.unresolved}'} unresolved artwork value${'${artwork.counts.unresolved === 1 ? \'\' : \'s\'}'}, ${'${artwork.counts.templateFallbacks}'} template fallback${'${artwork.counts.templateFallbacks === 1 ? \'\' : \'s\'}'}, and ${'${artwork.counts.placeholders}'} placeholder${'${artwork.counts.placeholders === 1 ? \'\' : \'s\'}'}. The native preview renders ${'${previewSampleCount}'} representative card${'${previewSampleCount === 1 ? \'\' : \'s\'}'} in chat. This exact revision is ${'${applied ? \'already applied to a CardForge Studio workspace\' : \'not yet acknowledged as applied in Studio\'}'}.\`,
          }],
          structuredContent: {
            documentId: document.id,
            revision: document.revision,
            set,
            cards: compactValue(cards),
            artwork,
            cardCount: cards.length,
            previewUrl,
            previewSampleCount,
            installation: {`,
`        const applied = document.lastInstalledRevision === document.revision;
        const rendered = await ensureSetContactSheetArtifact({
          ownerUserId: access.user.id,
          document,
          setId: set.id,
          publicOrigin,
        });
        return {
          content: [{
            type: 'text' as const,
            text: \`Reviewed "${'${set.name}'}" at revision ${'${document.revision}'}: ${'${cards.length}'} card${'${cards.length === 1 ? \'\' : \'s\'}'}, ${'${artwork.counts.unresolved}'} unresolved artwork value${'${artwork.counts.unresolved === 1 ? \'\' : \'s\'}'}, ${'${artwork.counts.templateFallbacks}'} template fallback${'${artwork.counts.templateFallbacks === 1 ? \'\' : \'s\'}'}, and ${'${artwork.counts.placeholders}'} placeholder${'${artwork.counts.placeholders === 1 ? \'\' : \'s\'}'}. ${'${rendered.artifact ? `The native image is a contact sheet composed only from ${rendered.previewSampleCount} canonical CardForge card renders.` : \'This Set has no cards to render yet.\'}'} This exact revision is ${'${applied ? \'already applied to a CardForge Studio workspace\' : \'not yet acknowledged as applied in Studio\'}'}.\`,
          }, ...(rendered.artifact ? [renderArtifactImageContent(rendered.artifact)] : [])],
          structuredContent: {
            documentId: document.id,
            revision: document.revision,
            set,
            cards: compactValue(cards),
            artwork,
            cardCount: cards.length,
            renderArtifact: rendered.artifact ? renderArtifactStructuredContent(rendered.artifact) : null,
            previewSampleCount: rendered.previewSampleCount,
            installation: {`,
  'set native image result',
);
fs.writeFileSync(cardPath, card);

const schemasPath = 'src/features/studio-documents/server/mcpToolOutputSchemas.ts';
let schemas = fs.readFileSync(schemasPath, 'utf8');
schemas = schemas.replace("    'previewUrl', 'previewSampleCount', 'installation', 'openInStudioUrl',", "    'renderArtifact', 'previewSampleCount', 'installation', 'openInStudioUrl',");
schemas = schemas.replace("    previewUrl: { type: 'string', format: 'uri' },\n    previewSampleCount:", "    renderArtifact: { anyOf: [objectValue, { type: 'null' }] },\n    previewSampleCount:");
schemas = schemas.replace("    'title', 'revision', 'previewUrl', 'openInStudioUrl', 'productionReady',", "    'title', 'revision', 'renderArtifact', 'openInStudioUrl', 'productionReady',");
schemas = schemas.replace("    previewUrl: { type: 'string', format: 'uri' },\n    openInStudioUrl:", "    renderArtifact: objectValue,\n    openInStudioUrl:");
fs.writeFileSync(schemasPath, schemas);
