import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CARDFORGE_EXAMPLES } from '@/features/public-site/client';

interface ShippedTemplate {
  id: string;
  fieldContracts?: Array<{ key?: string; type?: string; elementId?: string }>;
  freeformCanvas?: {
    elements?: Array<{
      id?: string;
      type?: string;
      imageSource?: string;
      content?: string;
      backgroundImageUrl?: string;
    }>;
  };
}

const readTemplate = (filename: string): ShippedTemplate => JSON.parse(
  readFileSync(join(process.cwd(), 'data/default-templates', filename), 'utf8'),
) as ShippedTemplate;

const findExample = (templateId: string) => {
  const example = CARDFORGE_EXAMPLES.find((candidate) => candidate.frontTemplateId === templateId);
  expect(example, `Expected a public example for ${templateId}`).toBeDefined();
  return example!;
};

describe('showcase templates', () => {
  it('turns the playing-card center into unique artwork with an optional title', () => {
    const template = readTemplate('default-playing-card-theme.json');
    const contracts = new Map(template.fieldContracts?.map((field) => [field.key, field]));
    const elements = new Map(template.freeformCanvas?.elements?.map((element) => [element.id, element]));

    expect(contracts.get('Artwork')).toMatchObject({ type: 'image', elementId: 'pc-center-artwork' });
    expect(contracts.get('CardTitle')).toMatchObject({ type: 'text', elementId: 'pc-card-title' });
    expect(elements.get('pc-center-artwork')).toMatchObject({ type: 'image', imageSource: 'Artwork' });
    expect(elements.get('pc-card-title')?.content).toContain('{{CardTitle:');
    expect(elements.has('pc-center')).toBe(false);
    expect(['pc-top-rank', 'pc-top-suit', 'pc-bottom-rank', 'pc-bottom-suit'].every((id) => elements.has(id))).toBe(true);

    const example = findExample(template.id);
    expect(example.rows).toHaveLength(4);
    expect(new Set(example.rows.map((row) => row.Artwork)).size).toBe(4);
    expect(example.rows.every((row) => row.Artwork.startsWith('/card-assets/showcase/playing-cards/'))).toBe(true);
    expect(example.rows.every((row) => row.CardTitle.trim().length > 0)).toBe(true);
  });

  it('publishes a four-card creature set with unique artwork and complete card data', () => {
    const template = readTemplate('default-mtg-theme.json');
    const example = findExample(template.id);

    expect(example.rows).toHaveLength(4);
    expect(new Set(example.rows.map((row) => row.Artwork)).size).toBe(4);
    expect(example.rows.every((row) => row.Artwork.startsWith('/card-assets/showcase/creatures/'))).toBe(true);
    for (const row of example.rows) {
      for (const key of ['CardName', 'TypeLine', 'Ability', 'Power', 'Toughness']) {
        expect(row[key]?.trim(), `${key} should be populated`).not.toBe('');
      }
    }
  });

  it('uses role color as a real event-pass template field across four variants', () => {
    const template = readTemplate('default-event-badge-theme.json');
    const contracts = new Map(template.fieldContracts?.map((field) => [field.key, field]));
    const elements = template.freeformCanvas?.elements ?? [];

    expect(contracts.get('RoleColor')).toMatchObject({ type: 'text', elementId: 'badge-role-accent' });
    expect(elements.find((element) => element.id === 'badge-role-accent')?.backgroundImageUrl).toContain('{{RoleColor:');

    const example = findExample(template.id);
    expect(example.rows).toHaveLength(4);
    expect(new Set(example.rows.map((row) => row.RoleColor)).size).toBe(4);
    expect(example.rows.every((row) => /^#[0-9a-f]{6}$/i.test(row.RoleColor))).toBe(true);
  });
});
