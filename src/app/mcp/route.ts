import { verifyClerkToken } from '@clerk/mcp-tools/next';
import { auth } from '@clerk/nextjs/server';
import { createMcpHandler, withMcpAuth } from 'mcp-handler';

import {
  CARDFORGE_FREEFORM_ELEMENT_TYPES,
  CARDFORGE_FREEFORM_SHAPE_KINDS,
} from '@/domain/templates';
import {
  PROJECT_ASSET_REQUIREMENT_SOURCES,
  PROJECT_ASSET_REQUIREMENT_STATUSES,
  PROJECT_PRODUCTION_DECISION_MODES,
  summarizeProjectProductionAssets,
} from '@/features/project/server';
import {
  DeveloperCockpitAccessError,
  getDeveloperCockpitAccessForUserId,
} from '@/features/developer-access/server';
import {
  continueDeveloperTemplateDraftInPipeline,
  createDeveloperTemplateDraft,
  getDeveloperTemplateDraft,
  gptTemplateDraftInputSchema,
  listDeveloperTemplateDrafts,
  searchStudioCreationLibrary,
  StudioDocumentStoreError,
  updateDeveloperTemplateDraft,
} from '@/features/studio-documents/server';
import {
  createTemplateInputSchema,
  documentIdInputSchema,
  pipelineInputSchema,
  searchStudioLibraryInputSchema,
  updateTemplateInputSchema,
} from '@/features/studio-documents/server/mcpToolInputSchemas';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

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

const omitEmbeddedMediaForChat = (value: unknown): unknown => {
  if (typeof value === 'string') {
    if (value.startsWith('data:')) return '[embedded media omitted; open this draft in CardForge Studio]';
    return value.length > 4000 ? `${value.slice(0, 4000)}…` : value;
  }
  if (Array.isArray(value)) return value.map(omitEmbeddedMediaForChat);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, omitEmbeddedMediaForChat(entry)]),
    );
  }
  return value;
};

const getMcpDeveloperAccess = async () => {
  const clerkAuth = await auth({ acceptsToken: 'oauth_token' });
  if (!clerkAuth.userId) {
    throw new DeveloperCockpitAccessError('A linked CardForge account is required.', 401);
  }
  return getDeveloperCockpitAccessForUserId(clerkAuth.userId);
};

