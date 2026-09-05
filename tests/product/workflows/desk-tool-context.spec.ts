import { devices, expect, test } from '@playwright/test';

import { openScaleSet, seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';
import { createProjectScaleFixture } from '../../fixtures/projectScale';

for (const mobile of [false, true]) {
  test.describe(`Desk tool context on ${mobile ? 'mobile' : 'desktop'}`, () => {
    test.use(mobile ? { viewport: devices['Pixel 7'].viewport, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });

    test('protects an edited card and opens Output without mounting another editor', async ({ page }) => {
      test.setTimeout(120_000);
      await seedGuestScaleWorkspace(page, 100);
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await openScaleSet(page, 100);
      await page.getByRole('button', { name: 'Scale Card 0001. Scale Fixture Template', exact: true }).dblclick();
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      const artwork = page.getByRole('textbox', { name: /Artwork \(Image URL or Upload\)/ });
      const original = await artwork.inputValue();
      await artwork.fill('https://example.com/draft.png');
      await page.getByRole('button', { name: 'Review & close', exact: true }).click();
      await expect(page.getByRole('alertdialog')).toContainText('unsaved changes');
      await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
      await expect(artwork).toHaveValue('https://example.com/draft.png');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(page.getByRole('alertdialog')).toContainText('Discard unsaved card changes');
      await page.keyboard.press('Escape');
      await expect(artwork).toHaveValue('https://example.com/draft.png');
      await page.getByRole('button', { name: 'Review & close', exact: true }).click();
      await page.getByRole('button', { name: 'Close Design', exact: true }).click();
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(artwork).toHaveValue(original);
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.getByRole('button', { name: 'Back to Set', exact: true }).click();
      await page.getByRole('button', { name: 'More Set actions', exact: true }).click();
      await expect(page.getByRole('menuitem', { name: 'Save & move', exact: true })).toBeVisible();
      await page.getByRole('menuitem', { name: 'Export / print', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Output 100 Card Scale Set', exact: true })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Template canvas', exact: true })).toHaveCount(0);
      await expect(artwork).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Remove all cards', exact: true })).toHaveCount(0);
    });

    test('@golden opens the Set template and back instead of stale tool selections', async ({ page }) => {
      test.setTimeout(120_000);
      await seedGuestScaleWorkspace(page, 100, { staleToolTemplate: true });
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await openScaleSet(page, 100);
      await page.getByRole('button', { name: 'Design', exact: true }).click();
      const design = page.getByRole('region', { name: 'Design Artifacts', exact: true });
      await expect(design).toBeVisible();
      if (mobile) await expect(design.getByRole('toolbar', { name: 'Canvas controls' })).toContainText('Scale Fixture Template');
      else {
        await page.getByRole('button', { name: 'Card Setup', exact: true }).click();
        await expect(page.getByLabel('Template name', { exact: true })).toHaveValue('Scale Fixture Template');
      }
      const rail = page.locator('[data-desk-context-rail][data-depth="tool"]');
      await rail.getByRole('button', { name: 'Done', exact: true }).click();

      await page.getByRole('button', { name: 'Generate', exact: true }).click();
      await expect(page.locator('#deck-front-template')).toContainText('Scale Fixture Template');
      await expect(page.locator('#deck-backing-template')).toContainText('Scale Fixture Back');
      await expect(page.getByRole('button', { name: 'Close Generate', exact: true, includeHidden: true })).toHaveCount(0);
      await rail.getByRole('button', { name: 'Done', exact: true }).focus();
      await expect(rail.getByRole('button', { name: 'Done', exact: true })).toBeFocused();

      await page.getByRole('button', { name: 'Edit selected back', exact: true }).click();
      await expect(design).toBeVisible();
      if (mobile) await expect(design.getByRole('toolbar', { name: 'Canvas controls' })).toContainText('Scale Fixture Back');
      else {
        await page.getByRole('button', { name: 'Card Setup', exact: true }).click();
        await expect(page.getByLabel('Template name', { exact: true })).toHaveValue('Scale Fixture Back');
      }
    });
  });
}

test('@golden waits for catalog Templates before opening a deep-linked Generate tool', async ({ page }) => {
  test.setTimeout(120_000);
  await seedGuestScaleWorkspace(page, 100, { staleToolTemplate: true, catalogToolTemplates: true });
  const front = createProjectScaleFixture(100).userTemplates[0]!;
  const back = { ...front, id: 'scale-back', name: 'Scale Fixture Back', templateUsage: 'back-preset' };
  let releaseCatalog!: () => void;
  let catalogRequested!: () => void;
  const catalogReady = new Promise<void>((resolve) => { releaseCatalog = resolve; });
  const requestStarted = new Promise<void>((resolve) => { catalogRequested = resolve; });
  await page.route('**/api/catalog/studio-bootstrap', async (route) => {
    catalogRequested();
    await catalogReady;
    await route.fulfill({ json: {
      templates: { defaults: [front, back], userTemplates: [] },
      styles: { styles: [] },
      studioDefaults: { defaultTemplateId: front.id },
    } });
  });
  await page.goto('/account?focus=set%3Ascale-set-100&tool=generate', { waitUntil: 'domcontentloaded' });
  await requestStarted;
  await expect(page.locator('#deck-front-template')).toHaveCount(0);
  releaseCatalog();
  await expect(page.locator('#deck-front-template')).toContainText('Scale Fixture Template', { timeout: 30_000 });
  await expect(page.locator('#deck-backing-template')).toContainText('Scale Fixture Back');
});
