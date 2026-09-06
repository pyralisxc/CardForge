import { devices, expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

import { openScaleSet, seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

for (const mobile of [false, true]) {
  test.describe(`Template canvas handoff on ${mobile ? 'mobile' : 'desktop'}`, () => {
    test.use(mobile ? { viewport: devices['Pixel 7'].viewport, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });

    test('@golden shows the selected Set template canvas inside the visible workspace', async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      await seedGuestScaleWorkspace(page, 100, { staleToolTemplate: true, templateContent: true });
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await openScaleSet(page, 100);
      await page.getByRole('button', { name: 'Design back template Scale Fixture Back, used by 100 cards in this Set', exact: true }).click();
      const canvas = page.getByRole('region', { name: 'Template canvas', exact: true });
      await expect(canvas).toBeVisible();
      await expect(canvas.getByText('Scale Fixture Back', { exact: true })).toBeVisible();
      await expect(canvas.locator('[data-freeform-element-id="scale-back-heading"][data-cardforge-editor-overlay]')).toBeVisible();
      if (!mobile) await expect(page.getByRole('combobox', { name: 'Choose Template', exact: true })).toContainText('Scale Fixture Back');
      await page.screenshot({ path: testInfo.outputPath('template-canvas.png') });
      const geometry = await canvas.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const stage = node.closest('[data-cardforge-stage]')!.getBoundingClientRect();
        const tool = node.closest('[data-desk-tool-surface]')!.getBoundingClientRect();
        return { canvas: { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }, stage: { x: stage.x, y: stage.y, right: stage.right, bottom: stage.bottom }, toolBottom: tool.bottom, viewport: { width: window.innerWidth, height: window.innerHeight } };
      });
      expect(geometry.canvas.width).toBeGreaterThan(120);
      expect(geometry.canvas.height).toBeGreaterThan(160);
      expect(geometry.canvas.x).toBeGreaterThanOrEqual(geometry.stage.x);
      expect(geometry.canvas.y).toBeGreaterThanOrEqual(geometry.stage.y);
      expect(geometry.canvas.right).toBeLessThanOrEqual(geometry.stage.right);
      expect(geometry.canvas.bottom).toBeLessThanOrEqual(Math.min(geometry.stage.bottom, geometry.toolBottom, geometry.viewport.height));
    });

    test('@golden installs the official 52-card starter and opens its actual design through a loading boundary', async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      const definition = JSON.parse(await readFile('data/pipeline-bootstrap/sets/standard-playing-card-deck.json', 'utf8'));
      const templateSource = await readFile(`data/pipeline-bootstrap/templates/${definition.templatePath}`, 'utf8');
      // Use the shipped authoring document and package builder; only asset hosts are local test routes.
      const template = JSON.parse(templateSource.replaceAll('bootstrap-media://', 'https://starter.cardforge.test/media/').replaceAll('site-fallback://', 'https://starter.cardforge.test/fallback/'));
      // Run the production ESM builder natively; Playwright loads this test suite as CommonJS.
      const body = execFileSync(process.execPath, ['--input-type=module', '-e', `
        import { createHash } from 'node:crypto';
        import { readFileSync } from 'node:fs';
        import { buildDeterministicStarterSetPackage, buildStarterSetProject } from './scripts/sync-pipeline-defaults.mjs';
        const { definition, template } = JSON.parse(readFileSync(0, 'utf8'));
        const project = buildStarterSetProject(definition, template);
        const assets = [];
        const projectRevision = createHash('sha256').update(JSON.stringify({ project, assets })).digest('hex');
        process.stdout.write(await buildDeterministicStarterSetPackage({
          cardforgeProject: 2, name: definition.name, savedAt: definition.savedAt, projectRevision, project, assets,
        }));
      `], { input: JSON.stringify({ definition, template }) });
      await page.route('https://starter.cardforge.test/**', async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname === '/starter.cardforge') await route.fulfill({ body, contentType: 'application/octet-stream' });
        else await route.fulfill({ path: pathname.startsWith('/media/') ? `data/pipeline-bootstrap${pathname}` : `public/site-fallbacks/${pathname.slice('/fallback/'.length)}` });
      });
      await page.route('**/api/catalog', (route) => route.fulfill({ json: { sets: { items: [{
        id: definition.id, name: definition.name, description: definition.description,
        packageUrl: 'https://starter.cardforge.test/starter.cardforge', previewUrl: null,
        access: 'free', source: 'official', revision: 2,
      }] } } }));
      const previewShareUrl = process.env.CARDFORGE_E2E_PREVIEW_SHARE_URL;
      if (previewShareUrl) await page.goto(previewShareUrl, { waitUntil: 'domcontentloaded' });
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Create your first Set', exact: true }).click();
      await page.getByRole('button', { name: /^Standard 52-card deck A complete editable/ }).click();
      const templateButton = page.getByRole('button', { name: 'Design template Standard 52-card deck Template, used by 52 cards in this Set', exact: true });
      await expect(templateButton).toBeVisible();
      let releaseChunks!: () => void;
      const chunksReady = new Promise<void>((resolve) => { releaseChunks = resolve; });
      await page.route('**/_next/static/**', async (route) => {
        if (route.request().resourceType() === 'script') await chunksReady;
        await route.continue();
      });
      try {
        await templateButton.click();
        await expect(page.getByRole('status').filter({ hasText: 'Loading workspace tools' })).toBeVisible();
      } finally {
        releaseChunks();
      }
      const canvas = page.getByRole('region', { name: 'Template canvas', exact: true });
      await expect(canvas.getByText('The Night Sentinel', { exact: true })).toBeVisible();
      await expect(canvas.locator('[data-cardforge-editor-overlay]')).toHaveCount(6);
      const artwork = canvas.getByRole('img', { name: 'Image for Card Artwork', exact: true });
      await expect(artwork).toBeVisible();
      await expect.poll(() => artwork.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await page.screenshot({ path: testInfo.outputPath('official-starter-studio.png') });
      await page.locator('[data-desk-context-rail]').getByRole('button', { name: 'Done', exact: true }).click();
      await expect(templateButton).toBeVisible();
    });
  });
}
