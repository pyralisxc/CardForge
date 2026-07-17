import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

describe('proof-led homepage', () => {
  it('leads with the product outcome and two intentional hero actions', () => {
    const hero = readSource('src/features/public-site/components/OutcomeHero.tsx');

    expect(hero).toContain('Design one card. Add your list. CardForge builds the set.');
    expect(hero).toContain('Try the Studio');
    expect(hero).toContain('href="/studio"');
    expect(hero).toContain('See what it makes');
    expect(hero).toContain('href="/examples"');
    expect(hero).toContain('StudioProductProof');
  });

  it('shows the four-step workflow in ordinary language', () => {
    const workflow = readSource('src/features/public-site/components/WorkflowProof.tsx');

    const steps = ['Make the look once', 'Add your card list', 'Build the whole set', 'Check and download'];
    let previousIndex = -1;
    for (const step of steps) {
      const index = workflow.indexOf(step);
      expect(index, step).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }
  });

  it('uses recognizable Studio and real renderer proof', () => {
    const page = readSource('src/app/page.tsx');
    const hero = readSource('src/features/public-site/components/OutcomeHero.tsx');
    const studioProof = readSource('src/features/public-site/components/StudioProductProof.tsx');

    expect(page).toContain('<PublicSiteShell');
    expect(page).toContain('<OutcomeHero');
    expect(page).not.toContain('cardforge-hero-workbench.png');
    expect(hero).toContain('StudioProductProof');
    expect(studioProof).toContain('Studio workspace preview');
    expect(studioProof).toContain('LiveExampleGallery');
  });

  it('keeps access, founder trust, support, and one final product conversion', () => {
    const page = readSource('src/app/page.tsx');
    const founder = readSource('src/features/public-site/components/FounderStrip.tsx');

    expect(page).toContain('<AccessComparison');
    expect(page).toContain('<FounderStrip');
    expect(page).toContain('Build your first set.');
    expect(founder).toContain('Built independently by Cameron Locke');
    expect(founder).toContain('href="/cameron"');
    expect(founder).toContain('href="/support"');
  });
});
