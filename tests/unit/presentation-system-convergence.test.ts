import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXPERIENCE_SETTINGS,
  hydrateExperienceSettings,
  normalizeExperienceSettingsInput,
} from '@/features/experience-settings/client';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const migrationPath = 'supabase/migrations/20260821180000_owner_presentation_controls.sql';

describe('canonical CardForge presentation system', () => {
  it('routes generic and public theme contracts back to the canonical CardForge tokens', () => {
    const globals = readSource('src/app/globals.css');
    const presentation = readSource('src/app/cardforgePresentation.css');
    const tailwind = readSource('tailwind.config.ts');

    expect(globals).not.toContain('--background: 220 15% 12%');
    expect(globals).not.toContain('--primary: 260 60% 55%');
    expect(globals).not.toContain('--public-obsidian: #');
    expect(globals).not.toContain('--public-brass: #');

    expect(tailwind).toContain("background: 'var(--background)'");
    expect(tailwind).toContain("DEFAULT: 'var(--primary)'");
    expect(tailwind).not.toContain('hsl(var(--background))');

    expect(presentation).toContain('--background: var(--cf-canvas);');
    expect(presentation).toContain('--card: var(--cf-surface);');
    expect(presentation).toContain('--primary: var(--cf-accent-strong);');
    expect(presentation).toContain('--public-obsidian: var(--cf-canvas);');
    expect(presentation).toContain('--public-brass: var(--cf-accent-strong);');
  });

  it('keeps owner presentation choices validated in the existing experience-settings owner', () => {
    expect(DEFAULT_EXPERIENCE_SETTINGS).toMatchObject({
      presentationPalette: 'forge',
      presentationAccent: 'brass',
      presentationCorners: 'subtle',
      presentationContrast: 'standard',
    });

    expect(hydrateExperienceSettings({
      project_file_access: 'free',
      analytics_consent_presentation: 'banner',
      presentation_palette: 'slate',
      presentation_accent: 'arcane',
      presentation_corners: 'soft',
      presentation_contrast: 'high',
    })).toMatchObject({
      presentationPalette: 'slate',
      presentationAccent: 'arcane',
      presentationCorners: 'soft',
      presentationContrast: 'high',
    });

    expect(normalizeExperienceSettingsInput({
      projectFileAccess: 'creator_pass',
      analyticsConsentPresentation: 'required_popup',
      presentationPalette: 'obsidian',
      presentationAccent: 'ember',
      presentationCorners: 'square',
      presentationContrast: 'high',
    })).toMatchObject({
      presentationPalette: 'obsidian',
      presentationAccent: 'ember',
      presentationCorners: 'square',
      presentationContrast: 'high',
    });

    expect(() => normalizeExperienceSettingsInput({
      projectFileAccess: 'creator_pass',
      analyticsConsentPresentation: 'required_popup',
      presentationPalette: '#ff00ff',
      presentationAccent: 'custom-css',
      presentationCorners: 'banana',
      presentationContrast: 'invisible',
    })).toThrow();
  });

  it('applies persisted presentation choices once at the root and exposes them in the existing owner controls', () => {
    const layout = readSource('src/app/layout.tsx');
    const store = readSource('src/features/experience-settings/server/experienceSettingsStore.ts');
    const panel = readSource('src/features/experience-settings/components/OwnerExperienceControlsPanel.tsx');

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
    expect(panel).toContain('CardForgeSurface');
  });

  it('defines curated presentation profiles and an additive persistence migration', () => {
    const presentation = readSource('src/app/cardforgePresentation.css');

    expect(presentation).toContain('[data-cf-palette="forge"]');
    expect(presentation).toContain('[data-cf-palette="obsidian"]');
    expect(presentation).toContain('[data-cf-palette="slate"]');
    expect(presentation).toContain('[data-cf-accent="brass"]');
    expect(presentation).toContain('[data-cf-accent="ember"]');
    expect(presentation).toContain('[data-cf-accent="arcane"]');
    expect(presentation).toContain('[data-cf-corners="square"]');
    expect(presentation).toContain('[data-cf-corners="soft"]');
    expect(presentation).toContain('[data-cf-contrast="high"]');

    expect(existsSync(resolve(process.cwd(), migrationPath))).toBe(true);
    const migration = readSource(migrationPath);
    expect(migration).toContain('add column if not exists presentation_palette');
    expect(migration).toContain('add column if not exists presentation_accent');
    expect(migration).toContain('add column if not exists presentation_corners');
    expect(migration).toContain('add column if not exists presentation_contrast');
    expect(migration).not.toMatch(/\bdrop\b/i);
  });

  it('moves the Owner Console onto the same shared presentation primitives', () => {
    const owner = readSource('src/features/owner/components/OwnerConsolePage.tsx');

    expect(owner).toContain('CardForgeWorkspaceNavigation');
    expect(owner).toContain('CardForgeSectionIntro');
    expect(owner).toContain('CardForgeWorkspaceState');
    expect(owner).toContain('CardForgeStatusBadge');
    expect(owner).not.toContain('function WorkspaceIntroduction');
    expect(owner).not.toContain('function LazyWorkspaceState');
  });
});
