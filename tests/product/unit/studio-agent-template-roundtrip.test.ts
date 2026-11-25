import 'fake-indexeddb/auto';
import { createHash, webcrypto } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TCGCardTemplate } from '@/domain/templates';
import { BROWSER_STORAGE_DATABASE } from '@/features/project/client/persistence-storage';
import { setProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
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
  setProjectPersistenceScope('account:template-roundtrip');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('agent Template Studio round trip', () => {
  it('transfers new artwork directly before saving its content-addressed reference', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const id = createHash('sha256').update(bytes).digest('hex');
    const dataUrl = 'data:image/png;base64,AQIDBA==';
    const withImage: TCGCardTemplate = { ...template, freeformCanvas: { width: 630, height: 880, elements: [{ id: 'art', type: 'image', name: 'Art', x: 0, y: 0, width: 100, height: 100, zIndex: 1, imageSource: dataUrl, content: dataUrl }] } };
    await rememberAgentTemplateLink(template.id!, '11111111-1111-4111-8111-111111111111', 2);
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ document: { id: '11111111-1111-4111-8111-111111111111', title: 'Agent Template', creationSource: 'gpt', revision: 2, document: projectDocument } }))
      .mockResolvedValueOnce(new Response(new Blob([bytes], { type: 'image/png' })))
      .mockResolvedValueOnce(jsonResponse({ upload: { alreadyPresent: false, signedUrl: 'https://storage.example.invalid/private' } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ document: { revision: 3 } }));
    vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('crypto', webcrypto);
    await expect(syncAgentTemplateSave(withImage)).resolves.toEqual({ status: 'synced', revision: 3 });
    expect(fetchMock.mock.calls[2][0]).toContain('/asset-upload');
    expect(JSON.parse(String(fetchMock.mock.calls[2][1].body))).toMatchObject({ id, expectedRevision: 2, size: 4, mimeType: 'image/png' });
    expect(fetchMock.mock.calls[3][0]).toBe('https://storage.example.invalid/private');
    const patch = JSON.parse(String(fetchMock.mock.calls[4][1].body));
    expect(patch.document.userTemplates[0].freeformCanvas.elements[0].imageSource).toBe(`cardforge-studio-asset://${id}`);
  });
  it('reconciles an uncertain upload before saving the linked revision', async () => {
    const dataUrl = 'data:image/png;base64,AQIDBA==';
    const withImage: TCGCardTemplate = { ...template, freeformCanvas: { width: 630, height: 880, elements: [{ id: 'art', type: 'image', name: 'Art', x: 0, y: 0, width: 100, height: 100, zIndex: 1, imageSource: dataUrl, content: dataUrl }] } };
    await rememberAgentTemplateLink(template.id!, '11111111-1111-4111-8111-111111111111', 2);
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ document: { id: '11111111-1111-4111-8111-111111111111', title: 'Agent Template', creationSource: 'gpt', revision: 2, document: projectDocument } }))
      .mockResolvedValueOnce(new Response(new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' })))
      .mockResolvedValueOnce(jsonResponse({ upload: { alreadyPresent: false, signedUrl: 'https://storage.example.invalid/private' } }))
      .mockRejectedValueOnce(new Error('upload acknowledgement lost'))
      .mockResolvedValueOnce(jsonResponse({ upload: { alreadyPresent: true, signedUrl: null } }))
      .mockResolvedValueOnce(jsonResponse({ document: { revision: 3 } }));
    vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('crypto', webcrypto);
    await expect(syncAgentTemplateSave(withImage)).resolves.toEqual({ status: 'synced', revision: 3 });
    expect(fetchMock.mock.calls[4][0]).toContain('/asset-upload');
    expect(fetchMock.mock.calls[5][1]).toMatchObject({ method: 'PATCH' });
  });
  it('reuses the existing private object for unchanged browser artwork', async () => {
    const id = 'a'.repeat(64);
    const withImage = (imageSource: string): TCGCardTemplate => ({ ...template, freeformCanvas: { width: 630, height: 880, elements: [{ id: 'art', type: 'image', name: 'Art', x: 0, y: 0, width: 100, height: 100, zIndex: 1, imageSource, content: imageSource }] } });
    const source = { ...projectDocument, userTemplates: [withImage(`cardforge-studio-asset://${id}`)] };
    await rememberAgentTemplateLink(template.id!, '11111111-1111-4111-8111-111111111111', 2);
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ document: { id: '11111111-1111-4111-8111-111111111111', title: 'Agent Template', creationSource: 'gpt', revision: 2, document: source } })).mockResolvedValueOnce(jsonResponse({ document: { revision: 3 } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(syncAgentTemplateSave(withImage(`cardforge-browser-asset://${id}`))).resolves.toEqual({ status: 'synced', revision: 3 });
    const payload = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(payload.document.userTemplates[0].freeformCanvas.elements[0].imageSource).toBe(`cardforge-studio-asset://${id}`);
  });

  it('only discovers and syncs an agent document in an account workspace without conflating document and Template revisions', async () => {
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

    for (const scope of ['guest', 'local'] as const) {
      setProjectPersistenceScope(scope);
      await expect(syncAgentTemplateSave(template)).resolves.toEqual({ status: 'unlinked' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
    setProjectPersistenceScope('account:template-roundtrip');

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
    });
    expect(body.document.userTemplates[0]?.templateRevision).toBe(template.templateRevision);
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
