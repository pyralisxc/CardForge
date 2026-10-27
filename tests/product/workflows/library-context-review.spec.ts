import { buildSync } from 'esbuild';
import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../../../tailwind.config';
const bundle = buildSync({ entryPoints: ['tests/product/fixtures/libraryContextReview.tsx'], bundle: true, platform: 'browser', format: 'iife', write: false,
  outfile: join(tmpdir(), 'library-context-review.js'), define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' } });
const appCss = postcss([tailwindcss(tailwindConfig)]).process((readFileSync('src/app/cardforgePresentation.css', 'utf8') + readFileSync('src/app/globals.css', 'utf8')).replace(/@import ['"]([^'"]+)['"];?/g, (_, path: string) => readFileSync(join('src/app', path), 'utf8')), { from: 'src/app/globals.css' });
async function mount(page: import('@playwright/test').Page, query = '') {
  const mutations: string[] = []; const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (route.request().method() !== 'GET') mutations.push(`${route.request().method()} ${route.request().url()}`);
    if (route.request().url().includes('/__library-context-proof')) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;background:#111;color:#eee}button,input,select,textarea{font:inherit}</style></head><body></body></html>' });
    return route.abort();
  });
  await page.goto(`/__library-context-proof${query}`);
  await page.addStyleTag({ content: (await appCss).css });
  for (const file of bundle.outputFiles.filter(f => f.path.endsWith('.css'))) await page.addStyleTag({ content: file.text });
  await page.addScriptTag({ content: bundle.outputFiles.find(f => f.path.endsWith('.js'))!.text });
  return { mutations, errors };
}
for (const width of [390, 1440]) test(`@golden Library exact governance, revision entry and close at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 }); const evidence = await mount(page);
  await page.getByRole('button', { name: 'Review & manage', exact: true }).click();
  await expect(page.getByLabel('Exact revision governance')).toBeVisible();
  await expect(page.getByText('Synthetic material revision one', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Newer revision must not replace selection', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('focused.png') });
  await info.attach('focused-selected-revision', { path: info.outputPath('focused.png'), contentType: 'image/png' });
  const panel = page.getByLabel('Exact revision governance');
  const bounds = await panel.boundingBox(); expect(bounds!.width).toBeGreaterThan(100); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
  expect(await panel.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Revise existing', exact: true }).click();
  await expect(page.getByLabel('Revision appearance preview')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit revision for review' })).toBeDisabled();
  await page.getByRole('button', { name: 'Close Pipeline tool', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review & manage', exact: true })).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Library search' })).toHaveValue('material');
  await page.getByRole('button', { name: 'Pipeline operations', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Pipeline rules' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Pipeline tool', exact: true }).click();
  expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([]);
});
for (const condition of ['missing', 'stale', 'historical']) test(`@golden Library blocks ${condition} exact selection without substitution`, async ({ page }) => {
  const evidence = await mount(page, `?${condition}=1`);
  await page.getByRole('button', { name: 'Review & manage', exact: true }).click();
  if (condition === 'historical') {
    await page.getByRole('button', { name: 'Revise existing', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('not the current published base');
    await expect(page.getByLabel('Revision appearance preview')).toHaveCount(0);
  } else {
    await expect(page.getByText(/no other revision was substituted/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage', exact: true })).toHaveCount(0);
  }
  expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([]);
});

for (const mode of ['revision', 'global']) test(`@golden Library ${mode} edits require explicit discard and cancel retains edits`, async ({ page }) => {
  const evidence = await mount(page);
  if (mode === 'revision') {
    await page.getByRole('button', { name: 'Review & manage', exact: true }).click();
    await page.getByRole('button', { name: 'Revise existing', exact: true }).click();
    await page.getByRole('button', { name: 'Color #ebd39f', exact: true }).click();
    await page.getByTitle('Hex color value').fill('#123456');
    await page.getByTitle('Hex color value').press('Tab');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Submit revision for review' })).toBeEnabled();
  } else {
    await page.getByRole('button', { name: 'Pipeline operations', exact: true }).click();
    await page.getByRole('tab', { name: 'Pipeline rules' }).click();
    await page.getByRole('button', { name: 'Solo owner review' }).click();
  }
  await page.getByRole('button', { name: 'Close Pipeline tool', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: 'Unsaved changes' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  if (mode === 'revision') await expect(page.getByRole('button', { name: 'Color #123456', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close Pipeline tool', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.getByRole('button', { name: mode === 'global' ? 'Pipeline operations' : 'Review & manage', exact: true })).toBeFocused();
  expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([]);
});

test('@golden Library Template revision prepares only a separate local draft with exact base pins', async ({ page }) => {
  const evidence = await mount(page, '?template=1');
  await page.getByRole('button', { name: 'Prepare local review draft in Design' }).click();
  const draft = JSON.parse((await page.getByTestId('local-template-draft').textContent())!);
  expect(draft.id).toMatch(/^template-review-/);
  expect(draft.templateLineageId).toBe('20000000-0000-4000-8000-000000000001');
  expect(draft.templatePipelineContext.expectedBase).toMatchObject({ assetId: 'synthetic-material', parentSubmissionId: '10000000-0000-4000-8000-000000000001', baseRevisionNumber: 1 });
  expect(draft.templateRegistryStatus).toBe('draft');
  expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([]);
});
