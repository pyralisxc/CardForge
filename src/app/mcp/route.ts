import { verifyClerkToken } from '@clerk/mcp-tools/next';
import { auth } from '@clerk/nextjs/server';
import { createMcpHandler, withMcpAuth } from 'mcp-handler';

import {
  CARDFORGE_FREEFORM_ELEMENT_TYPES,
  CARDFORGE_FREEFORM_SHAPE_KINDS,
} from '@/domain/templates';
import {
  PROJECT_ASSET_BINDINGS,
  PROJECT_ASSET_REQUIREMENT_SOURCES,
  PROJECT_ASSET_REQUIREMENT_STATUSES,
  PROJECT_PRODUCTION_DECISION_MODES,
  summarizeProjectProductionAssets,
} from '@/features/project/server';
import {
  DeveloperCockpitAccessError,
} from '@/features/developer-access/server';
import {
  McpUsageStoreError,
  observeMcpToolExecution,
} from '@/features/mcp-usage/server';
import {
  continueDeveloperTemplateDraftInPipeline,
  createDeveloperTemplateDraft,
  editableTemplateSummaryForMcp,
  getDeveloperTemplateDraft,
  gptTemplateDraftInputSchema,
  listDeveloperTemplateDrafts,
  omitEmbeddedMediaForMcp,
  registerCardForgePluginSkills,
  searchStudioCreationLibrary,
  StudioDocumentStoreError,
  updateDeveloperTemplateDraft,
} from '@/features/studio-documents/server';
import { registerAgentTemplateTools } from '@/features/studio-documents/server/mcpAgentTemplateTools';
import {
  createTemplateInputSchema,
  documentIdInputSchema,
  pipelineInputSchema,
  searchStudioLibraryInputSchema,
  updateTemplateInputSchema,
} from '@/features/studio-documents/server/mcpToolInputSchemas';
import {
  editableTemplateListOutputSchema,
  editableTemplateOutputSchema,
  editableTemplateSummaryOutputSchema,
  pipelineHandoffOutputSchema,
  studioCreationGuideOutputSchema,
  studioLibrarySearchOutputSchema,
} from '@/features/studio-documents/server/mcpToolOutputSchemas';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';
import { getMcpStudioAccess } from './mcpStudioAccess';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CARDFORGE_SHAPE_ROLES = [
  'basic',
  'panel',
  'artFrame',
  'rulesBox',
  'titlePlate',
  'statGem',
  'costOrb',
  'divider',
] as const;

const publicOrigin = () => (
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') || 'https://cardforges.com'
);

const absoluteUrl = (path: string) => `${publicOrigin()}${path}`;
const studioDocumentUrl = (documentId: string) => absoluteUrl(
  `/studio?document=${encodeURIComponent(documentId)}`,
);

const toolError = (error: unknown) => {
  const message = error instanceof DeveloperCockpitAccessError
    || error instanceof StudioDocumentStoreError
    || error instanceof RateLimitUnavailableError
    || error instanceof McpUsageStoreError
    ? error.message
    : 'CardForge could not complete that action.';
  if (!(error instanceof DeveloperCockpitAccessError)
    && !(error instanceof StudioDocumentStoreError)
    && !(error instanceof RateLimitUnavailableError)
    && !(error instanceof McpUsageStoreError)) {
    console.error('CardForge MCP tool failed:', error);
  }
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
};

type ObservedMcpTool<Result> = {
  toolName: string;
  input: unknown;
  execute: (access: Awaited<ReturnType<typeof getMcpStudioAccess>>) => Promise<Result>;
};

