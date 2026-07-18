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
    expect(hero).toContain('href="#interactive-showcase"');
    expect(hero).toContain('/card-assets/showcase/cardforge-workshop-cover.webp');
    expect(hero).not.toContain('StudioProductProof');
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

  it('places an interactive real-renderer walkthrough directly below the cover', () => {
    const page = readSource('src/app/page.tsx');
    const hero = readSource('src/features/public-site/components/OutcomeHero.tsx');
    const showcase = readSource('src/features/public-site/components/InteractiveStudioShowcase.tsx');

    expect(page).toContain('<PublicSiteShell');
    expect(page).toContain('<OutcomeHero');
    expect(page).toContain('<InteractiveStudioShowcase');
    expect(page.indexOf('<OutcomeHero')).toBeLessThan(page.indexOf('<InteractiveStudioShowcase'));
    expect(page.indexOf('<InteractiveStudioShowcase')).toBeLessThan(page.indexOf('<WorkflowProof'));
    expect(page).not.toContain('cardforge-hero-workbench.png');
    expect(hero).toContain('cardforge-workshop-cover.webp');
    expect(showcase).toContain('Layout Studio');
    expect(showcase).toContain('Generator');
    expect(showcase).toContain('Finished Sets');
    expect(showcase).toContain('/card-assets/showcase/studio-layout.jpg');
    expect(showcase).toContain('/card-assets/showcase/studio-generator-single.jpg');
    expect(showcase).toContain('/card-assets/showcase/studio-generator-bulk.jpg');
    expect(showcase).toContain('unoptimized');
    expect(showcase).toContain("maxWidth: `${width}px`");
    expect(showcase).toContain('w-auto max-w-full');
    expect(showcase).not.toContain('sizes="(min-width: 1280px) 1180px, 94vw"');
    expect(showcase).toContain('activeGeneratorView');
    expect(showcase).toContain('<CardPreview');
    expect(showcase).toContain('createBulkDisplayCards');
    expect(showcase).toContain("fetch('/api/templates'");
    expect(showcase).toContain('onPointerDownCapture');
    expect(showcase).toContain('onKeyDownCapture');
    expect(showcase).toContain('prefers-reduced-motion: reduce');
    expect(showcase).not.toContain('Generator rows preview');
    expect(showcase).not.toContain('Field inspector preview');
  });

  it('keeps access, founder trust, and one final product conversion without a duplicate support link', () => {
    const page = readSource('src/app/page.tsx');
    const founder = readSource('src/features/public-site/components/FounderStrip.tsx');

    expect(page).toContain('<AccessComparison');
    expect(page).toContain('<FounderStrip');
    expect(page).toContain('Build your first set.');
    expect(founder).toContain('Built independently by Cameron Locke');
    expect(founder).toContain('href="/cameron"');
    expect(founder).not.toContain('href="/cameron#support"');
  });
});
