import { verifyClerkToken } from '@clerk/mcp-tools/next';
import { auth } from '@clerk/nextjs/server';
import { fromJsonSchema } from '@modelcontextprotocol/server';
import { createMcpHandler, withMcpAuth } from 'mcp-handler';

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
      additionalProperties: true,
      required: ['name', 'aspectRatio'],
      properties: {
        id: { type: ['string', 'null'], maxLength: 255 },
        name: { type: 'string', minLength: 1, maxLength: 160 },
        aspectRatio: { type: 'string', minLength: 1, maxLength: 40 },
        freeformCanvas: {
          type: 'object',
          additionalProperties: true,
          required: ['width', 'height', 'elements'],
          properties: {
            width: { type: 'number', minimum: 1, maximum: 5000 },
            height: { type: 'number', minimum: 1, maximum: 5000 },
            elements: {
              type: 'array',
              maxItems: 200,
              items: { type: 'object', additionalProperties: true },
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
        description: 'Create a private, editable Template in the linked developer account. Use only details the user supplied; do not invent publishing metadata.',
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
            throw new StudioDocumentStoreError('The editable Template description is invalid.', 409);
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
            openInStudioUrl: absoluteUrl(`/studio?document=${encodeURIComponent(document.id)}`),
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
            openInStudioUrl: absoluteUrl(`/studio?document=${encodeURIComponent(document.id)}`),
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
    instructions: 'Create private editable Templates first. Never claim a Template is published. Before a Pipeline handoff, identify the exact Studio document and Template; leave missing review metadata for the developer in Forge Review.',
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
