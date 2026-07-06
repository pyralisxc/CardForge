import { describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

import { getDefaultGridSizeForCanvas, reconstructMinimalTemplateObject } from '@/lib/templateModel';
import type { TCGCardTemplate } from '@/types';

describe('template model grid defaults', () => {
  it('derives a centered grid from the template dimensions', () => {
    const gridSize = getDefaultGridSizeForCanvas(630, 880);

    expect(gridSize).toBeGreaterThanOrEqual(17);
    expect(gridSize).toBeLessThanOrEqual(28);
    expect(880 % gridSize).toBe(0);
    expect((880 / gridSize) % 2).toBe(0);
  });

  it('scales the default grid for non-card template dimensions', () => {
    const cardGrid = getDefaultGridSizeForCanvas(630, 880);
    const sheetGrid = getDefaultGridSizeForCanvas(850, 1100);

    expect(sheetGrid).toBeGreaterThan(cardGrid);
    expect(1100 % sheetGrid).toBe(0);
  });

  it('keeps upgraded default templates freeform-only and backed by premium assets', async () => {
    const upgradedTemplateFiles = [
      ['data/default-templates/default-mtg-theme.json', '/card-assets/textures/arcane-forge/frame-creature-premium.webp'],
      ['data/default-templates/default-ttrpg-stat-sheet.json', '/card-assets/textures/arcane-forge/frame-ttrpg-premium.webp'],
      ['data/default-templates/default-playing-card-theme.json', '/card-assets/textures/arcane-forge/frame-playing-premium.webp'],
      ['data/default-templates/default-obsidian-neon-card-back.json', '/card-assets/textures/arcane-forge/back-obsidian-neon-premium.webp'],
    ] as const;

    await Promise.all(upgradedTemplateFiles.map(async ([relativePath, expectedBackground]) => {
      const raw = await fs.readFile(path.join(process.cwd(), relativePath), 'utf8');
      const template = JSON.parse(raw) as TCGCardTemplate & { rows?: unknown; layoutMode?: unknown };
      const reconstructed = reconstructMinimalTemplateObject(template);

      expect(reconstructed.freeformCanvas?.elements.length ?? 0, `${relativePath} should have freeform elements`).toBeGreaterThan(0);
      expect(template.cardBackgroundImageUrl, `${relativePath} should use the premium full-frame art`).toBe(expectedBackground);
      expect(template.cardBorderWidth, `${relativePath} should let the full-frame art own the border`).toBe('0px');
      expect(template.rows, `${relativePath} should not reintroduce rows`).toBeUndefined();
      expect(template.layoutMode, `${relativePath} should not reintroduce layoutMode`).toBeUndefined();
      expect(raw, `${relativePath} should use the premium arcane forge asset family`).toContain('/card-assets/');
      expect(raw, `${relativePath} should use the premium arcane forge asset family`).toContain('arcane-forge');
    }));
  });
});