const runObservedMcpTool = async <Result>({ toolName, input, execute }: ObservedMcpTool<Result>) => {
  try {
    const access = await getMcpStudioAccess();
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
const validateDraftInput = (input: unknown) => {
  const validation = gptTemplateDraftInputSchema.safeParse(input);
  if (validation.success) return validation.data;
  const details = validation.error.issues
    .slice(0, 6)
    .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
    .join('; ');
  throw new StudioDocumentStoreError(
    `The editable Template needs correction before CardForge can create it. ${details}`,
    409,
  );
};

const handler = createMcpHandler(
  (server) => {
    registerCardForgePluginSkills(server);
    registerAgentTemplateTools({
      server,
      publicOrigin: publicOrigin(),
      getAccess: getMcpStudioAccess,
      toolError,
    });
    server.registerTool(
      'get_studio_creation_guide',
      {
        title: 'Get the CardForge creation workflow',
        description: 'Read CardForge native authoring capabilities and the recommended conversation-to-Studio workflow before planning a new design.',
        outputSchema: studioCreationGuideOutputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async () => runObservedMcpTool({
        toolName: 'get_studio_creation_guide',
        input: {},
        execute: async () => {
          const structuredContent = {
            workflow: [
              'Establish the purpose, audience, deliverable, and exact output dimensions or physical format.',
              'Resolve one quality target before building the plan: simple, professional, or premium. Infer it when the request is explicit; otherwise ask one concise quality question. If the user explicitly delegates all creative decisions without naming a quality target, use professional.',
              'Agree on visual direction: look and feel, palette, typography, hierarchy, and copy/content needs. Record the selected quality target in visualDirection.notes so later revisions preserve it.',
              'Inventory every meaningful visual slot for this deliverable before creation. Consider hero or main art, background/environment, border/frame, brand/logo/product imagery, supporting imagery, and icons/emblems only where relevant; do not force irrelevant slots.',
              'For each visual slot choose one strategy: native CardForge structure, a selected CardForge library asset, an editable user image slot, or produced artwork. Search the CardForge library before asking for or producing new art.',
              'When a selected frame, frame image, or frame kit already defines title, rules, stat, or other visible regions, use that frame as the composition skeleton. Do not recreate those same regions with redundant decorative borders or opaque panels; place editable text cleanly inside them unless the user explicitly asks for another panel.',
              'For every user-replaceable image slot, create a native image element plus a field contract with type image and include its key in productionPlan.editableFieldKeys. For fixed produced artwork, create a planned asset requirement targeting the exact native element or template-level surface.',
              'For fixed main artwork, target the actual native image element and use binding element.image. A successful upload is not proof of correct placement; preview the Template and verify the intended visible image slot no longer shows placeholder or unrelated artwork.',
              'Define every other Studio-editable field and bind it through native fieldContracts to a real canvas element.',
              'For each distinct custom image, create one planned asset requirement with status needed, then attach the finished image with attach_template_artwork using the appropriate native binding.',
              'Show the production plan to the user and use decisionMode confirmed after approval, or delegated only when the user explicitly delegated creative decisions. Once either mode is stored on the created draft, planning is locked.',
              'Create the native editable Template, attach required artwork, and call preview_template_draft so the user can visually review the exact CardForge render in chat. Inspect its asset bindings, image-element source states, bordered text ids, and composition warnings before describing the draft as finished.',
              'After planning is locked, execute and revise the same Studio document without repeating the planning gate. Reopen planning only when the user materially changes the purpose, deliverable, output size, quality target, or explicitly asks to re-plan.',
              'Revise and re-preview until the user is satisfied, then let them open it in CardForge Studio to install or update the same personal local Template.',
            ],
            canvas: {
              elementTypes: [...CARDFORGE_FREEFORM_ELEMENT_TYPES],
              shapeKinds: [...CARDFORGE_FREEFORM_SHAPE_KINDS],
              shapeRoles: [...CARDFORGE_SHAPE_ROLES],
              note: 'MCP-created elements require stable ids, names, explicit geometry, and z-index. Shapes also require shapeKind.',
            },
            planning: {
              decisionModes: [...PROJECT_PRODUCTION_DECISION_MODES],
              assetSources: [...PROJECT_ASSET_REQUIREMENT_SOURCES],
              assetStatuses: [...PROJECT_ASSET_REQUIREMENT_STATUSES],
              assetBindings: [...PROJECT_ASSET_BINDINGS],
              planningLockRule: 'A created draft with decisionMode confirmed or delegated already has an accepted plan. Do not ask for the same approval or restart discovery during ordinary copy, layout, style, or artwork revisions. Re-plan only after a material scope/quality change or an explicit user request.',
              frameFirstRule: 'Treat an existing selected frame as structural artwork. Do not redraw its visible boxes with extra bordered text elements or opaque panels unless the user requests an additional layer.',
              customArtRule: 'Keep new custom-generated artwork status needed in the creation plan, generate it, then use attach_template_artwork. For main art, bind to the exact native image element with element.image and verify the placement with preview_template_draft. CardForge embeds the normalized image into the Template itself and marks the requirement selected.',
            },
            quality: {
              qualityTargets: [
                {
                  id: 'simple',
                  description: 'Native/library-first and fast. Prefer CardForge structure, typography, materials, and existing assets; use custom imagery only where the user asks for it or the deliverable clearly requires a primary image.',
                },
                {
                  id: 'professional',
                  description: 'Polished production default. Use native editable structure plus high-quality library or custom imagery for the primary visual surfaces that make the deliverable feel finished.',
                },
                {
                  id: 'premium',
                  description: 'Art-directed maximum. Use bespoke, user-provided, or generated imagery for every high-impact visual surface where unique artwork materially improves the result, while keeping replaceable content editable.',
                },
              ],
              qualitySelectionRule: 'Ask one concise quality question only when the request does not already make the desired fidelity clear. Do not repeatedly ask the user to choose quality after the plan is confirmed or delegated.',
              visualSlotRule: 'A high-quality deliverable must account for every meaningful image-bearing region before creation. Each slot must be intentionally native, library-backed, user-replaceable, or produced; professional and premium plans must not silently substitute generic filler shapes for missing high-value imagery.',
              frameCompositionRule: 'When frame artwork already supplies the visible panels or plates, editable content should normally remain transparent and borderless inside those regions so the frame stays visually authoritative.',
              editableImageRule: 'When an image is expected to be replaced by the user in Studio, represent it as a native image element and a fieldContract with type image rather than baking it into an unrelated background or shape.',
              placeholderRule: 'Do not use placeholder art in professional or premium work unless the user explicitly requests a placeholder/prototyping stage.',
              nativeEditableFeatures: [
                'physical trim dimensions and custom canvas sizes',
                'field contracts including user-replaceable image fields',
                'materials, gradients, textures, borders, glow, bevel, and shadow',
                'shape roles and native shape kinds',
                'image fit, position, scale, offset, and rotation',
                'font family, pixel sizing, alignment, transforms, decoration, and auto-fit',
                'grouping through parentId, visibility, locking, rotation, and layer order',
              ],
            },
          };
          return {
            content: [{ type: 'text', text: 'CardForge creation workflow loaded. Resolve quality once, use existing frame structure as the skeleton, bind artwork to the intended native slot, and preview until the exact render is correct.' }],
            structuredContent,
          };
        },
      }),
    );

    server.registerTool(
      'search_studio_library',
      {
        title: 'Search the CardForge Studio library',
        description: 'Search CardForge templates, styles, fonts, textures, dividers, icons, and images while planning a design. Prefer reusing suitable library assets before inventing new ones.',
        inputSchema: searchStudioLibraryInputSchema,
        outputSchema: studioLibrarySearchOutputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async ({ query, kinds, limit }) => runObservedMcpTool({
        toolName: 'search_studio_library',
        input: { query, kinds, limit },
        execute: async () => {
          const items = await searchStudioCreationLibrary({ query, kinds, limit });
          return {
            content: [{ type: 'text', text: `Found ${items.length} CardForge creation librar${items.length === 1 ? 'y item' : 'y items'}.` }],
            structuredContent: { items },
          };
        },
      }),
    );

    server.registerTool(
      'create_editable_template',
      {
        title: 'Create a planned editable CardForge Template',
        description: 'Create one private CardForge Template after resolving the requested quality target, identifying every meaningful visual slot, defining editable fields, and accepting the production plan. productionPlan is required and must truthfully record confirmed user approval or explicit creative delegation. Once created, that accepted plan is locked for ordinary revisions; use native Studio fields so replaceable text and imagery remain editable.',
        inputSchema: createTemplateInputSchema,
        outputSchema: editableTemplateSummaryOutputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async (input) => runObservedMcpTool({
        toolName: 'create_editable_template',
        input,
        execute: async (access) => {
          const userId = access.user.id;
          const rateLimit = await consumeRateLimit({
            action: 'studio-ai-draft',
            identity: userId,
            limit: 60,
            windowSeconds: 3600,
          });
          if (!rateLimit.allowed) throw new StudioDocumentStoreError('Too many Studio drafts. Please try again later.', 409);
          const validatedInput = validateDraftInput(input);
          const document = await createDeveloperTemplateDraft(access, validatedInput);
          const assetSummary = summarizeProjectProductionAssets(validatedInput.productionPlan);
          return {
            content: [{
              type: 'text',
              text: `Created "${document.title}" as a private editable Studio Template with a locked ${validatedInput.productionPlan.decisionMode} production plan and ${assetSummary.totalAssetInstances} planned asset instance${assetSummary.totalAssetInstances === 1 ? '' : 's'}; ${assetSummary.neededInstances} still need production or selection.`,
            }],
            structuredContent: editableTemplateSummaryForMcp(document, studioDocumentUrl(document.id)),
          };
        },
      }),
    );

    server.registerTool(
      'update_editable_template',
      {
        title: 'Revise an editable CardForge Template',
        description: 'Revise the same private Studio document against its accepted production plan. Load the document first, preserve its CardForge identity and planned asset ids, send the current expectedRevision, and update the rich native Template plus its production plan. Do not reopen planning for ordinary copy, layout, style, or artwork changes; re-plan only when the user materially changes purpose, deliverable, output size, quality target, or explicitly requests it. CardForge preserves already embedded artwork for matching planned asset ids.',
        inputSchema: updateTemplateInputSchema,
        outputSchema: editableTemplateSummaryOutputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          openWorldHint: false,
        },
      },
      async ({ documentId, expectedRevision, ...draftInput }) => runObservedMcpTool({
        toolName: 'update_editable_template',
        input: { documentId, expectedRevision, ...draftInput },
        execute: async (access) => {
          const rateLimit = await consumeRateLimit({
            action: 'studio-ai-draft',
            identity: access.user.id,
            limit: 60,
            windowSeconds: 3600,
          });
          if (!rateLimit.allowed) throw new StudioDocumentStoreError('Too many Studio draft revisions. Please try again later.', 409);
          const validatedInput = validateDraftInput(draftInput);
          const document = await updateDeveloperTemplateDraft({
            access,
            documentId,
            expectedRevision,
            input: validatedInput,
          });
          return {
            content: [{ type: 'text', text: `Revised "${document.title}" to Studio document revision ${document.revision} without reopening its accepted planning gate.` }],
            structuredContent: editableTemplateSummaryForMcp(document, studioDocumentUrl(document.id)),
          };
        },
      }),
    );

    server.registerTool(
      'list_editable_templates',
      {
        title: 'List editable CardForge Templates',
        description: 'List private Studio documents in the linked CardForge account so the user can choose one without guessing an id.',
        outputSchema: editableTemplateListOutputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async () => runObservedMcpTool({
        toolName: 'list_editable_templates',
        input: {},
        execute: async (access) => {
          const documents = await listDeveloperTemplateDrafts(access);
          return {
            content: [{ type: 'text', text: `Found ${documents.length} private Studio document${documents.length === 1 ? '' : 's'}.` }],
            structuredContent: { documents },
          };
        },
      }),
    );

    server.registerTool(
      'get_editable_template',
      {
        title: 'Get an editable CardForge Template',
        description: 'Load one private Studio document, including its native editable Template and production plan, before revising it. A stored confirmed or delegated production plan is already accepted and should not be sent through the planning/approval gate again unless the user materially changes scope or explicitly asks to re-plan. Embedded image bytes are omitted from model context but remain attached to the draft.',
        inputSchema: documentIdInputSchema,
        outputSchema: editableTemplateOutputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async ({ documentId }) => runObservedMcpTool({
        toolName: 'get_editable_template',
        input: { documentId },
        execute: async (access) => {
          const document = await getDeveloperTemplateDraft(access, documentId);
          const productionPlan = document.document.productionPlan;
          const editableImageFieldKeys = document.document.userTemplates[0]?.fieldContracts
            ?.filter((field) => field.type === 'image')
            .map((field) => field.key) ?? [];
          const result = {
            document: omitEmbeddedMediaForMcp(document),
            planningLocked: Boolean(productionPlan),
            planningDecisionMode: productionPlan?.decisionMode ?? null,
            editableImageFieldKeys,
            openInStudioUrl: studioDocumentUrl(document.id),
          };
          return {
            content: [{ type: 'text', text: `Loaded "${document.title}" at Studio document revision ${document.revision}.` }],
            structuredContent: result,
          };
        },
      }),
    );

    server.registerTool(
      'continue_template_in_pipeline',
      {
        title: 'Continue a Template in Forge Review',
        description: 'Create a developer Pipeline draft from a private Studio Template, then return Forge Review. This is separate from creative planning and does not publish the Template.',
        inputSchema: pipelineInputSchema,
        outputSchema: pipelineHandoffOutputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async ({ documentId, templateId }) => runObservedMcpTool({
        toolName: 'continue_template_in_pipeline',
        input: { documentId, templateId },
        execute: async (access) => {
          const userId = access.user.id;
          const rateLimit = await consumeRateLimit({
            action: 'template-pipeline-draft',
            identity: userId,
            limit: 60,
            windowSeconds: 3600,
          });
          if (!rateLimit.allowed) throw new StudioDocumentStoreError('Too many Pipeline handoffs. Please try again later.', 409);
          const result = await continueDeveloperTemplateDraftInPipeline({ access, documentId, templateId });
          const structuredContent = {
            draftId: result.draft.id,
            openInPipelineUrl: absoluteUrl(result.openInPipelineUrl),
          };
          return {
            content: [{ type: 'text', text: 'The Template is now a Pipeline draft. Open Forge Review to complete its metadata; nothing was invented or published.' }],
            structuredContent,
          };
        },
      }),
    );
  },
  {
    serverInfo: { name: 'cardforge-studio', version: '0.9.0' },
    capabilities: {
      extensions: {
        'io.modelcontextprotocol/skills': {},
      },
    },
    instructions: [
      'Act as a design director and production planner before creating a new CardForge Template.',
      'For a new design, establish purpose, audience, exact dimensions or physical format, visual direction, copy needs, Studio-editable fields, and an explicit asset inventory with quantities and roles.',
      'Resolve the desired quality target exactly once: simple, professional, or premium. Infer it when the request is clear. If it is not clear and the user has not delegated all creative decisions, ask one concise quality question contrasting a faster native/library-first result with a more image-rich professional or premium result. If the user explicitly delegates all creative decisions without naming a quality target, default to professional. Record the quality target in productionPlan.visualDirection.notes.',
      'Before create_editable_template, inventory every meaningful visual slot for the requested deliverable rather than applying a card-only checklist. Consider hero/main art, background/environment, border/frame, brand/logo/product imagery, supporting imagery, and icons/emblems where relevant. Every slot must intentionally use native structure, a selected CardForge library asset, an editable user image slot, or produced artwork.',
      'When the user selects or supplies a frame, frame image, or frame kit, treat it as the composition skeleton. If it already draws title plates, rules boxes, stat regions, or other visible boundaries, do not recreate those boundaries with redundant bordered text elements or opaque panels. Editable text inside an existing framed region should normally remain transparent and borderless unless another panel is explicitly requested.',
      'For any image the user is expected to replace later, create a native image element and a fieldContract with type image, bind the contract to that element, and include its key in productionPlan.editableFieldKeys. This applies to cards, posters, marketing graphics, reference layouts, and other image-bearing deliverables.',
      'For fixed hero or main artwork, create a native image element with a stable id, target that id from the planned asset, and attach the artwork with binding element.image. Successful upload is not placement proof: preview the Template and verify the intended image element no longer shows placeholder or unrelated artwork.',
      'For professional and premium work, do not silently substitute generic filler shapes for missing high-value imagery and do not use placeholder art unless the user explicitly asks for a placeholder/prototyping stage.',
      'Use get_studio_creation_guide when the workflow or native capabilities are unclear, and search_studio_library before inventing a new asset when CardForge may already have a suitable template, style, font, texture, divider, icon, image, frame, or border.',
      'Before create_editable_template, summarize the production plan to the user and get approval unless the user already explicitly delegated the creative decisions. Record decisionMode confirmed only after approval and delegated only after explicit delegation.',
      'Once a Studio document exists with decisionMode confirmed or delegated, treat its production plan as locked. Do not ask for the same approval, repeat discovery, or restart planning during ordinary copy, layout, style, or artwork revisions. Continue with get_editable_template, update_editable_template, attach_template_artwork, and preview_template_draft. Reopen planning only if the user materially changes purpose, deliverable, output size, quality target, or explicitly requests a new plan.',
      'Use one planned asset requirement per distinct custom image. Keep custom-generated requirements status needed at creation, generate the image, then attach it with attach_template_artwork using the planned requirement id and appropriate native binding.',
      'Use fieldContracts for content the user should be able to edit in Studio, and bind every planned editable field and asset target to stable native element ids.',
      'CardForge embeds attached artwork into the Template itself. Do not resend already attached image bytes during ordinary revisions; keep the same planned asset id and CardForge will preserve the embedded artwork.',
      'Create with native CardForge fields rather than generic design-tool vocabulary. Rich native appearance, typography, image positioning, shape roles, grouping, and physical dimensions are supported.',
      'After creation and after meaningful revisions or artwork changes, call preview_template_draft so the user can visually inspect the exact current CardForge render in chat. Inspect its assetBindings, imageElements, borderedTextElementIds, and warnings; resolve any binding warning before calling the draft finished.',
      'Use get_editable_template and update_editable_template against the current revision when another pass materially improves the design or the user requests changes. Re-preview the same draft until they are satisfied.',
      'Only after visual approval should the user open the Studio link. Opening an agent draft installs or updates the same Template in the user personal local Template library rather than publishing it or creating revision copies.',
      'Never claim a private Template is published. Forge Review and the contribution Pipeline are separate explicit steps.',
    ].join(' '),
    maxSubscriptions: 0,
  },
);

const authenticatedHandler = withMcpAuth(
  handler,
  async (_request, token) => {
    const clerkAuth = await auth({ acceptsToken: 'oauth_token' });
    return verifyClerkToken(clerkAuth, token);
  },
  {
    required: true,
    resourceMetadataPath: '/.well-known/oauth-protected-resource/mcp',
  },
);

export { authenticatedHandler as GET, authenticatedHandler as POST };
