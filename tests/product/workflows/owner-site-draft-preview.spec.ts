import { buildSync } from 'esbuild';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from '@playwright/test';

// A test-only React root exercises real Owner components without a privileged
// route, fabricated account session, provider mutation or production test page.
const fixture = buildSync({
  entryPoints: ['tests/product/fixtures/ownerSiteDraftPreview.tsx'], bundle: true,
  platform: 'browser', format: 'iife', write: false,
  outfile: join(tmpdir(), 'cardforge-owner-preview-test.js'),
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
});

test('@golden keeps responsive draft theme, nested menu and keyboard focus inside its iframe', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const presentation = await page.evaluate(() => ({
    styles: Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML).join('\n'),
    htmlClass: document.documentElement.className,
    bodyClass: document.body.className,
  }));
  // A modal mounted into an independently bundled root must not race Next's
  // hydration (Radix legitimately changes aria-hidden outside its own root).
  // This route exists only in the test browser, with the application's styles.
  await page.route('**/__owner-preview-proof', (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1">${presentation.styles}</head><body></body></html>`,
  }));
  await page.goto('/__owner-preview-proof');
  await page.evaluate(({ htmlClass, bodyClass }) => {
    document.documentElement.className = htmlClass;
    document.body.className = bodyClass;
  }, presentation);
  for (const file of fixture.outputFiles.filter((item) => item.path.endsWith('.css'))) await page.addStyleTag({ content: file.text });
  await page.addScriptTag({ content: fixture.outputFiles.find((item) => item.path.endsWith('.js'))!.text });
  const outer = page.getByRole('dialog', { name: 'Isolated Owner preview proof', exact: true });
  await expect(outer).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.cfPalette = 'slate';
    document.documentElement.dataset.cfAccent = 'arcane';
    document.documentElement.dataset.cfCorners = 'square';
    document.documentElement.dataset.cfContrast = 'high';
  });
  const viewport = outer.getByRole('combobox', { name: 'Viewport', exact: true });
  await viewport.selectOption('phone');
  const frame = outer.frameLocator('iframe');
  await expect(frame.getByRole('heading', { name: 'Curated website preview', exact: true })).toBeVisible();
  await expect(frame.locator('html')).toHaveAttribute('data-cf-palette', 'slate');
  await expect(frame.locator('html')).toHaveAttribute('data-cf-accent', 'arcane');
  await expect(frame.locator('html')).toHaveAttribute('data-cf-corners', 'square');
  await expect(frame.locator('html')).toHaveAttribute('data-cf-contrast', 'high');
  const trigger = frame.getByRole('button', { name: 'Open menu', exact: true });
  await trigger.click();
  const menu = frame.getByRole('dialog', { name: 'Navigation', exact: true });
  await expect(menu).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  const first = menu.getByRole('link', { name: 'How it works', exact: true });
  const last = menu.getByRole('button', { name: 'Close', exact: true });
  await expect(first).toBeFocused();
  await first.press('Shift+Tab'); await expect(last).toBeFocused();
  await last.press('Tab'); await expect(first).toBeFocused();
  await first.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(outer).toBeVisible();
  const canvas = page.frames().find((item) => item.parentFrame());
  const geometry = await canvas!.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth, scripts: document.querySelectorAll('script').length }));
  expect(geometry).toEqual({ width: 390, scroll: 390, scripts: 0 });
  await viewport.selectOption('tablet');
  await expect(outer.locator('iframe')).toHaveCSS('width', '768px');
  await viewport.selectOption('desktop');
  await expect(outer.locator('iframe')).toHaveCSS('width', '1440px');
});
