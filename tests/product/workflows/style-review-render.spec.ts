import { buildSync } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../../../tailwind.config';
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

const libraryCss = postcss([tailwindcss(tailwindConfig)]).process((readFileSync('src/app/cardforgePresentation.css', 'utf8') + readFileSync('src/app/globals.css', 'utf8')).replace(/@import ['"]([^'"]+)['"];?/g, (_, path: string) => readFileSync(join('src/app', path), 'utf8')), { from: 'src/app/globals.css' });
for (const width of [390, 1440]) test(`@golden Library same-name Style and Divider retain distinct visuals and selection at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  const unexpected: string[] = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET') {
      if (url.pathname === '/__library-style-proof') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0}</style></head><body></body></html>' });
      if (['/synthetic-divider.svg', '/historical.svg'].includes(url.pathname)) return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="60"><rect y="20" width="240" height="20" fill="${url.pathname === '/historical.svg' ? '#00aa44' : '#0066ff'}"/></svg>` });
      if (['/fonts/spectral/Spectral-Bold.ttf', '/fonts/lato/Lato-Regular.ttf', '/fonts/lato/Lato-Bold.ttf'].includes(url.pathname)) return route.fulfill({ contentType: 'font/ttf', body: readFileSync(join('public', url.pathname)) });
      if (url.pathname === '/missing.svg') return route.fulfill({ status: 404 });
    }
    unexpected.push(`${route.request().method()} ${url.pathname}`); return route.abort();
  });
  await page.goto('/__library-style-proof?collision=1');
  await page.addStyleTag({ content: (await libraryCss).css });
  for (const file of libraryFixture.outputFiles.filter(f => f.path.endsWith('.css'))) await page.addStyleTag({ content: file.text });
  await page.addScriptTag({ content: libraryFixture.outputFiles.find(f => f.path.endsWith('.js'))!.text });
  const tile = (id: string) => page.locator(`[id="library-object-pipeline:${id}"]`);
  const detail = () => width > 640 ? page.getByRole('complementary', { name: 'Details for Gilded Filigree' }) : page.getByRole('dialog');
  const settleDetail = async () => {
    await detail().evaluate(async node => { await Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished)); });
    const visual = detail().locator('img, [aria-label$="style preview"]').first();
    await visual.scrollIntoViewIfNeeded();
    const bounds = await visual.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
  };
  const closeMobile = async () => { if (width <= 640) await detail().getByRole('button', { name: 'Close', exact: true }).click(); };
  await expect(tile('svg-gilded').locator('img')).toBeVisible();
  await expect(tile('style-gilded').locator('[aria-label="Gilded Filigree style preview"]')).toHaveCSS('background-color', 'rgb(255, 215, 0)');
  await expect(tile('missing-svg')).toContainText('Preview unavailable');
  await tile('svg-gilded').click();
  await expect(page.getByTestId('selected-identity')).toHaveText('pipeline:svg-gilded');
  const image = detail().locator('img'); await expect(image).toHaveAttribute('src', '/synthetic-divider.svg');
  const pixels = await image.evaluate(async (node: HTMLImageElement) => {
    await node.decode(); const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 60;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(node, 0, 0);
    return [...ctx.getImageData(120, 30, 1, 1).data];
  });
  expect(pixels).toEqual([0, 102, 255, 255]);
  await settleDetail();
  await page.screenshot({ path: info.outputPath('divider.png') }); await info.attach('same-name-divider', { path: info.outputPath('divider.png'), contentType: 'image/png' });
  await closeMobile();
  await tile('style-gilded').click();
  await expect(page.getByTestId('selected-identity')).toHaveText('pipeline:style-gilded');
  await expect(detail().locator('img')).toHaveCount(0);
  const swatch = detail().locator('[aria-label="Gilded Filigree style preview"]');
  await expect(swatch).toHaveCSS('background-color', 'rgb(255, 215, 0)');
  expect((await swatch.boundingBox())!.width).toBeGreaterThan(100);
  await settleDetail();
  await page.screenshot({ path: info.outputPath('style.png') }); await info.attach('same-name-style', { path: info.outputPath('style.png'), contentType: 'image/png' });
  await closeMobile();
  await tile('missing-svg').click(); await expect(detail()).toContainText('Preview unavailable'); await expect(detail().locator('[aria-label$="style preview"]')).toHaveCount(0);
  await closeMobile();
  await page.getByRole('button', { name: 'Toggle historical-only projection' }).click();
  await tile('svg-gilded').click();
  await expect(detail().locator('img')).toHaveAttribute('src', '/historical.svg');
  await expect(detail()).toContainText('Revision 1');
  await settleDetail();
  await page.screenshot({ path: info.outputPath('historical.png') }); await info.attach('historical-own-source', { path: info.outputPath('historical.png'), contentType: 'image/png' });
  expect(unexpected).toEqual([]);
});

