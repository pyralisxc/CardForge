import { expect, test } from '@playwright/test';

const axePath = require.resolve('axe-core/axe.min.js');

const publicRoutes = ['/', '/examples', '/about', '/access', '/cameron', '/support'] as const;

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: Array<{ html: string; failureSummary?: string }>;
}

test.describe('public-site accessibility', () => {
  for (const route of publicRoutes) {
    test(`${route} has no automated WCAG A or AA violations`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 30_000 });
      await page.addScriptTag({ path: axePath });

      const violations = await page.evaluate(async () => {
        const axe = (window as unknown as {
          axe: {
            run: (
              context: Document,
              options: { runOnly: { type: 'tag'; values: string[] } },
            ) => Promise<{ violations: AxeViolation[] }>;
          };
        }).axe;

        const results = await axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
          },
        });
        return results.violations;
      });

      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }
});
