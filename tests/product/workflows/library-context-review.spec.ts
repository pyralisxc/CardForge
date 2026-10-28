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

for (const changed of [false, true]) test(`@golden Published Library checks registry publication epoch (changed=${changed})`, async ({ page }) => {
  const evidence = await mount(page, `?published=1${changed ? '&publicationChanged=1' : ''}`);
  await page.getByRole('button', { name: 'Review & manage', exact: true }).click();
  if (changed) {
    await expect(page.getByText(/selected catalog publication changed/)).toBeVisible();
    await expect(page.getByLabel('Exact revision governance')).toHaveCount(0);
  } else {
    await expect(page.getByLabel('Exact revision governance')).toBeVisible();
    await page.getByRole('button', { name: 'Revise existing', exact: true }).click();
    await expect(page.getByLabel('Revision appearance preview')).toBeVisible();
  }
  expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([]);
});

for (const stale of [false, true]) test(`@golden Focused media revision compares selected base before adoption (stale=${stale})`, async ({ page }) => {
  const evidence = await mount(page, `?media=1${stale ? '&mediaStale=1' : ''}`);
  await page.getByRole('button', { name: 'Review & manage', exact: true }).click();
  await page.getByRole('button', { name: 'Manage', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare presentation revision' }).click();
  const media = page.getByRole('region', { name: 'Media presentation revision' });
  if (stale) {
    await expect(media.getByRole('alert')).toContainText('no newer base was adopted');
    await expect(page.getByLabel('Candidate tile mode')).toHaveCount(0);
  } else await expect(page.getByLabel('Candidate tile mode')).toBeVisible();
  expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([]);
});

for (const outcome of ['success', 'uncertain', 'uncertainRetry', 'busy']) test(`@golden Style revision synthetic ${outcome} retains attempt until receipt and guards close`, async ({ page }) => {
  const evidence = await mount(page, `?submit=${outcome}`);
  await page.getByRole('button', { name: 'Review & manage', exact: true }).click();
  await page.getByRole('button', { name: 'Revise existing', exact: true }).click();
  await page.getByRole('button', { name: 'Color #ebd39f', exact: true }).click();
  await page.getByTitle('Hex color value').fill('#123456');
  await page.getByTitle('Hex color value').press('Tab'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Submit revision for review' }).click();
  if (outcome !== 'success') {
    if (outcome.startsWith('uncertain')) await expect(page.getByRole('alert')).toContainText('may have succeeded');
    else await expect(page.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    await page.getByRole('button', { name: 'Close Pipeline tool', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'pending or unconfirmed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Discard changes', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Leave Library', exact: true }).evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.getByRole('button', { name: 'Discard and continue', exact: true })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Revise selected published artifact' })).toBeVisible();
    if (outcome.startsWith('uncertain')) {
      await page.getByRole('button', { name: 'Check submission outcome' }).click();
      if (outcome === 'uncertainRetry') {
        await expect(page.getByRole('alert')).toContainText('does not prove');
        await page.getByRole('button', { name: 'Close Pipeline tool', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Discard changes', exact: true })).toHaveCount(0);
        await page.getByRole('button', { name: 'Confirm same submission attempt' }).click();
      }
    }
    else await page.evaluate(() => (window as typeof window & { releaseStylePost: () => void }).releaseStylePost());
  }
  await expect(page.getByRole('status').filter({ hasText: 'Revision 2 submitted' })).toBeVisible();
  const requests = await page.evaluate(() => (window as typeof window & { libraryRequests: { url: string; method: string; body?: string }[] }).libraryRequests);
  const posts = requests.filter(r => r.method === 'POST'); expect(posts).toHaveLength(outcome === 'uncertainRetry' ? 2 : 1);
  if (outcome === 'uncertainRetry') expect(posts[1].body).toBe(posts[0].body);
  const attempt = JSON.parse(posts[0].body!); expect(attempt.style.appearance.material.baseColor).toBe('#123456');
  if (outcome.startsWith('uncertain')) expect(requests.some(r => r.method === 'GET' && r.url.includes(`submissionKey=${attempt.submissionKey}`))).toBe(true);
  await page.getByRole('button', { name: 'Close Pipeline tool', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review & manage', exact: true })).toBeFocused();
  expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([]);
});

for (const width of [390, 1440]) test(`@golden Library reviews an exact unpublished upload at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  const evidence = await mount(page, '?upload=1');
  await page.getByRole('button', { name: 'Review & manage', exact: true }).click();
  const panel = page.getByLabel('Exact revision governance');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Synthetic fresh SVG upload');
  await expect(panel).toContainText('Not yet cataloged');
  await expect(panel).toContainText('Selected revision unassigned');
  await expect(panel).not.toContainText('Newer revision must not replace selection');
  await expect(panel.getByRole('button', { name: 'Revise existing', exact: true })).toBeDisabled();
  await expect(panel).toContainText('Revision editing starts from the current published base');
  await page.screenshot({ path: info.outputPath('unpublished-upload.png'), animations: 'disabled' });
  await info.attach('exact-unpublished-upload', { path: info.outputPath('unpublished-upload.png'), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Close Pipeline tool', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review & manage', exact: true })).toBeFocused();
  expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([]);
});

for (const width of [390, 1440]) test(`@golden Library revision discovery and exact page return at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 }); const evidence = await mount(page, '?queue=1');
  const collection = page.getByLabel('pipeline Library objects');
  await expect(collection.locator('article')).toHaveCount(14);
  await page.getByLabel('Pipeline discovery mode').selectOption('revisions');
  await expect(collection.locator('article')).toHaveCount(12);
  await expect(page.getByRole('status')).toContainText('15 revisions');
  const firstIds = await collection.locator('button[id^="library-object-"]').evaluateAll(nodes => nodes.map(node => node.id));
  await page.getByRole('button', { name: 'Next revisions' }).click();
  await expect(collection.locator('article')).toHaveCount(3);
  const secondIds = await collection.locator('button[id^="library-object-"]').evaluateAll(nodes => nodes.map(node => node.id));
  expect(new Set([...firstIds, ...secondIds]).size).toBe(15);
  const exact = page.locator('[id="library-object-pipeline:submission:10000000-0000-4000-8000-000000000015"]');
  await exact.click();
  await expect(page.getByLabel('Exact revision governance')).toContainText('Material 15');
  await page.getByRole('button', { name: 'Close revision review' }).click();
  await expect(exact).toBeFocused();
  await expect(page.getByRole('status')).toContainText('Page 2 of 2');
  for (const query of ['Shared material', 'emerald correction', 'Candidate Author', 'synthetic-material']) {
    await page.getByRole('textbox', { name: 'Search Library' }).fill(query);
    await expect(page.getByRole('status')).toContainText('Page 1');
    await expect(collection.locator('article')).toHaveCount(query === 'Shared material' ? 2 : query === 'synthetic-material' ? 12 : 1);
  }
  await page.getByRole('textbox', { name: 'Search Library' }).fill('Shared material');
  await page.getByLabel('Revision type').selectOption('elementPresets');
  await page.getByLabel('Revision status').selectOption('publish_candidate');
  await expect(collection.locator('article')).toHaveCount(1);
  await expect(collection).toContainText('Revision 3');
  await expect(collection).toContainText('Candidate Author');
  const preview = collection.locator('[aria-label="Shared material style preview"]');
  await expect(preview).toBeVisible();
  const bounds = await preview.boundingBox(); expect(bounds!.width).toBeGreaterThan(20); expect(bounds!.height).toBeGreaterThan(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await info.attach('revision-queue-candidate', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.getByLabel('Revision type').selectOption('icons');
  await expect(collection).toHaveCount(0);
  await page.getByLabel('Revision type').selectOption('elementPresets');
  await expect(collection.locator('article')).toHaveCount(1);
  await page.getByLabel('Revision status').selectOption('published');
  await expect(collection).toContainText('Revision 2');
  expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([]);
});
for (const role of ['contributor', 'signedOut']) test(`@golden Library revision inventory remains Owner-only for ${role}`, async ({ page }) => {
  const evidence = await mount(page, `?queue=1&${role}=1`);
  await expect(page.getByLabel('Pipeline discovery mode')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { libraryRequests: unknown[] }).libraryRequests)).toEqual([]);
  expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([]);
});
