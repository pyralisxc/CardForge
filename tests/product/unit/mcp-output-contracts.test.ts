import { describe, expect, it } from 'vitest';

import * as studioOutputSchemas from '@/features/studio-documents/server/mcpToolOutputSchemas';
import * as workingDocumentOutputSchemas from '@/features/studio-documents/server/mcpWorkingDocumentOutputSchemas';
import { personalLibrarySearchOutputSchema } from '@/features/personal-library/server/mcpPersonalLibrarySchemas';
import {
  connectedProjectListOutputSchema,
  checkoutProjectOutputSchema,
  commitProjectOutputSchema,
} from '@/features/studio-documents/server/mcpProjectSourceSchemas';

type StandardSchema = {
  '~standard': {
    validate: (value: unknown) => PromiseLike<{ value?: unknown; issues?: Array<{ message: string }> }> | { value?: unknown; issues?: Array<{ message: string }> };
  };
};

const validate = async (schema: unknown, value: unknown) => (
  (schema as StandardSchema)['~standard'].validate(value)
);

const project = {
  provider: 'google-drive',
  fileId: 'drive-file-123',
  workId: 'work-12345678',
  name: 'My Cards.cardforge',
  providerRevision: '7',
  projectRevision: 'a'.repeat(64),
  modifiedAt: '2026-09-02T12:00:00.000Z',
  size: 2048,
  webViewLink: 'https://drive.google.com/file/d/drive-file-123/view',
};

describe('MCP structured output contracts', () => {
  it('never requires a property that its JSON schema does not define', () => {
    const schemas = {
      ...studioOutputSchemas,
      ...workingDocumentOutputSchemas,
      connectedProjectListOutputSchema,
      checkoutProjectOutputSchema,
      commitProjectOutputSchema,
      personalLibrarySearchOutputSchema,
    } as unknown as Record<string, StandardSchema>;

    for (const [name, schema] of Object.entries(schemas)) {
      const jsonSchema = (schema['~standard'] as unknown as {
        jsonSchema: { required?: string[]; properties?: Record<string, unknown> };
      }).jsonSchema;
      expect(
        jsonSchema.required?.filter((key) => !(key in (jsonSchema.properties ?? {}))) ?? [],
        name,
      ).toEqual([]);
    }
  });

  it('accepts the capabilities payload returned by get_cardforge_capabilities', async () => {
    const result = await validate(studioOutputSchemas.accountCapabilitiesOutputSchema, {
      account: { tier: 'free' },
      studio: { canCreate: true },
      contribution: { scopes: [] },
      guidance: { normalCustomerTools: [] },
    });

    expect(result.issues).toBeUndefined();
  });

  it('accepts the full install-state payload returned by get_agent_install_status', async () => {
    const result = await validate(studioOutputSchemas.agentInstallStatusOutputSchema, {
      documentId: 'a7e209ae-ea44-43ae-a2cb-718a972beef4',
      title: 'CardForge Marketing Showcase Template',
      revision: 5,
      lastInstalledRevision: null,
      lastInstalledAt: null,
      lastInstallSummary: null,
      currentRevisionApplied: false,
      installPending: true,
      requiresExplicitStudioApply: true,
      openInStudioUrl: 'https://cardforges.com/studio?document=a7e209ae-ea44-43ae-a2cb-718a972beef4&revision=5',
    });

    expect(result.issues).toBeUndefined();
  });

  it('accepts stable Drive work identity in list, checkout, and commit responses', async () => {
    const connection = {
      provider: 'google-drive',
      configured: true,
      connected: true,
      displayName: 'Reviewer Drive',
      rootFolderId: 'folder-12345678',
      status: 'active',
      statusNote: null,
      lastVerifiedAt: '2026-09-02T12:00:00.000Z',
    };
    const cases: Array<[unknown, unknown]> = [
      [connectedProjectListOutputSchema, {
        connection,
        projects: [project],
        localProjectNote: 'Browser-only projects are not remotely readable.',
      }],
      [checkoutProjectOutputSchema, {
        source: project,
        documentId: 'a7e209ae-ea44-43ae-a2cb-718a972beef4',
        documentRevision: 1,
        openInStudioUrl: 'https://cardforges.com/studio?document=a7e209ae-ea44-43ae-a2cb-718a972beef4&revision=1',
        nextActions: [{ action: 'preview_card_set', reason: 'Review first.' }],
      }],
      [commitProjectOutputSchema, {
        source: { ...project, providerRevision: '8' },
        documentId: 'a7e209ae-ea44-43ae-a2cb-718a972beef4',
        documentRevision: 2,
        previousProviderRevision: '7',
        previousProjectRevision: 'a'.repeat(64),
      }],
    ];

    for (const [schema, payload] of cases) {
      expect((await validate(schema, payload)).issues).toBeUndefined();
    }
  });

  it('accepts the personal-library search payload returned by search_personal_library', async () => {
    const result = await validate(personalLibrarySearchOutputSchema, {
      query: 'frame',
      role: 'frame',
      count: 1,
      items: [{
        itemId: 'item-123',
        provider: 'google-drive',
        displayName: 'Bronze Frame.png',
        role: 'frame',
        mimeType: 'image/png',
        byteSize: 1024,
        providerRevision: '4',
        contentHash: null,
      }],
      usageNote: 'Materialize the selected provider-backed item before use.',
    });

    expect(result.issues).toBeUndefined();
  });
});
