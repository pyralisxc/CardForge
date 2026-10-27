import { buildSync } from 'esbuild';
import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../../../tailwind.config';
const bundle = buildSync({ entryPoints: ['tests/product/fixtures/libraryTemplateIdentity.tsx'], bundle: true,
  platform: 'browser', format: 'iife', write: false, outfile: join(tmpdir(), 'library-template-identity.js'),
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' } });
const appCss = postcss([tailwindcss(tailwindConfig)]).process((readFileSync('src/app/cardforgePresentation.css', 'utf8') + readFileSync('src/app/globals.css', 'utf8')).replace(/@import ['"]([^'"]+)['"];?/g, (_, path: string) => readFileSync(join('src/app', path), 'utf8')), { from: 'src/app/globals.css' });
for (const width of [390, 1440]) {
  test(`@golden exact Template pixels and revision attribution at ${width}px`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    const requests: string[] = [];
    await page.route('**/*', route => {
      if (route.request().url().endsWith('/__library-template-proof') && route.request().method() === 'GET') return route.fulfill({
        contentType: 'text/html', body: '<html><head><style>*{box-sizing:border-box}body{margin:0;font-family:sans-serif}button{margin:3px}</style></head><body></body></html>',
      });
      const url = new URL(route.request().url());
      if (url.origin === 'http://localhost:9002' && route.request().method() === 'GET'
        && ['/fonts/lato/Lato-Regular.ttf', '/fonts/lato/Lato-Bold.ttf', '/fonts/spectral/Spectral-Bold.ttf'].includes(url.pathname)) {
        return route.fulfill({ contentType: 'font/ttf', body: readFileSync(join('public', url.pathname)) });
      }
      requests.push(`${route.request().method()} ${route.request().url()}`); return route.abort();
    });
    await page.goto('/__library-template-proof');
    await page.addStyleTag({ content: (await appCss).css });
    for (const file of bundle.outputFiles.filter(file => file.path.endsWith('.css'))) await page.addStyleTag({ content: file.text });
    await page.addScriptTag({ content: bundle.outputFiles.find(file => file.path.endsWith('.js'))!.text });
    const detail = width > 640 ? page.getByRole('complementary', { name: 'Details for Same name' }) : page.getByRole('dialog');
    const close = async () => {
      if (width > 640) await detail.getByRole('button', { name: 'Close details for Same name' }).click();
      else await page.keyboard.press('Escape');
      await expect(detail).not.toBeVisible();
    };
    for (const [selection, color] of [['A', [255, 0, 0]], ['B', [0, 0, 255]], ['history', [0, 255, 0]], ['fork', [255, 255, 0]]] as const) {
      await page.getByRole('button', { name: `Select ${selection}`, exact: true }).click();
      for (const [name, region] of [['tile', page.getByTestId('template-tile')], ['details', detail]] as const) {
        if (name === 'details') {
          await page.getByRole('button', { name: 'Open Details', exact: true }).click();
          await expect(detail).toBeVisible();
          await detail.evaluate(async node => { await Promise.all(node.getAnimations().map(animation => animation.finished)); });
        }
        const preview = region.locator('[aria-label="Same name preview"]'); await expect(preview).toBeVisible();
        const png = await preview.screenshot({ path: info.outputPath(`${selection}-${name}.png`) });
        const pixels = await page.evaluate(async ({ png, color }) => {
          const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
          const data = context.getImageData(0, 0, image.width, image.height).data; let matching = 0;
          for (let i = 0; i < data.length; i += 4) if (color.every((value, channel) => Math.abs(data[i + channel] - value) < 4)) matching++;
          return { width: image.width, height: image.height, matching };
        }, { png: png.toString('base64'), color: [...color] });
        expect(pixels.matching, `${selection} ${name} actual rendered pixels`).toBeGreaterThan(1000);
        await info.attach(`${selection}-${name}`, { body: png, contentType: 'image/png' });
      }
      await close();
    }
    for (const selection of ['missing', 'missing-history']) {
      await page.getByRole('button', { name: `Select ${selection}`, exact: true }).click();
      await expect(page.getByTestId('template-tile').getByText('Template preview unavailable')).toBeVisible();
      await page.getByRole('button', { name: 'Open Details', exact: true }).click();
      await expect(detail.getByText('Template preview unavailable')).toBeVisible();
      await close();
    }
    await page.getByRole('button', { name: 'Select mixed', exact: true }).click();
    for (const viewer of ['A', 'B', 'C']) {
      await page.getByRole('button', { name: `Viewer ${viewer}`, exact: true }).click();
      await expect(page.getByTestId('source-label')).toHaveText(viewer === 'A' ? 'Your revision' : 'Author A');
      await page.getByRole('button', { name: 'Open Details', exact: true }).click();
      await expect(detail.getByText('Author A', { exact: true })).toBeVisible();
      await expect(detail.getByText(viewer === 'C' ? 'Shared Pipeline' : 'You contributed to this lineage', { exact: true })).toBeVisible();
      await info.attach(`viewer-${viewer}`, { body: await page.screenshot({ path: info.outputPath(`viewer-${viewer}.png`) }), contentType: 'image/png' });
      await close();
    }
    expect(errors).toEqual([]);
    expect(requests).toEqual([]);
  });
}
