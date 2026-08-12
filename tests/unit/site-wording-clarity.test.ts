import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

describe('site wording clarity', () => {
  it('keeps internal workflow vocabulary out of creator-facing Studio copy', () => {
    const templateDisplay = readSource('src/domain/templates/display.ts');
    const imageInspector = readSource('src/features/template-editor/components/ImageInspectorPanel.tsx');
    const textInspector = readSource('src/features/template-editor/components/TextElementInspector.tsx');

    expect(templateDisplay).toContain('CardForge Library');
    expect(templateDisplay).not.toContain("return 'Pipeline'");
    expect(imageInspector).toContain('Library and personal images');
    expect(imageInspector).not.toContain('Reviewed & Local Image Assets');
    expect(textInspector).toContain('In Make cards');
    expect(textInspector).not.toContain('In Generate');
  });

  it('uses direct owner and analytics navigation labels', () => {
    const owner = readSource('src/features/owner/components/OwnerConsolePage.tsx');
    const summary = readSource('src/features/owner/components/OwnerConsoleSummary.tsx');
    const analytics = readSource('src/features/analytics/components/OwnerAnalyticsPanel.tsx');

    expect(owner).toContain('System Readiness');
    expect(owner).toContain('Accounts &amp; Billing');
    expect(owner).toContain('Roadmap Rules');
    expect(owner).toContain('Legal &amp; Configuration');
    expect(summary).toContain('CardForge Owner Console');
    expect(analytics).toContain('Organic Analytics');
    expect(analytics).toContain('Impressions');
    expect(analytics).not.toContain('Organic Analytics Cockpit');
  });

  it('removes stale internal legal and brand commentary from public pages', () => {
    const legal = readSource('src/features/legal/components/PublicLegalPage.tsx');
    const about = readSource('src/app/about/page.tsx');

    expect(legal).not.toContain('before paid production use');
    expect(about).not.toContain('Independent brand notice');
    expect(about).not.toContain('cardforge.com');
  });
});
