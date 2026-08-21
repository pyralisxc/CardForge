import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const readSource = (path: string) => readFileSync(resolve(root, path), 'utf8');
const migrationPath = 'supabase/migrations/20260821201016_owner_presentation_controls.sql';

const retiredPresentationLiterals = [
  '#0c0b09', '#15100a', '#15110d', '#100c08', '#120e09', '#171207',
  '#1b140d', '#1b1510', '#1b1209', '#1c130b', '#24180e', '#2a1b0d', '#21170d',
  '#5f4526', '#6f532e', '#6d4f2b', '#3c2c1b', '#4a3823', '#42311f', '#4d3c25', '#846634',
  '#d8b365', '#e4aa43', '#f4c66b', '#e2aa4a', '#fff1c7', '#ffe7ad', '#f8e3b0', '#f7ead0',
  '#cbb58b', '#c7b288', '#a98a75', '#a98a55', '#bde3a8', '#5f7f54', '#f0bd75', '#8c6436',
  '#ffd0c6', '#7d3d32', '#2b2f39', '#252b35', '#111720', '#3b4352',
] as const;

const collectUiSources = (directory: string): string[] => readdirSync(directory).flatMap((name) => {
  const absolute = join(directory, name);
  if (statSync(absolute).isDirectory()) return collectUiSources(absolute);
  return absolute.endsWith('.tsx') ? [absolute] : [];
});

describe('CardForge presentation ownership', () => {
  it('keeps one canonical token owner for generic, public, and editor presentation roles', () => {
    const presentation = readSource('src/app/cardforgePresentation.css');
    const globals = readSource('src/app/globals.css');
    const tailwind = readSource('tailwind.config.ts');
    const makerTheme = readSource('src/features/template-editor/lib/makerTheme.ts');

    expect(presentation).toContain('--cf-canvas:');
    expect(presentation).toContain('--cf-surface:');
    expect(presentation).toContain('--cf-accent-strong:');
    expect(presentation).toContain('--cf-editor-surface:');
    expect(presentation).toContain('--background: var(--cf-canvas);');
    expect(presentation).toContain('--public-obsidian: var(--cf-canvas);');
    expect(presentation).toContain('--public-brass: var(--cf-accent-strong);');
    expect(globals).not.toContain('--public-obsidian: #');
    expect(globals).not.toContain('--background: 220 15% 12%');
    expect(tailwind).toContain("background: 'var(--background)'");
    expect(tailwind).not.toContain('hsl(var(--background))');
    expect(makerTheme).toContain('var(--cf-editor-');
    expect(presentation).not.toContain('Legacy Forge utility compatibility bridge');
    expect(presentation).not.toContain('[class~="bg-[#');
  });

  it('routes validated Owner Console presentation settings through the existing experience-settings owner once', () => {
    const layout = readSource('src/app/layout.tsx');
    const model = readSource('src/features/experience-settings/model/experienceSettings.ts');
    const store = readSource('src/features/experience-settings/server/experienceSettingsStore.ts');
    const panel = readSource('src/features/experience-settings/components/OwnerExperienceControlsPanel.tsx');

    expect(model).toContain("PRESENTATION_PALETTES = ['forge', 'obsidian', 'slate']");
    expect(model).toContain("PRESENTATION_ACCENTS = ['brass', 'ember', 'arcane']");
    expect(model).toContain("PRESENTATION_CORNERS = ['square', 'subtle', 'soft']");
    expect(model).toContain("PRESENTATION_CONTRASTS = ['standard', 'high']");
    expect(layout).toContain('data-cf-palette={experienceSettings.presentationPalette}');
    expect(layout).toContain('data-cf-accent={experienceSettings.presentationAccent}');
    expect(layout).toContain('data-cf-corners={experienceSettings.presentationCorners}');
    expect(layout).toContain('data-cf-contrast={experienceSettings.presentationContrast}');
    expect(store).toContain("'presentation_palette'");
    expect(store).toContain("'presentation_accent'");
    expect(store).toContain("'presentation_corners'");
    expect(store).toContain("'presentation_contrast'");
    expect(panel).toContain('Presentation palette');
    expect(panel).toContain('Accent character');
    expect(panel).toContain('Corner character');
    expect(panel).toContain('Contrast');

    expect(existsSync(resolve(root, migrationPath))).toBe(true);
    const migration = readSource(migrationPath);
    expect(migration).toContain('add column if not exists presentation_palette');
    expect(migration).toContain('add column if not exists presentation_accent');
    expect(migration).toContain('add column if not exists presentation_corners');
    expect(migration).toContain('add column if not exists presentation_contrast');
    expect(migration).not.toMatch(/\bdrop\b/i);
  });

  it('does not let UI features recreate the retired Forge palette', () => {
    const files = [
      ...collectUiSources(resolve(root, 'src')),
      resolve(root, 'src/app/globals.css'),
    ];
    const violations: string[] = [];

    for (const absolute of files) {
      const source = readFileSync(absolute, 'utf8');
      const used = retiredPresentationLiterals.filter((literal) => source.toLowerCase().includes(literal));
      if (used.length > 0) violations.push(`${relative(root, absolute)}: ${used.join(', ')}`);
    }

    expect(violations, `Retired presentation literals must move to --cf-* roles:\n${violations.join('\n')}`).toEqual([]);
  });
});
