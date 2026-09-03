import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveTemplateCardFormat } from '@/domain/card-formats';
import { normalizeTemplateFieldContracts } from '@/domain/templates/fieldContracts';
import type { TCGCardTemplate } from '@/domain/templates';
import { normalizeEmbeddedTemplateAsset } from '@/features/studio-documents/server/embeddedTemplateAssets';

const storeMocks = vi.hoisted(() => ({
  getStudioDocument: vi.fn(),
  updateStudioDocument: vi.fn(),
}));
const artworkMocks = vi.hoisted(() => ({
  normalizeMcpArtworkSource: vi.fn(async () => ({
    dataUri: 'data:image/webp;base64,V0VCUA==',
    bytes: Buffer.from('WEBP'),
    width: 16,
    height: 16,
    byteCount: 4,
  })),
}));

vi.mock('@/features/contributor-access/server', () => ({
  requireContributionScope: vi.fn(),
}));
vi.mock('@/features/studio-documents/server/studioDocumentAccess', () => ({
  getStudioDocumentRetentionHours: vi.fn(async () => 24),
}));
vi.mock('@/features/studio-documents/server/studioDocumentStore', () => storeMocks);
vi.mock('@/features/studio-documents/server/mcpArtworkSources', () => ({
  createMcpArtworkOperationBudget: vi.fn(() => ({ consumeRemoteBytes: vi.fn() })),
  normalizeMcpArtworkSource: artworkMocks.normalizeMcpArtworkSource,
}));

import { upsertWorkingCards } from '@/features/studio-documents/server/cardSetWorkingDocuments';
import {
  getWorkingDocumentOperationStatus,
  patchWorkingDocument,
} from '@/features/studio-documents/server/workingDocumentPatches';

const makeTemplate = (): TCGCardTemplate => ({
  id: 'template-1',
  name: 'Template One',
  aspectRatio: '63:88',
  formatId: 'poker',
  trimWidthMm: 63,
  trimHeightMm: 88,
  templateSource: 'user',
  fieldContracts: [
    { key: 'name', elementId: 'name', type: 'text', required: true },
    { key: 'rules', elementId: 'rules', type: 'text', required: false },
  ],
  freeformCanvas: {
    width: 630,
    height: 880,
    elements: [
      { id: 'frame', type: 'shape', name: 'Frame', x: 0, y: 0, width: 630, height: 880, zIndex: 10 },
      { id: 'name', type: 'text', name: 'Name', x: 40, y: 40, width: 400, height: 50, zIndex: 20, content: '{{name:"Name"}}' },
      { id: 'rules', type: 'text', name: 'Rules', x: 40, y: 600, width: 400, height: 140, zIndex: 20, content: '{{rules:"Rules"}}' },
      { id: 'art-1', type: 'image', name: 'Art One', x: 60, y: 130, width: 200, height: 250, zIndex: 5 },
      { id: 'art-2', type: 'image', name: 'Art Two', x: 300, y: 130, width: 200, height: 250, zIndex: 5 },
    ],
  },
});

const makeCurrent = (revision = 60) => ({
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Efficiency Test',
  creationSource: 'gpt' as const,
  revision,
  createdAt: '2026-08-23T00:00:00.000Z',
  updatedAt: '2026-08-23T00:00:00.000Z',
  document: {
    version: 1 as const,
    userTemplates: [makeTemplate()],
    cardSets: [{ id: 'set-1', name: 'Set One' }],
    activeCardSetId: 'set-1',
    storedCards: [{
      uniqueId: 'card-1',
      templateId: 'template-1',
      backingTemplateId: null,
      setId: 'set-1',
      setName: 'Set One',
      data: { name: 'Card One', rules: 'Old rules', rarity_or_variant_marker: 'legacy' },
    }],
    appearanceStyles: [],
    exportSettings: {},
    customAssets: {
      'cardforge-maker-custom-textures': [],
      'cardforge-maker-custom-dividers': [],
      'cardforge-maker-custom-icons': [],
      'cardforge-maker-custom-images': [],
    },
    productionPlan: {
      version: 1 as const,
      decisionMode: 'confirmed' as const,
      purpose: 'Test',
      deliverable: 'Cards',
      outputSize: { width: 63, height: 88, unit: 'mm' as const },
      visualDirection: { summary: 'Test', palette: [], typography: [] },
      editableFieldKeys: ['name', 'rules'],
      assets: [
        {
          id: 'asset-1', name: 'Art One', kind: 'image' as const, role: 'artwork',
          source: 'custom-generated' as const, quantity: 1, status: 'needed' as const,
          binding: 'element.image' as const, targetElementIds: ['art-1'],
        },
        {
          id: 'asset-2', name: 'Art Two', kind: 'image' as const, role: 'artwork',
          source: 'custom-generated' as const, quantity: 1, status: 'needed' as const,
          binding: 'element.image' as const, targetElementIds: ['art-2'],
        },
      ],
    },
  },
});

