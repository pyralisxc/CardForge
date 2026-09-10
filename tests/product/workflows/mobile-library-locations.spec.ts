import { devices, expect, test, type Locator } from '@playwright/test';

import { seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

test.use({ ...devices['Pixel 7'] });

test.describe('mobile Library location tools', () => {
  test.describe.configure({ timeout: 120_000 });

  const expectTouchTarget = async (control: Locator) => {
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport({ ratio: 1 });
    const bounds = await control.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  };

  test('@golden keeps scrolled Locations & connections controls above the fixed mobile navigation', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/account?section=library&tool=locations', { waitUntil: 'domcontentloaded', timeout: 120_000 });

    const tool = page.getByRole('region', { name: 'Locations & connections', exact: true });
    await expect(tool).toBeVisible();
    const mobileNav = page.locator('[class*="mobileNav"]');
    await expect(mobileNav).toBeVisible();

    const [toolZ, navZ] = await Promise.all([
      tool.evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex || '0', 10)),
      mobileNav.evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex || '0', 10)),
    ]);
    expect(toolZ).toBeGreaterThan(navZ);

    const storage = tool.getByRole('region', { name: 'Storage and connections', exact: true });
    const driveLocation = storage.getByRole('button', { name: /Google Drive projects/ });
    await expectTouchTarget(driveLocation);
    await driveLocation.tap();

    await expect(tool.getByRole('heading', { name: 'Google Drive projects', exact: true })).toBeVisible();
    const signIn = tool.getByRole('link', { name: 'Sign in to connect', exact: true });
    await expectTouchTarget(signIn);
    await signIn.click({ trial: true });

    await test.info().attach('mobile-library-locations', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});
