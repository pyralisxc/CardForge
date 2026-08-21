import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeSiteContentBlockInput } from '@/features/public-site/model/siteContent';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('owner public presentation controls', () => {
  it('uses owner configuration for the landing demonstration and keeps the native renderer', () => {
    expect(source('src/app/page.tsx')).toContain('examples={showcaseExamples}');
    expect(source('src/features/public-site/components/InteractiveStudioShowcase.tsx')).toContain('visibleExamples.map');
    expect(source('src/features/owner/components/OwnerHomepageShowcasePanel.tsx')).toContain('loadCardForgeCatalog');
    expect(source('src/features/owner/components/OwnerHomepageShowcasePanel.tsx')).toContain('Accessibility description');
    expect(source('src/features/public-site/components/FinishedSetShowcase.tsx')).toContain('createBulkDisplayCards');
    expect(source('src/features/public-site/components/FinishedSetShowcase.tsx')).toContain('<CardPreview');
  });

  it('requires dynamic values in owner-editable showcase copy', () => {
    expect(normalizeSiteContentBlockInput({ slug: 'landing.showcase.finished.summary', body: 'A complete set of {count} rendered cards' })).toMatchObject({ ok: true });
    expect(normalizeSiteContentBlockInput({ slug: 'landing.showcase.finished.summary', body: 'A complete rendered set' })).toEqual({ ok: false, message: 'This site copy must include the {count} dynamic token.' });
    expect(normalizeSiteContentBlockInput({ slug: 'landing.showcase.footer.rendering', body: 'Rendered live with {brand}' })).toMatchObject({ ok: true });
  });
});