const access = {
  user: { id: 'user-1' },
  capabilities: ['studio.ai.create'],
} as unknown as Parameters<typeof patchWorkingDocument>[0]['access'];

beforeEach(() => {
  storeMocks.getStudioDocument.mockReset();
  storeMocks.updateStudioDocument.mockReset();
  artworkMocks.normalizeMcpArtworkSource.mockClear();
  storeMocks.getStudioDocument.mockResolvedValue(makeCurrent());
  storeMocks.updateStudioDocument.mockImplementation(async (args: {
    expectedRevision: number;
    documentId: string;
    title: string;
    document: ReturnType<typeof makeCurrent>['document'];
  }) => ({
    ...makeCurrent(args.expectedRevision + 1),
    id: args.documentId,
    title: args.title,
    revision: args.expectedRevision + 1,
    document: args.document,
  }));
});

describe('atomic MCP working-document workflow', () => {
  it('commits a compound sparse Template/card patch as exactly one revision', async () => {
    const result = await patchWorkingDocument({
      access,
      input: {
        documentId: makeCurrent().id,
        expectedRevision: 60,
        operationId: 'compound-1',
        templatePatches: [{
          templateId: 'template-1',
          elementPatches: [
            { elementId: 'art-1', zIndex: 6 },
            { elementId: 'art-2', zIndex: 7 },
          ],
        }],
        cardPatches: [{ setId: 'set-1', cardId: 'card-1', fields: { rules: 'New rules' } }],
      },
    });

    expect(storeMocks.updateStudioDocument).toHaveBeenCalledTimes(1);
    expect(result.committedRevision).toBe(61);
    expect(result.changedElementIds).toEqual(['art-1', 'art-2']);
    expect(result.changedCardIds).toEqual(['card-1']);
    expect(result.warnings.join(' ')).toContain('rarity_or_variant_marker');
    const write = storeMocks.updateStudioDocument.mock.calls[0]![0] as { document: ReturnType<typeof makeCurrent>['document'] };
    expect(write.document.storedCards[0]?.data).toMatchObject({
      name: 'Card One', rules: 'New rules', rarity_or_variant_marker: 'legacy',
    });
  });

  it('rejects a stale expectedRevision before any write', async () => {
    storeMocks.getStudioDocument.mockResolvedValue(makeCurrent(61));
    await expect(patchWorkingDocument({
      access,
      input: {
        documentId: makeCurrent().id,
        expectedRevision: 60,
        cardPatches: [{ setId: 'set-1', cardId: 'card-1', fields: { rules: 'Nope' } }],
      },
    })).rejects.toThrow(/expected revision 60 to 61/i);
    expect(storeMocks.updateStudioDocument).not.toHaveBeenCalled();
  });

  it('validates every element patch before committing the transaction', async () => {
    await expect(patchWorkingDocument({
      access,
      input: {
        documentId: makeCurrent().id,
        expectedRevision: 60,
        templatePatches: [{
          templateId: 'template-1',
          elementPatches: [
            { elementId: 'art-1', zIndex: 6 },
            { elementId: 'missing-element', zIndex: 7 },
          ],
        }],
      },
    })).rejects.toThrow(/missing-element/);
    expect(storeMocks.updateStudioDocument).not.toHaveBeenCalled();
  });

  it('attaches multiple Template artworks in one commit', async () => {
    const result = await patchWorkingDocument({
      access,
      input: {
        documentId: makeCurrent().id,
        expectedRevision: 60,
        operationId: 'art-batch-1',
        templateArtworks: [
          {
            templateId: 'template-1', requirementId: 'asset-1', binding: 'element.image',
            targetElementIds: ['art-1'], mimeType: 'image/png', data: 'AA==',
          },
          {
            templateId: 'template-1', requirementId: 'asset-2', binding: 'element.image',
            targetElementIds: ['art-2'], mimeType: 'image/webp', data: 'AA==',
          },
        ],
      },
    });
    expect(artworkMocks.normalizeMcpArtworkSource).toHaveBeenCalledTimes(2);
    expect(storeMocks.updateStudioDocument).toHaveBeenCalledTimes(1);
    expect(result.changedAssetRequirementIds).toEqual(['asset-1', 'asset-2']);
    expect(result.committedRevision).toBe(61);
  });

  it('never creates a card through sparse patch semantics', async () => {
    await expect(patchWorkingDocument({
      access,
      input: {
        documentId: makeCurrent().id,
        expectedRevision: 60,
        cardPatches: [{ setId: 'set-1', cardId: 'card-does-not-exist', fields: { rules: 'Nope' } }],
      },
    })).rejects.toThrow(/cannot create duplicates or replacement cards/i);
    expect(storeMocks.updateStudioDocument).not.toHaveBeenCalled();
  });

  it('reconciles a timed-out operation id without repeating the mutation', async () => {
    const input = {
      documentId: makeCurrent().id,
      expectedRevision: 60,
      operationId: 'retry-safe-1',
      cardPatches: [{ setId: 'set-1', cardId: 'card-1', fields: { rules: 'Committed once' } }],
    };
    const first = await patchWorkingDocument({ access, input });
    const committed = storeMocks.updateStudioDocument.mock.results[0]!.value as Promise<ReturnType<typeof makeCurrent>>;
    storeMocks.getStudioDocument.mockResolvedValue(await committed);

    const replay = await patchWorkingDocument({ access, input });
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.committedRevision).toBe(61);
    expect(storeMocks.updateStudioDocument).toHaveBeenCalledTimes(1);

    const status = await getWorkingDocumentOperationStatus({
      access,
      documentId: input.documentId,
      operationId: input.operationId,
    });
    expect(status.status).toBe('committed');
    expect(status.receipt?.revision).toBe(61);
  });
});