const richTextFixture = buildSync({ entryPoints: ['tests/product/fixtures/richTextComposition.tsx'], bundle: true,
  platform: 'browser', format: 'iife', write: false, outfile: join(tmpdir(), 'rich-text-composition.js'),
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' } });
for (const width of [390, 1440]) test(`@golden composes native Bold Italic Underline through save reopen and PNG at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__rich-composition') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' });
    if (url.pathname.startsWith('/fonts/') && !url.pathname.includes('..')) return route.fulfill({ body: readFileSync(join('public', url.pathname)) });
    return route.abort();
  });
  const mount = async () => {
    await page.goto('/__rich-composition');
    await page.addStyleTag({ content: (await libraryCss).css });
    for (const file of richTextFixture.outputFiles.filter(f => f.path.endsWith('.css'))) await page.addStyleTag({ content: file.text });
    await page.addScriptTag({ content: richTextFixture.outputFiles.find(f => f.path.endsWith('.js'))!.text });
  };
  await mount();
  const editor = page.locator('[contenteditable="true"]');
  await editor.click(); await editor.press('ControlOrMeta+a');
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await page.getByRole('button', { name: 'Italic', exact: true }).click();
  const rendered = page.getByTestId('canonical-card').getByText('Combined words', { exact: true });
  await expect(rendered).toHaveCSS('font-weight', '700'); await expect(rendered).toHaveCSS('font-style', 'italic');
  await page.getByRole('button', { name: 'Underline', exact: true }).click();
  await expect(rendered).toHaveCSS('text-decoration-line', 'underline');
  await expect(page.getByTestId('saved-syntax')).toHaveText('___**Combined words**___');
  await page.getByRole('button', { name: 'Save local text' }).click();
  await mount();
  await expect(editor).toHaveText('Combined words');
  await expect(rendered).toHaveCSS('font-weight', '700'); await expect(rendered).toHaveCSS('font-style', 'italic'); await expect(rendered).toHaveCSS('text-decoration-line', 'underline');
  await page.getByRole('button', { name: 'Export canonical PNG' }).click();
  const image = page.getByAltText('Canonical composed marks PNG'); await expect(image).toBeVisible();
  expect(await image.evaluate(async (node: HTMLImageElement) => { await node.decode(); return node.naturalWidth; })).toBeGreaterThan(100);
  await page.screenshot({ path: info.outputPath('rich-editor-preview.png') });
  await info.attach('native-editor-and-canonical-preview', { path: info.outputPath('rich-editor-preview.png'), contentType: 'image/png' });
  await image.screenshot({ path: info.outputPath('rich-export.png') });
  await info.attach('canonical-composed-marks-export', { path: info.outputPath('rich-export.png'), contentType: 'image/png' });
});

test('@golden ColorField commits Enter and blur, cancels Escape, and never submits its parent form', async ({ page }) => {
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }));
  await page.goto('/__rich-composition');
  await page.addStyleTag({ content: (await libraryCss).css });
  await page.addScriptTag({ content: richTextFixture.outputFiles.find(f => f.path.endsWith('.js'))!.text });
  await page.getByRole('button', { name: 'Color #112233', exact: true }).click();
  const hex = page.getByTitle('Hex color value');
  await hex.fill('#aabbcc'); await hex.press('Enter');
  await expect(page.getByTestId('color')).toHaveText('#aabbcc');
  await expect(page.getByTestId('form-submits')).toHaveText('0');
  await hex.fill('#123'); await hex.press('Enter');
  await expect(page.getByTestId('color')).toHaveText('#aabbcc');
  await hex.fill('#ff0000'); await hex.press('Escape');
  await expect(page.getByTestId('color')).toHaveText('#aabbcc');
  await page.getByRole('button', { name: 'Color #aabbcc', exact: true }).click();
  await hex.fill('#00cc66'); await hex.press('Tab');
  await expect(page.getByTestId('color')).toHaveText('#00cc66');
  await hex.fill('invalid'); await page.getByRole('button', { name: 'Outside color' }).click({ force: true });
  await expect(page.getByTestId('color')).toHaveText('#00cc66');
  await expect(page.getByTestId('form-submits')).toHaveText('0');
});
