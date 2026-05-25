import { describe, expect, it } from 'vitest';

import {
  buildInitialColumnMapping,
  createBulkDisplayCards,
  createBulkExampleCsv,
  createBulkExampleJson,
  createBulkImportContract,
  createBulkPreview,
  getBulkGenerationBlockingIssues,
  normalizeJsonObjectsToRows,
  parseBulkDataSource,
  parseStructuredTextToRows,
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

  it('creates template-specific import-ready JSON data from field definitions', () => {
    const template: TCGCardTemplate = {
      id: 'example-template',
      name: 'Example Template',
      aspectRatio: '63:88',
      templatePreviewData: {
        cardName: 'Preview Name',
      },
    };

    const json = createBulkExampleJson({
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
          key: 'rulesText',
          label: 'Rules Text',
          control: 'textarea',
          editor: 'rich-textarea',
          contentModel: 'richText',
          required: false,
          isImage: false,
          isMultiline: true,
          supportsRichText: true,
          defaultValue: 'Default rules',
        },
      ],
    });

    expect(JSON.parse(json)).toEqual([
      {
        cardName: 'Preview Name',
        rulesText: 'Default rules',
      },
    ]);
  });

  it('normalizes JSON object arrays into bulk rows', () => {
    expect(normalizeJsonObjectsToRows([
      { Name: 'Badge One', Company: 'Northstar' },
      { Company: 'ForgeWorks', Role: 'Speaker' },
    ])).toEqual([
      ['Name', 'Company', 'Role'],
      ['Badge One', 'Northstar', ''],
      ['', 'ForgeWorks', 'Speaker'],
    ]);
  });

  it('rejects nested JSON values for bulk rows', () => {
    expect(() => normalizeJsonObjectsToRows([
      { Name: 'Nested', Stats: { Power: 2 } },
    ])).toThrow('JSON row 1 field "Stats" must be a string, number, boolean, or empty value.');
  });

  it('parses structured text records into bulk rows', () => {
    expect(parseStructuredTextToRows(`
Name: Emberclaw Whelp
Type Line: Creature - Dragon
Rules Text:
Flying.
When this enters play, deal 1 damage.
Transitions[1].Position: 908

---

Name: Moonlit Ranger
Type Line: Hero - Scout
Rules Text: Draw a card.
Transitions[1].Position: 421
    `)).toEqual([
      ['Name', 'Type Line', 'Rules Text', 'Transitions[1].Position'],
      ['Emberclaw Whelp', 'Creature - Dragon', 'Flying.\nWhen this enters play, deal 1 damage.', '908'],
      ['Moonlit Ranger', 'Hero - Scout', 'Draw a card.', '421'],
    ]);
  });

  it('auto-detects CSV, JSON, and structured text data sources', () => {
    expect(parseBulkDataSource('Name,Role\nAvery,Designer', 'auto')).toEqual([
      ['Name', 'Role'],
      ['Avery', 'Designer'],
    ]);
    expect(parseBulkDataSource('[{"Name":"Avery","Role":"Designer"}]', 'auto')).toEqual([
      ['Name', 'Role'],
      ['Avery', 'Designer'],
    ]);
    expect(parseBulkDataSource('Name: Avery\nRole: Designer', 'auto')).toEqual([
      ['Name', 'Role'],
      ['Avery', 'Designer'],
    ]);
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

  it('preserves recognized per-field style override columns as generated output metadata', () => {
    const template: TCGCardTemplate = {
      id: 'style-data-template',
      name: 'Style Data Template',
      aspectRatio: '63:88',
    };
    const fieldDefinitions = [
      {
        key: 'Name',
        label: 'Name',
        control: 'input' as const,
        editor: 'rich-textarea' as const,
        contentModel: 'richText' as const,
        required: true,
        isImage: false,
        isMultiline: false,
        supportsRichText: true,
      },
      {
        key: 'Stat',
        label: 'Stat',
        control: 'input' as const,
        editor: 'plain-input' as const,
        contentModel: 'plainText' as const,
        required: false,
        isImage: false,
        isMultiline: false,
        supportsRichText: false,
      },
    ];

    const cards = createBulkDisplayCards({
      template,
      fieldDefinitions,
      rows: [
        ['Name', 'Name.textColor', 'Name.fontWeight', 'Stat.style.fontSizePx', 'Ignored.textColor'],
        ['Avery', '#00ffaa', 'font-semibold', '28', '#ff0000'],
      ],
      columnMapping: {
        Name: 'Name',
      },
      createId: (rowNumber) => `style-card-${rowNumber}`,
    });

    expect(cards).toHaveLength(1);
    expect(cards[0].data).toMatchObject({
      Name: 'Avery',
      '__cardforgeFieldStyle.Name.textColor': '#00ffaa',
      '__cardforgeFieldStyle.Name.fontWeight': 'font-semibold',
      '__cardforgeFieldStyle.Stat.fontSizePx': '28',
    });
    expect(cards[0].data['__cardforgeFieldStyle.Ignored.textColor']).toBeUndefined();
  });

  it('accepts style override fields from JSON object arrays and structured text imports', () => {
    expect(parseBulkDataSource('[{"Name":"Avery","Name.textColor":"#00ffaa","Name.style.fontWeight":"font-semibold"}]', 'json')).toEqual([
      ['Name', 'Name.textColor', 'Name.style.fontWeight'],
      ['Avery', '#00ffaa', 'font-semibold'],
    ]);

    expect(parseBulkDataSource('Name: Avery\nName.textColor: #00ffaa\nName.style.fontWeight: font-semibold', 'structured')).toEqual([
      ['Name', 'Name.textColor', 'Name.style.fontWeight'],
      ['Avery', '#00ffaa', 'font-semibold'],
    ]);
  });

  it('documents optional style override columns in the downloadable bulk contract', () => {
    const contract = createBulkImportContract({
      template: {
        id: 'contract-template',
        name: 'Contract Template',
        aspectRatio: '63:88',
      },
      fieldDefinitions: [
        {
          key: 'Name',
          label: 'Name',
          control: 'input' as const,
          editor: 'rich-textarea' as const,
          contentModel: 'richText' as const,
          required: true,
          isImage: false,
          isMultiline: false,
          supportsRichText: true,
        },
        {
          key: 'Portrait',
          label: 'Portrait',
          control: 'input' as const,
          editor: 'plain-input' as const,
          contentModel: 'image' as const,
          required: false,
          isImage: true,
          isMultiline: false,
          supportsRichText: false,
        },
      ],
      generatedAt: '2026-05-21T00:00:00.000Z',
    });

    expect(contract).toMatchObject({
      templateId: 'contract-template',
      templateName: 'Contract Template',
      generatedAt: '2026-05-21T00:00:00.000Z',
      styleOverrideSyntax: {
        summary: expect.stringContaining('Optional row-level styling'),
        supportedProperties: ['textColor', 'fontFamily', 'fontSizePx', 'fontWeight', 'fontStyle', 'textDecoration', 'lineHeight', 'letterSpacing'],
        examples: ['Name.textColor', 'Name.style.fontWeight'],
      },
      fields: [
        {
          key: 'Name',
          styleOverrideColumns: ['Name.textColor', 'Name.fontFamily', 'Name.fontSizePx', 'Name.fontWeight', 'Name.fontStyle', 'Name.textDecoration', 'Name.lineHeight', 'Name.letterSpacing'],
        },
        {
          key: 'Portrait',
          styleOverrideColumns: [],
        },
      ],
    });
  });
});
