import { describe, expect, it } from 'vitest';

import {
  buildInitialColumnMapping,
  createBulkDisplayCards,
  createBulkExampleCsv,
  createBulkPreview,
  getBulkGenerationBlockingIssues,
  shouldBlockBulkGeneration,
  updateColumnMapping,
} from '@/lib/bulkGeneration';
import type { TCGCardTemplate } from '@/types';

describe('bulk generation helpers', () => {
  it('builds initial column mapping with case-insensitive matching', () => {
    const headers = ['RulesText', 'TYPELINE', 'unknownCol'];
    const fieldKeys = ['rulesText', 'typeLine', 'setCode'];

    expect(buildInitialColumnMapping(headers, fieldKeys)).toEqual({
      RulesText: 'rulesText',
      TYPELINE: 'typeLine',
      unknownCol: '',
    });
  });

  it('updates column mapping for advanced interactions', () => {
    const current = {
      rulesText: 'rulesText',
      typeLine: 'typeLine',
    };

    const remapped = updateColumnMapping(current, 'typeLine', 'setCode');
    expect(remapped).toEqual({
      rulesText: 'rulesText',
      typeLine: 'setCode',
    });

    const ignored = updateColumnMapping(remapped, 'rulesText', '__unmapped__');
    expect(ignored).toEqual({
      rulesText: '',
      typeLine: 'setCode',
    });
  });

  it('blocks generation only when strict mode has warnings', () => {
    expect(shouldBlockBulkGeneration(false, 1, 0)).toBe(false);
    expect(shouldBlockBulkGeneration(true, 0, 0)).toBe(false);
    expect(shouldBlockBulkGeneration(true, 1, 0)).toBe(true);
    expect(shouldBlockBulkGeneration(true, 0, 2)).toBe(true);
  });

  it('flags structurally invalid CSV before generation', () => {
    expect(
      getBulkGenerationBlockingIssues(
        ['Rank', 'Suit'],
        [
          ['Rank', 'Suit'],
          ['A'],
          ['K', 'Hearts', 'Extra'],
        ],
        { Rank: 'rank', Suit: 'suit' }
      )
    ).toEqual([
      'Row 2 has 1 column; expected 2.',
      'Row 3 has 3 columns; expected 2.',
    ]);
  });

  it('flags duplicate headers and missing mappings as blocking issues', () => {
    expect(
      getBulkGenerationBlockingIssues(
        ['Rank', 'rank', 'Suit'],
        [['Rank', 'rank', 'Suit'], ['A', 'Ace', 'Spades']],
        { Rank: '', rank: '', Suit: '' }
      )
    ).toEqual([
      'Duplicate CSV header detected: Rank',
      'Map at least one CSV column to a template field before generating.',
    ]);
  });

  it('creates template-specific example CSV data from field definitions', () => {
    const template: TCGCardTemplate = {
      id: 'example-template',
      name: 'Example Template',
      aspectRatio: '63:88',
      templatePreviewData: {
        cardName: 'Preview Name',
      },
    };

    expect(createBulkExampleCsv({
      template,
      fieldDefinitions: [
        {
          key: 'cardName',
          label: 'Card Name',
          control: 'input',
          editor: 'plain-input',
          contentModel: 'plainText',
          required: true,
          isImage: false,
          isMultiline: false,
          supportsRichText: false,
        },
        {
          key: 'artworkUrl',
          label: 'Artwork URL',
          control: 'input',
          editor: 'plain-input',
          contentModel: 'image',
          required: false,
          isImage: true,
          isMultiline: false,
          supportsRichText: false,
        },
      ],
    })).toContain('Preview Name');
  });

  it('creates preview warnings and row overrides from mapped CSV data', () => {
    expect(createBulkPreview({
      rows: [
        ['Name', 'Rules', 'Ignored'],
        ['Card 1', '', 'unused'],
      ],
      columnMapping: {
        Name: 'name',
        Rules: 'rulesText',
        Ignored: '',
      },
      fieldDefinitions: [
        {
          key: 'name',
          label: 'Name',
          control: 'input',
          editor: 'plain-input',
          contentModel: 'plainText',
          required: true,
          isImage: false,
          isMultiline: false,
          supportsRichText: false,
        },
        {
          key: 'rulesText',
          label: 'Rules Text',
          control: 'textarea',
          editor: 'rich-textarea',
          contentModel: 'richText',
          required: true,
          isImage: false,
          isMultiline: true,
          supportsRichText: true,
        },
      ],
      previewOverrides: {
        2: {
          rulesText: 'Overridden rules',
        },
      },
    })).toMatchObject({
      globalWarnings: ['Unmapped CSV columns will be skipped: Ignored'],
      rows: [
        {
          rowNumber: 2,
          mappedData: {
            name: 'Card 1',
            rulesText: 'Overridden rules',
          },
          warnings: [],
        },
      ],
    });
  });

  it('generates at least 1000 cards from mapped CSV rows without dropping row data', () => {
    const template: TCGCardTemplate = {
      id: 'bulk-1000-template',
      name: 'Bulk 1000 Template',
      aspectRatio: '63:88',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [],
      },
    };
    const fieldDefinitions = [
      {
        key: 'Rank',
        label: 'Rank',
        control: 'input' as const,
        editor: 'plain-input' as const,
        contentModel: 'plainText' as const,
        required: true,
        isImage: false,
        isMultiline: false,
        supportsRichText: false,
      },
      {
        key: 'Suit',
        label: 'Suit',
        control: 'input' as const,
        editor: 'plain-input' as const,
        contentModel: 'plainText' as const,
        required: true,
        isImage: false,
        isMultiline: false,
        supportsRichText: false,
      },
      {
        key: 'RulesText',
        label: 'Rules Text',
        control: 'textarea' as const,
        editor: 'rich-textarea' as const,
        contentModel: 'richText' as const,
        required: false,
        isImage: false,
        isMultiline: true,
        supportsRichText: true,
        defaultValue: 'Default rules text',
      },
    ];
    const rows = [
      ['Rank', 'Suit', 'RulesText'],
      ...Array.from({ length: 1000 }, (_, index) => [
        String(index + 1),
        index % 2 === 0 ? 'Hearts' : 'Spades',
        `Rules line ${index + 1}`,
      ]),
    ];

    const cards = createBulkDisplayCards({
      template,
      fieldDefinitions,
      rows,
      columnMapping: {
        Rank: 'Rank',
        Suit: 'Suit',
        RulesText: 'RulesText',
      },
      createId: (rowNumber) => `bulk-card-${rowNumber}`,
    });

    expect(cards).toHaveLength(1000);
    expect(cards[0]).toMatchObject({
      uniqueId: 'bulk-card-2',
      data: {
        Rank: '1',
        Suit: 'Hearts',
        RulesText: 'Rules line 1',
      },
    });
    expect(cards[999]).toMatchObject({
      uniqueId: 'bulk-card-1001',
      data: {
        Rank: '1000',
        Suit: 'Spades',
        RulesText: 'Rules line 1000',
      },
    });
  });
});
