import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TCGCardTemplate } from '@/domain/templates';

const storeMocks = vi.hoisted(() => ({
  getStudioDocument: vi.fn(),
  updateStudioDocument: vi.fn(),
}));

vi.mock('@/features/studio-documents/server/studioDocumentAccess', () => ({
  getStudioDocumentRetentionHours: vi.fn(async () => 24),
}));
vi.mock('@/features/studio-documents/server/studioDocumentStore', () => storeMocks);
vi.mock('@/features/studio-documents/server/mcpArtworkSources', () => ({
  createMcpArtworkOperationBudget: vi.fn(() => ({ consumeRemoteBytes: vi.fn() })),
  normalizeMcpArtworkSource: vi.fn(),
}));

import {
  getCardGenerationContract,
  upsertWorkingCards,
} from '@/features/studio-documents/server/cardSetWorkingDocuments';

const template = (id: string, fieldKey: string): TCGCardTemplate => ({
  id,
  name: id,
  aspectRatio: '63:88',
  templateSource: 'user',
  templateLineageId: id,
  templateRevision: 1,
  templateRevisionId: `${id}-r1`,
  fieldContracts: [{ key: fieldKey, type: 'text', required: true }],
  freeformCanvas: {
    width: 630,
    height: 880,
    elements: [{ id: `${id}-field`, type: 'text', name: fieldKey, x: 20, y: 20, width: 200, height: 40, zIndex: 1, content: `{{${fieldKey}:"${fieldKey}"}}` }],
  },
});

const makeCurrent = (templateIds = ['template-a', 'template-b']) => ({
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Multi-template Set',
  creationSource: 'gpt' as const,
  revision: 10,
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
  document: {
    version: 1 as const,
    userTemplates: [template('template-a', 'name'), template('template-b', 'title')],
    cardSets: [{ id: 'set-1', name: 'Set One', templateIds }],
    activeCardSetId: 'set-1',
    storedCards: [{
      uniqueId: 'card-a',
      templateId: 'template-a',
      backingTemplateId: null,
      setId: 'set-1',
      setName: 'Set One',
      data: { name: 'Existing' },
    }],
    appearanceStyles: [],
    exportSettings: {},
    customAssets: {
      'cardforge-maker-custom-textures': [],
      'cardforge-maker-custom-dividers': [],
      'cardforge-maker-custom-icons': [],
      'cardforge-maker-custom-images': [],
    },
  },
});

const access = {
  user: { id: 'user-1' },
  capabilities: ['studio.ai.create'],
} as unknown as Parameters<typeof getCardGenerationContract>[0]['access'];

beforeEach(() => {
  storeMocks.getStudioDocument.mockReset();
  storeMocks.updateStudioDocument.mockReset();
  storeMocks.getStudioDocument.mockResolvedValue(makeCurrent());
  storeMocks.updateStudioDocument.mockImplementation(async (args: {
    expectedRevision: number;
    documentId: string;
    title: string;
    document: ReturnType<typeof makeCurrent>['document'];
  }) => ({
    ...makeCurrent(),
    id: args.documentId,
    title: args.title,
    revision: args.expectedRevision + 1,
    document: args.document,
  }));
});

describe('MCP Template generation authority', () => {
  it('requires an explicit front Template when a Set references more than one design', async () => {
    await expect(getCardGenerationContract({
      access,
      documentId: makeCurrent().id,
      setId: 'set-1',
    })).rejects.toThrow(/choose templateId explicitly/i);
  });

  it('returns the exact requested Template contract instead of a representative card contract', async () => {
    const contract = await getCardGenerationContract({
      access,
      documentId: makeCurrent().id,
      setId: 'set-1',
      templateId: 'template-b',
      backingTemplateId: null,
    });
    expect(contract.frontTemplateId).toBe('template-b');
    expect(contract.frontFields.map((field) => field.key)).toContain('title');
    expect(contract.frontFields.map((field) => field.key)).not.toContain('name');
  });

  it('uses a new card explicit Template and keeps the Set reference', async () => {
    const result = await upsertWorkingCards({
      access,
      documentId: makeCurrent().id,
      expectedRevision: 10,
      setId: 'set-1',
      writeMode: 'create',
      cards: [{ cardId: 'card-b', templateId: 'template-b', backingTemplateId: null, data: { title: 'New' } }],
    });
    const created = result.document.document.storedCards.find((card) => card.uniqueId === 'card-b');
    expect(created?.templateId).toBe('template-b');
    expect(result.set.templateIds).toEqual(expect.arrayContaining(['template-a', 'template-b']));
  });

  it('preserves an existing Artifact Template and rejects implicit retargeting through data edit', async () => {
    await expect(upsertWorkingCards({
      access,
      documentId: makeCurrent().id,
      expectedRevision: 10,
      setId: 'set-1',
      writeMode: 'revise',
      cards: [{ cardId: 'card-a', templateId: 'template-b', data: { name: 'Still A' } }],
    })).rejects.toThrow(/preserve design identity/i);
    expect(storeMocks.updateStudioDocument).not.toHaveBeenCalled();
  });

  it('uses a single explicit Set Template reference without asking again', async () => {
    storeMocks.getStudioDocument.mockResolvedValue(makeCurrent(['template-b']));
    const contract = await getCardGenerationContract({
      access,
      documentId: makeCurrent().id,
      setId: 'set-1',
    });
    expect(contract.frontTemplateId).toBe('template-b');
  });
});