const toolError = (error: unknown) => {
  const message = error instanceof DeveloperCockpitAccessError
    || error instanceof StudioDocumentStoreError
    || error instanceof RateLimitUnavailableError
    ? error.message
    : 'CardForge could not complete that action.';
  if (!(error instanceof DeveloperCockpitAccessError)
    && !(error instanceof StudioDocumentStoreError)
    && !(error instanceof RateLimitUnavailableError)) {
    console.error('CardForge MCP tool failed:', error);
  }
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
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

const documentStructuredContent = (document: Awaited<ReturnType<typeof createDeveloperTemplateDraft>>) => {
  const productionPlan = document.document.productionPlan;
  return {
    document: {
      id: document.id,
      title: document.title,
      creationSource: document.creationSource,
      revision: document.revision,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    },
    productionPlan: productionPlan ? {
      decisionMode: productionPlan.decisionMode,
      outputSize: productionPlan.outputSize,
      editableFieldCount: productionPlan.editableFieldKeys.length,
      assetSummary: summarizeProjectProductionAssets(productionPlan),
    } : null,
    openInStudioUrl: studioDocumentUrl(document.id),
  };
};

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'get_studio_creation_guide',
      {
        title: 'Get the CardForge creation workflow',
        description: 'Read CardForge native authoring capabilities and the recommended conversation-to-Studio workflow before planning a new design.',
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async () => {
        try {
          await getMcpDeveloperAccess();
          const structuredContent = {
            workflow: [
              'Establish the purpose, audience, deliverable, and exact output dimensions or physical format.',
              'Agree on visual direction: look and feel, palette, typography, hierarchy, and copy/content needs.',
              'Define every Studio-editable field and bind it through native fieldContracts to a real canvas element.',
              'Inventory assets with quantities and roles. Search the CardForge library before asking for new art.',
              'Show the production plan to the user and use decisionMode confirmed after approval, or delegated only when the user explicitly delegated creative decisions.',
              'Create the native editable Template, inspect the resulting Studio document, and revise the same document when a stronger pass is useful.',
              'Open the finished private project in CardForge Studio for visual inspection and manual editing.',
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
              customArtRule: 'Do not claim custom-generated media is attached unless a usable assetUrl exists. Keep it needed, or use an explicit placeholder, until it can actually be bound.',
            },
            quality: {
              nativeEditableFeatures: [
                'physical trim dimensions and custom canvas sizes',
                'field contracts and generator-editable fields',
                'materials, gradients, textures, borders, glow, bevel, and shadow',
                'shape roles and native shape kinds',
                'image fit, position, scale, offset, and rotation',
                'font family, pixel sizing, alignment, transforms, decoration, and auto-fit',
                'grouping through parentId, visibility, locking, rotation, and layer order',
              ],
            },
          };
          return {
            content: [{ type: 'text', text: 'CardForge creation workflow loaded. Plan the artifact and its asset inventory before creating the Studio document.' }],
            structuredContent,
          };
        } catch (error) {
          return toolError(error);
        }
      },
    );

    server.registerTool(
      'search_studio_library',
      {
        title: 'Search the CardForge Studio library',
        description: 'Search CardForge templates, styles, fonts, textures, dividers, icons, and images while planning a design. Prefer reusing suitable library assets before inventing new ones.',
        inputSchema: searchStudioLibraryInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async ({ query, kinds, limit }) => {
        try {
          await getMcpDeveloperAccess();
          const items = await searchStudioCreationLibrary({ query, kinds, limit });
          return {
            content: [{ type: 'text', text: `Found ${items.length} CardForge creation librar${items.length === 1 ? 'y item' : 'y items'}.` }],
            structuredContent: { items },
          };
        } catch (error) {
          return toolError(error);
        }
      },
    );

    server.registerTool(
      'create_editable_template',
      {
        title: 'Create a planned editable CardForge Template',
        description: 'Create one private, high-fidelity CardForge Template after planning its purpose, dimensions, visual direction, editable fields, and asset inventory with the user. productionPlan is required and must truthfully record confirmed user approval or explicit creative delegation. Use native Studio fields so the result remains editable.',
        inputSchema: createTemplateInputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async (input) => {
        try {
          const access = await getMcpDeveloperAccess();
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
              text: `Created "${document.title}" as a private editable Studio Template with ${assetSummary.totalAssetInstances} planned asset instance${assetSummary.totalAssetInstances === 1 ? '' : 's'}; ${assetSummary.neededInstances} still need production or selection.`,
            }],
            structuredContent: documentStructuredContent(document),
          };
        } catch (error) {
          return toolError(error);
        }
      },
    );

    server.registerTool(
      'update_editable_template',
      {
        title: 'Revise an editable CardForge Template',
        description: 'Revise the same private Studio document after inspecting it or discussing changes. Load the document first, preserve its CardForge identity, send the current expectedRevision, and update the rich native Template plus its production plan.',
        inputSchema: updateTemplateInputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async ({ documentId, expectedRevision, ...draftInput }) => {
        try {
          const access = await getMcpDeveloperAccess();
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
            content: [{ type: 'text', text: `Revised "${document.title}" to Studio document revision ${document.revision}.` }],
            structuredContent: documentStructuredContent(document),
          };
        } catch (error) {
          return toolError(error);
        }
      },
    );

    server.registerTool(
      'list_editable_templates',
      {
        title: 'List editable CardForge Templates',
        description: 'List private Studio documents in the linked developer account so the user can choose one without guessing an id.',
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async () => {
        try {
          const access = await getMcpDeveloperAccess();
          const documents = await listDeveloperTemplateDrafts(access);
          return {
            content: [{ type: 'text', text: `Found ${documents.length} private Studio document${documents.length === 1 ? '' : 's'}.` }],
            structuredContent: { documents },
          };
        } catch (error) {
          return toolError(error);
        }
      },
    );

    server.registerTool(
      'get_editable_template',
      {
        title: 'Get an editable CardForge Template',
        description: 'Load one private Studio document, including its native editable Template and production plan, before discussing or revising it.',
        inputSchema: documentIdInputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async ({ documentId }) => {
        try {
          const access = await getMcpDeveloperAccess();
          const document = await getDeveloperTemplateDraft(access, documentId);
          const result = {
            document: omitEmbeddedMediaForChat(document),
            openInStudioUrl: studioDocumentUrl(document.id),
          };
          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          };
        } catch (error) {
          return toolError(error);
        }
      },
    );

    server.registerTool(
      'continue_template_in_pipeline',
      {
        title: 'Continue a Template in Forge Review',
        description: 'Create a developer Pipeline draft from a private Studio Template, then return Forge Review. This is separate from creative planning and does not publish the Template.',
        inputSchema: pipelineInputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async ({ documentId, templateId }) => {
        try {
          const access = await getMcpDeveloperAccess();
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
        } catch (error) {
          return toolError(error);
        }
      },
    );
  },
  {
    serverInfo: { name: 'cardforge-studio', version: '0.2.0' },
    instructions: [
      'Act as a design director and production planner before creating a new CardForge Template.',
      'For a new design, establish purpose, audience, exact dimensions or physical format, visual direction, copy needs, Studio-editable fields, and an explicit asset inventory with quantities and roles.',
      'Use get_studio_creation_guide when the workflow or native capabilities are unclear, and search_studio_library before inventing a new asset when CardForge may already have a suitable template, style, font, texture, divider, icon, or image.',
      'Before create_editable_template, summarize the production plan to the user and get approval unless the user already explicitly delegated the creative decisions. Record decisionMode confirmed only after approval and delegated only after explicit delegation.',
      'Use fieldContracts for content the user should be able to edit in Studio, and bind every planned editable field and asset target to stable native element ids.',
      'Do not claim custom-generated art, backgrounds, borders, or other media are attached unless a usable assetUrl is actually available. Keep unresolved custom media status needed, or use an explicit placeholder, until it can be bound.',
      'Create with native CardForge fields rather than generic design-tool vocabulary. Rich native appearance, typography, image positioning, shape roles, grouping, and physical dimensions are supported.',
      'After creation, inspect the result with get_editable_template. Use update_editable_template against the current revision when another pass materially improves the design or the user requests changes.',
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
