import { fromJsonSchema } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'mcp-handler';

import type { DeveloperCockpitAccess } from '@/features/developer-access/server';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import {
  PERSONAL_LIBRARY_ROLES,
  type PersonalLibraryRole,
} from '../model';
import {
  listPersonalLibraryItems,
  PersonalLibraryStoreError,
} from './personalLibraryStore';

interface SearchPersonalLibraryInput {
  query?: string;
  role?: PersonalLibraryRole;
  limit?: number;
}

const searchInputSchema = fromJsonSchema<SearchPersonalLibraryInput>({
  type: 'object',
  additionalProperties: false,
  properties: {
    query: {
      type: 'string',
      maxLength: 160,
      description: 'Optional case-insensitive name search. Omit to browse recent authorized personal-library items.',
    },
    role: {
      type: 'string',
      enum: [...PERSONAL_LIBRARY_ROLES],
      description: 'Optional CardForge semantic asset role.',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 50,
      description: 'Maximum matching items to return. Defaults to 20.',
    },
  },
});

const outputSchema = fromJsonSchema({
  type: 'object',
  additionalProperties: false,
  required: ['query', 'role', 'count', 'items', 'usageNote'],
  properties: {
    query: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    role: { anyOf: [{ type: 'string', enum: [...PERSONAL_LIBRARY_ROLES] }, { type: 'null' }] },
    count: { type: 'integer', minimum: 0 },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['itemId', 'provider', 'displayName', 'role', 'mimeType', 'byteSize', 'providerRevision', 'contentHash'],
        properties: {
          itemId: { type: 'string' },
          provider: { type: 'string', enum: ['google-drive'] },
          displayName: { type: 'string' },
          role: { type: 'string', enum: [...PERSONAL_LIBRARY_ROLES] },
          mimeType: { type: 'string' },
          byteSize: { type: 'number', minimum: 0 },
          providerRevision: { type: 'string' },
          contentHash: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
      },
    },
    usageNote: { type: 'string' },
  },
});

type RegistrationCallback = Parameters<typeof createMcpHandler>[0];
type McpRegistrationServer = Parameters<RegistrationCallback>[0];
type ToolErrorResult = {
  isError: boolean;
  content: Array<{ type: 'text'; text: string }>;
  _meta?: Record<string, unknown>;
};

export const registerPersonalLibraryTools = ({
  server,
  getAccess,
  toolError,
}: {
  server: McpRegistrationServer;
  getAccess: () => Promise<DeveloperCockpitAccess>;
  toolError: (error: unknown) => ToolErrorResult;
}) => {
  server.registerTool(
    'search_personal_library',
    {
      title: 'Search the user’s CardForge personal library',
      description: 'Find reusable artwork, frames, textures, dividers, icons, fonts, and reference images the linked CardForge user explicitly authorized from connected storage. Returns metadata only; provider credentials and file bytes never enter model context.',
      inputSchema: searchInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ query, role, limit }) => {
      try {
        const access = await getAccess();
        if (!access.entitlement.isSignedIn || !access.entitlement.accountUserId) {
          throw new PersonalLibraryStoreError('A linked CardForge account is required to search the personal library.', 401, { kind: 'authentication' });
        }
        return await observeMcpToolExecution({
          ownerUserId: access.user.id,
          toolName: 'search_personal_library',
          input: { query, role, limit },
          execute: async () => {
            const library = await listPersonalLibraryItems(access.entitlement.accountUserId!);
            const normalizedQuery = query?.trim().toLowerCase() || null;
            const maximum = Math.min(50, Math.max(1, limit ?? 20));
            const matches = library.items
              .filter((item) => !role || item.role === role)
              .filter((item) => !normalizedQuery || item.displayName.toLowerCase().includes(normalizedQuery))
              .slice(0, maximum)
              .map((item) => ({
                itemId: item.id,
                provider: item.provider,
                displayName: item.displayName,
                role: item.role,
                mimeType: item.mimeType,
                byteSize: item.byteSize,
                providerRevision: item.providerRevision,
                contentHash: item.contentHash,
              }));
            const structuredContent = {
              query: normalizedQuery,
              role: role ?? null,
              count: matches.length,
              items: matches,
              usageNote: 'These are provider-backed references. Search does not download their bytes. A later explicit CardForge materialization/attach action must copy a selected asset into a project or temporary AI workspace before that asset becomes part of a portable project.',
            };
            return {
              content: [{
                type: 'text',
                text: matches.length
                  ? `Found ${matches.length} matching personal-library item${matches.length === 1 ? '' : 's'}.`
                  : 'No matching personal-library items were found.',
              }],
              structuredContent,
            };
          },
        });
      } catch (error) {
        if (error instanceof PersonalLibraryStoreError) {
          return { isError: true, content: [{ type: 'text', text: error.message }] };
        }
        return toolError(error);
      }
    },
  );
};
