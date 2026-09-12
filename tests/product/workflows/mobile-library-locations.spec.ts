import { devices, expect, test, type Locator } from '@playwright/test';

import { openScaleSet, seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

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

  test('@golden keeps Locations controls scrollable above the fixed navigation in a constrained viewport', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.setViewportSize({ width: 320, height: 640 });
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
    const deviceLocation = storage.getByRole('button', { name: /This device/ });
    await expectTouchTarget(deviceLocation);
    await deviceLocation.tap();
    await expect(tool.getByRole('heading', { name: 'This device', exact: true })).toBeVisible();

    const scrollState = await storage.evaluate((element) => {
      let owner: HTMLElement | null = element.parentElement;
      while (owner) {
        const style = getComputedStyle(owner);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && owner.scrollHeight > owner.clientHeight + 1) {
          const before = owner.scrollTop;
          owner.scrollTop = owner.scrollHeight;
          return { before, after: owner.scrollTop, scrollHeight: owner.scrollHeight, clientHeight: owner.clientHeight };
        }
        owner = owner.parentElement;
      }
      return null;
    });
    expect(scrollState).not.toBeNull();
    expect(scrollState!.scrollHeight).toBeGreaterThan(scrollState!.clientHeight);
    expect(scrollState!.after).toBeGreaterThan(scrollState!.before);

    await tool.getByRole('button', { name: 'Close This device', exact: true }).tap();
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

  test('@golden keeps Desk navigation, commands, status truth, and compact actions while focusing work', async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100);
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });

    const command = page.getByRole('button', { name: 'Open commands', exact: true });
    await expectTouchTarget(command);
    await expect(page.getByRole('navigation', { name: 'Creative context', exact: true })).toHaveCount(0);

    const toolbar = page.locator('[data-desk-toolbar]');
    const filters = toolbar.locator('[data-mobile-desk-filters] > summary[aria-label="Open Desk filters"]');
    await expectTouchTarget(filters);
    await expectTouchTarget(toolbar.getByRole('button', { name: 'Desk view controls', exact: true }));
    await expect(toolbar.getByRole('button', { name: 'Zoom Desk out', exact: true })).toBeHidden();

    const status = page.locator('footer[aria-label="Environment status"]');
    await expect(status).toBeVisible();
    await expect(status.getByText('Saved', { exact: true })).toBeVisible();
    await expect(status.getByText('Private creator desk', { exact: true })).toBeHidden();

    const storageStatus = page.getByTitle('Open Locations & connections');
    await expectTouchTarget(storageStatus);
    await storageStatus.tap();
    const locations = page.getByRole('region', { name: 'Locations & connections', exact: true });
    await expect(locations).toBeVisible();
    await page.getByRole('button', { name: 'Done', exact: true }).tap();
    await expect(locations).toBeHidden();

    await openScaleSet(page, 100);
    const mobileNav = page.getByRole('navigation', { name: 'CardForge zones', exact: true });
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole('link', { name: 'Desk', exact: true })).toBeVisible();
    await expect(mobileNav.getByRole('link', { name: 'Library', exact: true })).toBeVisible();
    const profile = mobileNav.getByRole('link', { name: 'Profile', exact: true });
    await expect(profile).toBeVisible();

    await profile.tap();
    await expect(page).toHaveURL(/section=profile/u);
    await expectTouchTarget(page.getByRole('button', { name: 'Search or type a command', exact: true }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);

    await test.info().attach('mobile-desk-capability-parity', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});