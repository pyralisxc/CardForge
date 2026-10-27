import { buildSync } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const bundle = buildSync({ entryPoints: ['tests/product/fixtures/styleReviewRender.tsx'], bundle: true,
  platform: 'browser', format: 'iife', write: false, outfile: join(tmpdir(), 'style-review-render.js'),
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' } });
test('@golden renders the full synthetic corrected style with the canonical recipe and PNG exporter', async ({ page }, info) => {
  await page.goto('/');
  const css = await page.locator('head').evaluate(head => [...head.querySelectorAll('style,link[rel="stylesheet"]')].map(n => n.outerHTML).join('\n'));
  await page.route('**/__style-render-proof', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head>${css}</head><body></body></html>` }));
  await page.goto('/__style-render-proof');
  for (const file of bundle.outputFiles.filter(f => f.path.endsWith('.css'))) await page.addStyleTag({ content: file.text });
  await page.addScriptTag({ content: bundle.outputFiles.find(f => f.path.endsWith('.js'))!.text });
  await page.getByRole('button', { name: 'Render synthetic corrected style' }).click();
  const image = page.getByAltText('Synthetic corrected style'); await expect(image).toBeVisible();
  const pixels = await image.evaluate(async (node: HTMLImageElement) => {
    await node.decode(); const canvas = document.createElement('canvas'); canvas.width = node.naturalWidth; canvas.height = node.naturalHeight;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(node, 0, 0);
    return { width: canvas.width, height: canvas.height, center: [...ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data] };
  });
  expect(pixels.width).toBeGreaterThan(100); expect(pixels.height).toBeGreaterThan(pixels.width);
  expect(pixels.center).toEqual([0, 204, 102, 255]);
  await image.screenshot({ path: info.outputPath('synthetic-style.png') });
  await info.attach('Canonical synthetic corrected style', { path: info.outputPath('synthetic-style.png'), contentType: 'image/png' });
});

const libraryFixture = buildSync({ entryPoints: ['tests/product/fixtures/libraryStylePreview.tsx'], bundle: true,
  platform: 'browser', format: 'iife', write: false, outfile: join(tmpdir(), 'library-style-preview.js'),
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' } });
for (const width of [390, 1440]) {
  test(`@golden gives Library material Details a visible swatch at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const unexpectedRequests: string[] = [];
    await page.route('**/*', route => {
      if (route.request().url().endsWith('/__library-style-proof') && route.request().method() === 'GET') {
        return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0}</style></head><body></body></html>' });
      }
      unexpectedRequests.push(`${route.request().method()} ${route.request().url()}`);
      return route.abort();
    });
    await page.goto('/__library-style-proof');
    for (const file of libraryFixture.outputFiles.filter(f => f.path.endsWith('.css'))) await page.addStyleTag({ content: file.text });
    await page.addScriptTag({ content: libraryFixture.outputFiles.find(f => f.path.endsWith('.js'))!.text });
    const detail = width > 640 ? page.getByRole('complementary', { name: 'Details for Synthetic parchment' }) : page.getByRole('dialog');
    await expect(detail).toBeVisible();
    await detail.evaluate(async node => { await Promise.all(node.getAnimations().map(animation => animation.finished)); });
    const swatch = detail.locator('[aria-label="Synthetic parchment style preview"]');
    const geometry = await swatch.evaluate(node => {
      const rect = node.getBoundingClientRect(); const parent = node.parentElement!.getBoundingClientRect();
      return { width: rect.width, height: rect.height, left: rect.left, right: rect.right, parentWidth: parent.width, background: getComputedStyle(node).backgroundColor };
    });
    await writeFile(info.outputPath('geometry.json'), JSON.stringify(geometry, null, 2));
    await info.attach('material-details-geometry', { path: info.outputPath('geometry.json'), contentType: 'application/json' });
    await page.screenshot({ path: info.outputPath('details.png') });
    await info.attach('material-details', { path: info.outputPath('details.png'), contentType: 'image/png' });
    expect(geometry.width).toBeGreaterThanOrEqual(100);
    expect(geometry.height).toBeGreaterThanOrEqual(75);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(width);
    expect(geometry.background).toBe('rgb(235, 211, 159)');
    const tile = await page.getByTestId('material-tile').locator('[aria-label="Synthetic parchment style preview"]').boundingBox();
    expect(tile!.width).toBeGreaterThanOrEqual(100);
    expect(tile!.height).toBeGreaterThanOrEqual(75);
    expect(unexpectedRequests).toEqual([]);
  });
}