describe('legacy compatibility and editing regressions', () => {
  it('allows legacy stored fields to survive ordinary upsert_cards revise operations', async () => {
    const result = await upsertWorkingCards({
      access,
      documentId: makeCurrent().id,
      expectedRevision: 60,
      setId: 'set-1',
      cards: [{ cardId: 'card-1', data: { rules: 'Revised safely' } }],
      writeMode: 'revise',
    });
    expect(result.document.revision).toBe(61);
    expect(storeMocks.updateStudioDocument).toHaveBeenCalledTimes(1);
    expect(result.document.document.storedCards[0]?.data).toMatchObject({
      name: 'Card One', rules: 'Revised safely', rarity_or_variant_marker: 'legacy',
    });
  });

  it('still rejects newly supplied unknown card fields', async () => {
    await expect(upsertWorkingCards({
      access,
      documentId: makeCurrent().id,
      expectedRevision: 60,
      setId: 'set-1',
      cards: [{ cardId: 'card-1', data: { rarity_or_variant_marker: 'new write' } }],
      writeMode: 'revise',
    })).rejects.toThrow(/not in the Template contract/i);
    expect(storeMocks.updateStudioDocument).not.toHaveBeenCalled();
  });

  it('preserves explicit poker trim dimensions instead of silently replacing them with preset dimensions', () => {
    const resolved = resolveTemplateCardFormat({
      formatId: 'poker',
      aspectRatio: '63.5:88.9',
      trimWidthMm: 63.5,
      trimHeightMm: 88.9,
    });
    expect(resolved.formatId).toBe('poker');
    expect(resolved.widthMm).toBe(63.5);
    expect(resolved.heightMm).toBe(88.9);
  });

  it('decodes and re-encodes incoming WebP through the normalization path', async () => {
    const source = await sharp({
      create: { width: 32, height: 32, channels: 4, background: { r: 120, g: 30, b: 220, alpha: 1 } },
    }).webp({ quality: 12 }).toBuffer();
    const normalized = await normalizeEmbeddedTemplateAsset({
      data: source.toString('base64'),
      mimeType: 'image/webp',
    });
    expect(normalized.dataUri).toMatch(/^data:image\/webp;base64,/);
    expect(normalized.bytes.equals(source)).toBe(false);
    await expect(sharp(normalized.bytes).metadata()).resolves.toMatchObject({ format: 'webp', width: 32, height: 32 });
  });

  it('does not synthesize or retain phantom artworkUrl fields for persisted native image layers', () => {
    const template: TCGCardTemplate = {
      id: 'diagnostic-template',
      name: 'Diagnostic Template',
      aspectRatio: '63:88',
      templateSource: 'user',
      fieldContracts: [
        { key: 'artwork', type: 'image', elementId: 'artwork' },
        { key: 'type_icon', type: 'image', elementId: 'type-icon' },
        { key: 'artworkUrl', type: 'image', required: false },
      ],
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          { id: 'artwork', type: 'image', name: 'Artwork', x: 10, y: 10, width: 300, height: 300, zIndex: 1, imageSource: 'artwork' },
          { id: 'type-icon', type: 'image', name: 'Type Icon', x: 330, y: 10, width: 80, height: 80, zIndex: 2, imageSource: 'type_icon' },
          {
            id: 'embedded-frame-strip', type: 'image', name: 'Frame Strip', x: 0, y: 0, width: 630, height: 100, zIndex: 3,
            imageSource: 'cardforge-studio-asset://frame-strip', content: 'artworkUrl', locked: false,
          },
        ],
      },
    };
    const normalized = normalizeTemplateFieldContracts(template);
    const keys = normalized.fieldContracts?.map((contract) => contract.key) ?? [];
    expect(keys).toContain('artwork');
    expect(keys).toContain('type_icon');
    expect(keys).not.toContain('artworkUrl');
    expect(keys.some((key) => key.includes('frame_strip'))).toBe(false);
  });
});
