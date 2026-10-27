import { buildSync } from 'esbuild';
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
