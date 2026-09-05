import { devices, expect, test } from '@playwright/test';
import { seedGuestScaleWorkspace, openScaleSet } from './helpers/projectScaleBrowser';

for (const mobile of [false, true]) {
  test.describe(`Card actions on ${mobile ? 'mobile' : 'desktop'}`, () => {
    test.use(mobile ? { viewport: devices['Pixel 7'].viewport, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
    test('@golden reaches individual image formats, sharing, and editable package from the focused card', async ({ page }) => {
      test.setTimeout(120_000);
      await seedGuestScaleWorkspace(page, 100, { staleToolTemplate: true });
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await openScaleSet(page, 100);
      await page.getByRole('button', { name: 'Scale Card 0001. Scale Fixture Template', exact: true }).dblclick();
      const actions = page.getByRole('group', { name: 'Card downloads and sharing' });
      await expect(actions).toBeVisible();
      await actions.getByRole('button', { name: 'Download individual card' }).click();
      for (const format of ['PNG', 'JPEG', 'WebP']) {
        for (const face of ['front', 'back']) {
          await expect(page.getByRole('menuitem', { name: `Download ${face} as ${format}`, exact: true })).toBeVisible();
        }
      }
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: `Download front as ${mobile ? 'WebP' : 'PNG'}`, exact: true }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(mobile ? /\.webp$/ : /\.png$/);
      expect(await download.failure()).toBeNull();
      await actions.getByRole('button', { name: 'Share card', exact: true }).click();
      await expect(page.getByRole('dialog')).toContainText('Copy caption');
      await page.keyboard.press('Escape');
      await expect(actions.getByRole('button', { name: 'Export editable card' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Edit Artifact', exact: true })).toBeVisible();
    });
  });
}
