import fs from 'node:fs';

// One-time branch hardening script; remove after it commits the release changes.
const replace = (path, from, to) => {
  let text = fs.readFileSync(path, 'utf8');
  if (!text.includes(from)) throw new Error(`Missing target in ${path}: ${from.slice(0, 100)}`);
  text = text.replace(from, to);
  fs.writeFileSync(path, text);
};

replace(
  'src/app/mcp/route.ts',
  "export const runtime = 'nodejs';",
  "export const runtime = 'nodejs';\nexport const maxDuration = 120;",
);

replace(
  'supabase/functions/purge-assistant-drafts/index.ts',
  ".filter((object) => object.name && !object.id === false)",
  ".filter((object) => Boolean(object.name))",
);

replace(
  'src/features/studio-documents/server/studioRenderArtifacts.ts',
  "import type { StudioDocument } from '@/features/studio-documents/model';",
  "import type { StudioDocument } from '@/features/studio-documents/model';\nimport { consumeRateLimit } from '@/infrastructure/security/abuseProtection';",
);

replace(
  'src/features/studio-documents/server/studioRenderArtifacts.ts',
  "const CONTACT_SHEET_PROFILE = 'virtual-150-contact-sheet-3col';",
  `const CONTACT_SHEET_PROFILE = 'virtual-150-contact-sheet-3col';\n\nconst consumeUncachedRenderBudget = async (ownerUserId: string) => {\n  const result = await consumeRateLimit({\n    action: 'studio-ai-render',\n    identity: ownerUserId,\n    limit: 60,\n    windowSeconds: 3600,\n  });\n  if (!result.allowed) {\n    throw new StudioDocumentStoreError(\n      'Too many uncached CardForge renders were requested. Reuse the current revision or try again later.',\n      429,\n    );\n  }\n};`,
);

replace(
  'src/features/studio-documents/server/studioRenderArtifacts.ts',
  "  const cached = await readRenderArtifact({ ownerUserId, descriptor });\n  if (cached) return cached;\n  const token = previewToken(document, ownerUserId);",
  "  const cached = await readRenderArtifact({ ownerUserId, descriptor });\n  if (cached) return cached;\n  await consumeUncachedRenderBudget(ownerUserId);\n  const token = previewToken(document, ownerUserId);",
);

replace(
  'src/features/studio-documents/server/studioRenderArtifacts.ts',
  "  if (cardArtifacts.some((artifact) => artifact === null)) {\n    const token = previewToken(document, ownerUserId);",
  "  if (cardArtifacts.some((artifact) => artifact === null)) {\n    await consumeUncachedRenderBudget(ownerUserId);\n    const token = previewToken(document, ownerUserId);",
);

const submissionPath = 'plugins/cardforge-studio/SUBMISSION.md';
let submission = fs.readFileSync(submissionPath, 'utf8');
submission = submission.replace(
  '- Long description: Design editable card Templates, create individual cards or complete sets, bulk-generate copy and unique artwork with ChatGPT, review results, and continue everything in CardForge Studio. Developer publication tools remain a separate optional workflow.',
  '- Long description: Design editable card Templates, create individual cards or complete sets, bulk-generate copy and unique artwork with ChatGPT, review exact CardForge-rendered outputs natively in chat, and continue everything in CardForge Studio. Developer publication tools remain a separate optional workflow.',
);
submission = submission.replace(
  "The template and Set preview UIs are model-only and cannot call MCP tools. Their exact CSP allows frames and redirects only to `https://cardforges.com`; they declare no additional connect or resource domains.",
  "Template and Set preview tools do not register iframe/widget output templates. They return native MCP `image/png` content produced by CardForge's canonical renderer, plus separate revision-bound Studio URLs. Static creative review therefore requires no frame-domain or widget CSP permissions.",
);
fs.writeFileSync(submissionPath, submission);

const capabilitiesPath = 'src/features/studio-documents/server/mcpAccountWorkflowTools.ts';
let capabilities = fs.readFileSync(capabilitiesPath, 'utf8');
capabilities = capabilities.replace(
  "              projectCapabilities: access.entitlement.capabilities,",
  "              projectCapabilities: access.entitlement.capabilities,\n              nativeRenderArtifacts: true,\n              renderReviewMode: 'canonical CardForge PNGs returned directly in chat',",
);
capabilities = capabilities.replace(
  "              gatedContributionTools: 'Forge Review, shared-library publication, and owner-only publication actions remain scope-gated even though the same MCP server can describe them.',",
  "              gatedContributionTools: 'Forge Review, shared-library publication, and owner-only publication actions remain scope-gated even though the same MCP server can describe them.',\n              renderGuidance: 'Preview tools never prove that a revision was installed in Studio. They render the exact server revision; use get_agent_install_status separately when local application state matters.',",
);
fs.writeFileSync(capabilitiesPath, capabilities);
