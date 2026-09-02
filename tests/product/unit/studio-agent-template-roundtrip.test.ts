import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TCGCardTemplate } from '@/domain/templates';
import { BROWSER_STORAGE_DATABASE } from '@/features/project/client/persistence-storage';
import {
  getAgentTemplateLink,
  rememberAgentTemplateLink,
  syncAgentTemplateSave,
} from '@/features/studio-documents/lib/agentTemplateRoundTrip';

const deleteDatabase = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase(BROWSER_STORAGE_DATABASE);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
});

const template: TCGCardTemplate = {
  id: 'gpt-template-1',
  name: 'Agent Template',
  aspectRatio: '63:88',
  templateSource: 'user',
  templateLibrarySource: 'personal',
  freeformCanvas: {
    width: 630,
    height: 880,
    elements: [],
  },
};

const projectDocument = {
  version: 1 as const,
  userTemplates: [template],
  cardSets: [{
    id: 'active-card-set',
    name: 'Untitled Set',
  }],
  activeCardSetId: 'active-card-set',
  storedCards: [],
  appearanceStyles: [],
  exportSettings: {},
  customAssets: {
    'cardforge-maker-custom-textures': [],
    'cardforge-maker-custom-dividers': [],
    'cardforge-maker-custom-icons': [],
    'cardforge-maker-custom-images': [],
  },
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

beforeEach(async () => {
  await deleteDatabase();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('agent Template Studio round trip', () => {
  it('discovers an existing agent document and syncs an explicit Studio save back to it', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        documents: [{
          id: '11111111-1111-4111-8111-111111111111',
          creationSource: 'gpt',
          revision: 2,
          updatedAt: '2026-08-20T08:00:00.000Z',
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        document: {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Agent Template',
          creationSource: 'gpt',
          revision: 2,
          document: projectDocument,
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        document: {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Agent Template',
          creationSource: 'gpt',
          revision: 2,
          document: projectDocument,
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        document: { revision: 3 },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncAgentTemplateSave({
      ...template,
      name: 'Saved in Studio',
    });

    expect(result).toEqual({ status: 'synced', revision: 3 });
    await expect(getAgentTemplateLink(template.id!)).resolves.toEqual({
      documentId: '11111111-1111-4111-8111-111111111111',
      revision: 3,
    });
    const patchCall = fetchMock.mock.calls[3];
    expect(patchCall[0]).toBe('/api/studio-documents/11111111-1111-4111-8111-111111111111');
    expect(patchCall[1]).toMatchObject({ method: 'PATCH' });
    const body = JSON.parse(String(patchCall[1]?.body)) as {
      expectedRevision: number;
      document: { userTemplates: TCGCardTemplate[] };
    };
    expect(body.expectedRevision).toBe(2);
    expect(body.document.userTemplates[0]).toMatchObject({
      id: template.id,
      name: 'Saved in Studio',
      templateRevision: 3,
    });
  });

  it('protects a newer ChatGPT revision from an older Studio save', async () => {
    await rememberAgentTemplateLink(template.id!, '22222222-2222-4222-8222-222222222222', 4);
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      document: {
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Agent Template',
        creationSource: 'gpt',
        revision: 5,
        document: projectDocument,
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncAgentTemplateSave(template);

    expect(result).toEqual({ status: 'conflict', revision: 5 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(getAgentTemplateLink(template.id!)).resolves.toEqual({
      documentId: '22222222-2222-4222-8222-222222222222',
      revision: 4,
    });
  });
});
