import fs from 'node:fs';

const replace = (path, from, to) => {
  let text = fs.readFileSync(path, 'utf8');
  if (!text.includes(from)) throw new Error(`Missing target in ${path}: ${from.slice(0, 80)}`);
  text = text.replace(from, to);
  fs.writeFileSync(path, text);
};

const replaceRegex = (path, pattern, to) => {
  let text = fs.readFileSync(path, 'utf8');
  if (!pattern.test(text)) throw new Error(`Missing regex target in ${path}`);
  pattern.lastIndex = 0;
  text = text.replace(pattern, to);
  fs.writeFileSync(path, text);
};

replace('src/app/mcp/route.ts', "version: '0.7.0'", "version: '0.9.0'");
replace('src/features/studio-documents/server/mcpAgentCardTools.ts', "const CARDFORGE_MCP_CAPABILITY_VERSION = '0.8.0';", "const CARDFORGE_MCP_CAPABILITY_VERSION = '0.9.0';");

replace('tests/unit/cardforge-plugin.test.ts', "version: '0.7.0'", "version: '0.9.0'");
replace('tests/unit/cardforge-plugin.test.ts', "version: '0.7.0'", "version: '0.9.0'");
replace('tests/unit/cardforge-plugin.test.ts', 'Initial-submission release notes for 0.7.0', 'Initial-submission release notes for 0.9.0');
replace('tests/unit/studio-mcp-creation-flow.test.ts', "version: '0.7.0'", "version: '0.9.0'");
replace('tests/unit/mcp-product-hygiene.test.ts', "expect(plugin.description).toContain('generate complete card sets');", "expect(plugin.description).toContain('complete sets');");
replace('tests/unit/mcp-product-hygiene.test.ts', "expect(designSkill).toContain('native exported PNG shown directly in chat');", "expect(designSkill).toContain('canonical CardForge renderer');");

const architectureTest = 'tests/unit/studio-agent-template-preview-install.test.ts';
replaceRegex(
  architectureTest,
  /  it\('exports the exact Template through the canonical native PNG pipeline for in-chat review',[\s\S]*?\n  \}\);\n\n  it\('renders representative Set cards through the same native exporter before completion',[\s\S]*?\n  \}\);/,
`  it('exports Template and Set previews through canonical render artifacts and native MCP images', () => {
    const renderArtifacts = readSource('src/features/render-artifacts/model.ts');
    const renderStore = readSource('src/features/render-artifacts/server/renderArtifactStore.ts');
    const browserRenderer = readSource('src/features/render-artifacts/server/canonicalBrowserRenderer.ts');
    const studioArtifacts = readSource('src/features/studio-documents/server/studioRenderArtifacts.ts');
    expect(templatePreview).toContain("renderCardToPngBlob(card, 'virtual', 150)");
    expect(setPreview).toContain("renderCardToPngBlob(card, 'virtual', 150)");
    expect(templatePreview).toContain('data-cardforge-render-artifact="template-preview"');
    expect(setPreview).toContain('data-cardforge-render-artifact="card-preview"');
    expect(nativeExport).toContain('export async function renderCardToPngBlob');
    expect(renderArtifacts).toContain('CARDFORGE_RENDERER_CONTRACT_VERSION');
    expect(renderStore).toContain('upsert: false');
    expect(browserRenderer).toContain("import('@sparticuz/chromium')");
    expect(browserRenderer).toContain("import('puppeteer-core')");
    expect(studioArtifacts).toContain('composeCanonicalContactSheet');
    expect(mcpTools).toContain('renderArtifactImageContent');
    expect(mcpTools).toContain('ensureTemplatePreviewArtifact');
    expect(mcpTools).toContain('ensureSetContactSheetArtifact');
    expect(mcpTools).not.toContain("'openai/outputTemplate'");
    expect(mcpTools).not.toContain('frameDomains: [publicOrigin]');
  });`,
);
replaceRegex(
  architectureTest,
  /  it\('keeps generated image bytes out of model-facing Template preview results and constrains widgets',[\s\S]*?\n  \}\);/,
`  it('keeps source artwork private while returning only canonical rendered derivatives to chat', () => {
    expect(mcpTools).toContain("'attach_template_artwork'");
    expect(mcpTools).toContain("'preview_template_draft'");
    expect(mcpTools).not.toContain('structuredContent: { template');
    expect(mcpTools).toContain('remainingAssetRequirementIds');
    expect(mcpTools).toContain('productionReady');
    expect(mcpTools).toContain('renderArtifactImageContent');
    expect(mcpTools).not.toContain("'openai/outputTemplate'");
    expect(mcpTools).not.toContain('frameDomains:');
  });`,
);

replace('plugins/cardforge-studio/skills/create-editable-template/SKILL.md',
  'native exported PNG shown directly in chat',
  'native cached PNG produced by the canonical CardForge renderer and shown directly in chat',
);
replace('plugins/cardforge-studio/skills/create-cards-and-sets/SKILL.md',
  'native CardForge-rendered representative cards',
  'native contact sheet composed only from canonical CardForge-rendered cards',
);

const submissionPath = 'plugins/cardforge-studio/SUBMISSION.md';
let submission = fs.readFileSync(submissionPath, 'utf8');
submission = submission.replace(/Initial-submission release notes for 0\.7\.0:[^\n]*/, 'Initial-submission release notes for 0.9.0: CardForge Studio is an authenticated beta for editable Templates and complete card Sets with revision-safe cloud collaboration. Template and Set review now return immutable revision-bound PNG artifacts from the canonical CardForge renderer as native MCP image content, without iframe preview widgets.');
submission = submission.replace(/The template preview UI is model-only[\s\S]*?no additional connect or resource domains\./, 'Template and Set preview tools do not register iframe/widget output templates. They return native MCP image content containing exact CardForge-rendered PNG artifacts plus a separate revision-bound Studio URL. The plugin therefore does not require frame domains for static creative review.');
fs.writeFileSync(submissionPath, submission);

const doctrine = `\n\n## Canonical rendering doctrine\n\nCardForge has one canonical visual rendering implementation. Templates and structured card data are interpreted only by the browser CardPreview/export pipeline. Studio exports, assistant previews, and future downstream output systems must reuse artifacts produced by that renderer or invoke that exact renderer with an explicit profile; integrations must not independently reinterpret Templates for convenience.\n\nCanonical render artifacts are immutable derivatives bound to source identity, source revision, render subject, face, output profile, and a renderer contract version. A source revision can therefore remain unchanged while a renderer fix produces a new derivative contract, preventing stale pixels from surviving a rendering bug fix. Private render artifacts are cache/output data, not a second source of truth.\n\nMCP static creative review returns these exact CardForge-rendered artifacts as native image content. Rich widget/iframe UI is reserved for interactions that actually require persistent controls; displaying a finished CardForge render does not. Set contact sheets may compose canonical card PNGs downstream, but they must never re-render or reinterpret the underlying Template.\n`;
for (const path of ['docs/architecture.md', 'docs/product-direction.md']) {
  const text = fs.readFileSync(path, 'utf8');
  if (!text.includes('## Canonical rendering doctrine')) fs.writeFileSync(path, text.trimEnd() + doctrine + '\n');
}
