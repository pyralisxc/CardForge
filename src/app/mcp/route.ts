import { verifyClerkToken } from '@clerk/mcp-tools/next';
import { auth } from '@clerk/nextjs/server';
import { fromJsonSchema } from '@modelcontextprotocol/server';
import { createMcpHandler, withMcpAuth } from 'mcp-handler';

import {
  CARDFORGE_FREEFORM_ELEMENT_TYPES,
  CARDFORGE_FREEFORM_SHAPE_KINDS,
} from '@/domain/templates';
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
  StudioDocumentStoreError,
} from '@/features/studio-documents/server';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const createTemplateInputSchema = fromJsonSchema({
  type: 'object',
  additionalProperties: false,
  required: ['title', 'template'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 160 },
    template: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'aspectRatio'],
      properties: {
        id: { type: ['string', 'null'], maxLength: 255 },
        name: { type: 'string', minLength: 1, maxLength: 160 },
        aspectRatio: { type: 'string', minLength: 1, maxLength: 40 },
        baseBackgroundColor: { type: 'string', maxLength: 255 },
        baseTextColor: { type: 'string', maxLength: 255 },
        cardBackgroundImageUrl: { type: 'string', maxLength: 20000 },
        cardBorderColor: { type: 'string', maxLength: 255 },
        cardBorderWidth: { type: 'string', maxLength: 100 },
        cardBorderStyle: { type: 'string', maxLength: 100 },
        cardBorderRadius: { type: 'string', maxLength: 100 },
        freeformCanvas: {
          type: 'object',
          additionalProperties: false,
          required: ['width', 'height', 'elements'],
          properties: {
            width: { type: 'number', minimum: 1, maximum: 5000 },
            height: { type: 'number', minimum: 1, maximum: 5000 },
            elements: {
              type: 'array',
              maxItems: 200,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['type'],
                properties: {
                  id: { type: 'string', minLength: 1, maxLength: 255 },
                  type: { type: 'string', enum: [...CARDFORGE_FREEFORM_ELEMENT_TYPES] },
                  name: { type: 'string', minLength: 1, maxLength: 160 },
                  x: { type: 'number' },
                  y: { type: 'number' },
                  width: { type: 'number', exclusiveMinimum: 0 },
                  height: { type: 'number', exclusiveMinimum: 0 },
                  rotation: { type: 'number' },
                  opacity: { type: 'number', minimum: 0, maximum: 1 },
                  zIndex: { type: 'number' },
                  locked: { type: 'boolean' },
                  content: { type: 'string', maxLength: 20000 },
                  imageSource: { type: 'string', maxLength: 20000 },
                  iconImageSource: { type: 'string', maxLength: 20000 },
                  iconName: { type: 'string', maxLength: 255 },
                  shapeKind: { type: 'string', enum: [...CARDFORGE_FREEFORM_SHAPE_KINDS] },
                  textColor: { type: 'string', maxLength: 255 },
                  backgroundColor: { type: 'string', maxLength: 255 },
                  backgroundImageUrl: { type: 'string', maxLength: 20000 },
                  fontFamily: { type: 'string', maxLength: 255 },
                  fontSize: {
                    type: 'string',
                    enum: ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'],
                  },
                  fontSizePx: { type: 'number', exclusiveMinimum: 0, maximum: 1000 },
                  fontWeight: {
                    type: 'string',
                    enum: ['font-normal', 'font-medium', 'font-semibold', 'font-bold'],
                  },
                  textAlign: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
                  fontStyle: { type: 'string', enum: ['normal', 'italic'] },
                  letterSpacing: { type: 'string', maxLength: 100 },
                  lineHeight: { type: 'string', maxLength: 100 },
                  padding: { type: 'string', maxLength: 100 },
                  borderColor: { type: 'string', maxLength: 255 },
                  borderWidth: { type: 'string', maxLength: 100 },
                  borderRadius: { type: 'string', maxLength: 100 },
                  minHeight: { type: 'string', maxLength: 100 },
                  imageObjectFit: { type: 'string', enum: ['cover', 'contain', 'fill', 'none'] },
                  fillColor: { type: 'string', maxLength: 255 },
                  strokeColor: { type: 'string', maxLength: 255 },
                  strokeWidth: { type: 'number', minimum: 0, maximum: 100 },
                },
              },
            },
          },
        },
      },
    },
  },
});

const documentIdInputSchema = fromJsonSchema<{ documentId: string }>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId'],
  properties: {
    documentId: { type: 'string', format: 'uuid' },
  },
});

const pipelineInputSchema = fromJsonSchema<{ documentId: string; templateId?: string }>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId'],
  properties: {
    documentId: { type: 'string', format: 'uuid' },
    templateId: { type: 'string', minLength: 1 },
  },
});

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

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'create_editable_template',
      {
        title: 'Create an editable CardForge Template',
        description: 'Create a private editable Template using CardForge native canvas fields only. Element types are text, image, icon, or shape; use shapeKind for shapes and content for text.',
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
          const validation = gptTemplateDraftInputSchema.safeParse(input);
          if (!validation.success) {
            throw new StudioDocumentStoreError('The editable Template uses unsupported CardForge fields or values.', 409);
          }
          const document = await createDeveloperTemplateDraft(access, validation.data);
          const structuredContent = {
            document: {
              id: document.id,
              title: document.title,
              creationSource: document.creationSource,
              revision: document.revision,
              createdAt: document.createdAt,
              updatedAt: document.updatedAt,
            },
            openInStudioUrl: studioDocumentUrl(document.id),
          };
          return {
            content: [{ type: 'text', text: `Created "${document.title}" as a private editable Studio Template.` }],
            structuredContent,
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
        description: 'Load one private Studio document, including its editable Template data, before discussing or changing it.',
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
        description: 'Create a developer Pipeline draft from a private Studio Template, then return the Forge Review page where missing description, preview, and tags must be completed by the developer.',
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
    serverInfo: { name: 'cardforge-studio', version: '0.1.0' },
    instructions: 'Create private editable Templates using CardForge native canvas fields only. Elements must use type text, image, icon, or shape; shapes use shapeKind and text uses content. Never claim a Template is published. Before a Pipeline handoff, identify the exact Studio document and Template; leave missing review metadata for the developer in Forge Review.',
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
