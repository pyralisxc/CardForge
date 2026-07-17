import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

describe('proof-led homepage', () => {
  it('leads with the product outcome and two intentional hero actions', () => {
    const hero = readSource('src/features/public-site/components/OutcomeHero.tsx');

    expect(hero).toContain('Build complete card sets from one reusable system.');
    expect(hero).toContain('Try the Studio');
    expect(hero).toContain('href="/studio"');
    expect(hero).toContain('See Complete Sets');
    expect(hero).toContain('href="/examples"');
    expect(hero).toContain('variant="hero"');
  });

  it('shows the four-step production workflow in order', () => {
    const workflow = readSource('src/features/public-site/components/WorkflowProof.tsx');

    const steps = ['Design the template', 'Connect your data', 'Generate the set', 'Review and export'];
    let previousIndex = -1;
    for (const step of steps) {
      const index = workflow.indexOf(step);
      expect(index, step).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }
  });

  it('uses real renderer proof and removes the fantasy workbench hero', () => {
    const page = readSource('src/app/page.tsx');
    const hero = readSource('src/features/public-site/components/OutcomeHero.tsx');

    expect(page).toContain('<PublicSiteShell');
    expect(page).toContain('<OutcomeHero');
    expect(page).not.toContain('cardforge-hero-workbench.png');
    expect(hero).toContain('LiveExampleGallery');
  });

  it('keeps access, founder trust, support, and one final product conversion', () => {
    const page = readSource('src/app/page.tsx');
    const founder = readSource('src/features/public-site/components/FounderStrip.tsx');

    expect(page).toContain('<AccessComparison');
    expect(page).toContain('<FounderStrip');
    expect(page).toContain('Ready to build the complete set?');
    expect(founder).toContain('Built independently by Cameron Locke');
    expect(founder).toContain('href="/cameron"');
    expect(founder).toContain('href="/support"');
  });
});
