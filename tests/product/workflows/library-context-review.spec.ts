import { buildSync } from 'esbuild';
import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../../../tailwind.config';
const bundle = buildSync({ entryPoints: ['tests/product/fixtures/libraryContextReview.tsx'], bundle: true, minify: true, keepNames: true, platform: 'browser', format: 'iife', write: false,
  outfile: join(tmpdir(), 'library-context-review.js'), define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_RUNTIME': '"browser"', 'process.env': '{}' } });
const appCss = postcss([tailwindcss(tailwindConfig)]).process((readFileSync('src/app/cardforgePresentation.css', 'utf8') + readFileSync('src/app/globals.css', 'utf8')).replace(/@import ['"]([^'"]+)['"];?/g, (_, path: string) => readFileSync(join('src/app', path), 'utf8')), { from: 'src/app/globals.css' });
async function mount(page: import('@playwright/test').Page, query = '') {
  const mutations: string[] = []; const errors: string[] = [];
  page.on('pageerror', error => { errors.push(error.message); console.error('LIBRARY_FIXTURE_ERROR', error.message); });
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
    await expect(page.getByRole('region', { name: 'Isolated Library composition' }).getByText(/no other revision was substituted/)).toBeVisible();
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
    await expect(page.getByRole('region', { name: 'Isolated Library composition' }).getByText(/selected catalog publication changed/)).toBeVisible();
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
  await expect(page.getByRole('status')).toContainText('15 matching revisions');
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

for (const condition of ['catalogMissing', 'catalogLoading', 'catalogFailure']) test(`@golden Library revision selection waits for publication identity: ${condition}`, async ({ page }) => {
  const evidence = await mount(page, `?queueActual=1&scope=pipeline&${condition}=1`);
  await page.getByLabel('Pipeline discovery mode').selectOption('revisions');
  await expect(page.getByLabel('pipeline Library objects')).toHaveCount(0);
  if (condition === 'catalogFailure') await expect(page.getByText(/Catalog unavailable/)).toBeVisible();
  else await expect(page.getByLabel('Pipeline discovery').getByRole('status')).toContainText('Loading revisions');
  expect(await page.evaluate(() => (window as unknown as { libraryRequests: unknown[] }).libraryRequests)).toEqual([]);
  expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([]);
});


test('@golden actual Library keeps revision context through dirty close and clears changed-page detail', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const evidence = await mount(page, '?queueActual=1&scope=pipeline');
  await page.getByLabel('Pipeline discovery mode').selectOption('revisions');
  await page.locator('#library-global-search').fill('material');
  const collection = page.getByLabel('pipeline Library objects');
  await expect(collection.locator('article')).toHaveCount(12);
  await page.getByRole('button', { name: 'Next revisions' }).click();
  await expect(collection.locator('article')).toHaveCount(3);
  const selected = page.locator('[id="library-object-pipeline:submission:10000000-0000-4000-8000-000000000015"]');
  await selected.click();
  await expect(page.getByLabel('Details for Material 15', { exact: true })).toBeVisible();
  await page.getByLabel('Revision status').selectOption('publish_candidate');
  await expect(page.getByLabel('Details for Material 15', { exact: true })).toHaveCount(0);
  await expect(collection.locator('article')).toHaveCount(1);
  await page.getByLabel('Revision status').selectOption('all');
  await page.getByRole('button', { name: 'Next revisions' }).click();
  await selected.click();
  const surface = page.locator('[aria-label="CardForge Library"] main[data-scene-viewport]');
  const beforeScroll = await surface.evaluate(node => { node.scrollTop = Math.min(50, node.scrollHeight - node.clientHeight); return node.scrollTop; });
  const review = page.getByRole('button', { name: 'Review & manage', exact: true }).first();
  const reviewTrigger = await review.elementHandle();
  expect(reviewTrigger).not.toBeNull();
  await review.click();
  await expect(page.getByLabel('Exact revision governance')).toContainText('Material 15');
  await page.getByRole('button', { name: 'Manage', exact: true }).click();
  // React synchronizes textarea.defaultValue with its controlled value. The
  // wrapping label's textContent then includes the note, so an exact getByLabel
  // stops matching even while the same editor and value remain mounted.
  const decisionNote = page.getByLabel('Exact revision governance').locator('label')
    .filter({ hasText: /^\s*Decision note/ }).locator('textarea');
  await expect(decisionNote).toHaveCount(1);
  await decisionNote.fill('Local unsaved review note');
  await expect(decisionNote).toHaveValue('Local unsaved review note');
  for (const name of ['Pipeline discovery mode', 'Revision status', 'Revision type']) await expect(page.getByLabel(name, { exact: true })).toBeDisabled();
  await expect(page.locator('#library-global-search')).toBeDisabled();
  await expect(page.locator('#library-global-search')).toBeDisabled();
  await page.getByRole('button', { name: 'Close Pipeline tool', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Discard unsaved changes?');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(decisionNote).toHaveValue('Local unsaved review note');
  await page.getByRole('button', { name: 'Close Pipeline tool', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.getByLabel('Exact revision governance')).toHaveCount(0);
  await expect(page.getByLabel('Pipeline discovery').getByRole('status')).toContainText('Page 2 of 2');
  await expect(page.getByLabel('Revision status', { exact: true })).toHaveValue('all');
  await expect(page.locator('#library-global-search')).toHaveValue('material');
  // The command-band trigger survives the tool transition. Restore that exact
  // trigger, falling back to the selected row only if the opener was removed.
  const selectedId = await selected.getAttribute('id');
  await expect.poll(() => reviewTrigger!.evaluate((trigger, fallbackId) => {
    const expected = trigger.isConnected ? trigger : document.getElementById(fallbackId!);
    return expected !== null && document.activeElement === expected;
  }, selectedId)).toBe(true);
  const focusEvidence = await reviewTrigger!.evaluate(trigger => ({
    openerConnected: trigger.isConnected,
    activeId: document.activeElement?.id,
    activeAction: document.activeElement?.getAttribute('data-environment-action'),
    activeText: document.activeElement?.textContent,
    restoredOriginalTrigger: document.activeElement === trigger,
  }));
  console.log('LIBRARY_RETURN_FOCUS', JSON.stringify(focusEvidence));
  await info.attach('actual-library-return-focus', { body: JSON.stringify(focusEvidence), contentType: 'application/json' });
  await expect.poll(() => surface.evaluate(node => node.scrollTop)).toBe(beforeScroll);
  await expect(page.getByLabel('Details for Material 15', { exact: true })).toBeVisible();
  await info.attach('actual-library-return-context', { body: await page.screenshot(), contentType: 'image/png' });
  expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([]);
});


for (const missing of [false, true]) test(`@golden historical Template keeps source and publication labels (missing=${missing})`, async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const evidence = await mount(page, `?queueActual=1&scope=pipeline&historyTemplate=1${missing ? '&missingHistory=1' : ''}`);
  await page.getByLabel('Pipeline discovery mode').selectOption('revisions');
  await page.getByRole('button', { name: 'Next revisions' }).click();
  await page.locator('[id="library-object-pipeline:submission:10000000-0000-4000-8000-000000000015"]').click();
  const history = page.getByLabel('Pipeline review details');
  await expect(history.getByText('History', { exact: true })).toBeVisible();
  await expect(history.getByText('Live', { exact: true })).toHaveCount(0);
  await history.getByRole('button', { name: 'Review & manage Revision 1', exact: true }).click();
  const review = page.getByLabel('Exact revision governance');
  await expect(review).toContainText('10000000-0000-4000-8000-000000000015');
  await expect(review.getByText('Current live catalog payload', { exact: false })).toHaveCount(0);
  await expect(review.getByText('This submission has been published. Its status does not identify the current catalog revision.')).toBeVisible();
  await expect(review.getByText('Published through automatic ranking. Current catalog availability depends on the active publication.')).toBeVisible();
  await expect(review.getByText(/Live in the shared library|Currently available through/)).toHaveCount(0);
  if (missing) {
    await expect(review.getByText('Exact selected Template source is unavailable; no current revision was substituted.').first()).toBeVisible();
    await expect(review.getByRole('button', { name: 'Download exact submission PNG' })).toHaveCount(0);
  } else {
    await expect(review.getByText('Selected historical revision 1', { exact: true })).toBeVisible();
    await expect(review.getByText('Exact submitted payload', { exact: false })).toContainText('10000000-0000-4000-8000-000000000015');
    await expect(review.getByRole('button', { name: 'Download exact submission PNG' })).toBeVisible();
    const colorCount = await review.evaluate(node => Array.from(node.querySelectorAll('*')).filter(e => getComputedStyle(e).backgroundColor === 'rgb(0, 255, 0)').length);
    expect(colorCount).toBeGreaterThan(0);
    expect(await review.evaluate(node => Array.from(node.querySelectorAll('*')).some(e => getComputedStyle(e).backgroundColor === 'rgb(0, 0, 255)'))).toBe(false);
  }
  await info.attach('historical-template-source', { body: await page.screenshot(), contentType: 'image/png' });
  expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([]);
});

for (const width of [390,1440]) test(`@golden Desk exact governance preserves dirty draft and return at ${width}px`, async ({page},info)=>{
 test.setTimeout(90_000); await page.setViewportSize({width,height:900}); const evidence=await mount(page,'?deskActual=1&deskMenu=1&published=1');
 if(width<900) await page.getByLabel('Open Desk filters',{exact:true}).click();
 await page.getByRole('button',{name:'Choose Desk views',exact:true}).click();
 await page.getByRole('menuitemcheckbox',{name:'My published',exact:true}).click();
 await page.keyboard.press('Escape');
 if(width<900) await page.getByLabel('Open Desk filters',{exact:true}).click();
 const launcher=page.getByRole('button',{name:'Actions for Synthetic material revision one',exact:true});
 await launcher.click();
 await page.getByRole('menuitem',{name:'Review & manage',exact:true}).click();
 await expect(page.getByLabel('Exact revision governance')).toBeVisible();
 await page.getByRole('button',{name:'Manage',exact:true}).click();
 const note=page.getByLabel('Exact revision governance').locator('label').filter({hasText:/^\s*Decision note/}).locator('textarea');
 await note.fill('Unsaved Desk note');
 await page.evaluate(()=>history.back());
 await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(page.getByRole('alertdialog')).toHaveCount(0);
 await expect(note).toHaveValue('Unsaved Desk note');
 await page.getByRole('button',{name:'Return to Desk',exact:true}).click();
 await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(page.getByRole('alertdialog')).toHaveCount(0);
 await expect(note).toHaveValue('Unsaved Desk note');
 await page.screenshot({path:info.outputPath('desk-exact-governance.png')});
 await page.getByRole('button',{name:'Return to Desk',exact:true}).click();
 await page.getByRole('button',{name:'Discard',exact:true}).click();
 await expect(launcher).toBeFocused();
 expect(evidence.mutations).toEqual([]);expect(evidence.errors).toEqual([]);
});

test('@golden Desk uncertain revision survives Back and recovers its exact attempt', async ({page}) => {
 const evidence=await mount(page,'?deskActual=1&published=1&submit=uncertain');
 await page.getByRole('button',{name:'Actions for Synthetic material revision one',exact:true}).click();
 await page.getByRole('menuitem',{name:'Review & manage',exact:true}).click();
 await page.getByRole('button',{name:'Revise existing',exact:true}).click();
 await page.getByRole('button',{name:'Color #ebd39f',exact:true}).click();
 await page.getByTitle('Hex color value').fill('#123456');
 await page.getByTitle('Hex color value').press('Tab'); await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Submit revision for review'}).click();
 await expect(page.getByRole('alert')).toContainText('may have succeeded');
 await page.evaluate(()=>history.back());
 await expect(page.getByRole('alertdialog')).toContainText('Resolve this attempt before closing');
 await expect(page.getByRole('button',{name:'Discard',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(page.getByRole('alertdialog')).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Revise selected published artifact'})).toBeVisible();
 await page.getByRole('button',{name:'Check submission outcome'}).click();
 await expect(page.getByRole('status').filter({hasText:'Revision 2 submitted'})).toBeVisible();
 const requests=await page.evaluate(()=>(window as typeof window & {libraryRequests:{url:string;method:string;body?:string}[]}).libraryRequests);
 const posts=requests.filter(request=>request.method==='POST'); expect(posts).toHaveLength(1);
 expect(requests.some(request=>request.method==='GET' && request.url.includes(`submissionKey=${JSON.parse(posts[0].body!).submissionKey}`))).toBe(true);
 expect(evidence.mutations).toEqual([]);expect(evidence.errors).toEqual([]);
});


test('@golden Desk remote ellipsis exposes exact location actions without deleting a copy',async({page})=>{
 const evidence=await mount(page,'?deskActual=1&deskMenu=1&deskDrive=1');
 const menu=page.getByRole('button',{name:'Actions for Synthetic Drive Set.cardforge',exact:true});
 await menu.click();
 await expect(page.getByRole('menuitem',{name:'View source',exact:true})).toBeVisible();
 await expect(page.getByRole('menuitem',{name:'Move Drive copy to Trash',exact:true})).toBeVisible();
 await page.getByRole('menuitem',{name:'Manage locations',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Synthetic Drive Set');
 await expect(page.getByText('Action could not be completed',{exact:true})).toHaveCount(0);
 expect(evidence.mutations).toEqual([]);expect(evidence.errors).toEqual([]);
});

for(const width of [390,1440]) test(`@golden global Pipeline reuses Library queue and preserves contextual governance at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:900});const evidence=await mount(page,'?queueActual=1&scope=pipeline&globalSettingsSave=1');
 await page.getByRole('button',{name:'Pipeline operations',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Asset library',exact:true})).toHaveCount(0);
 await expect(page.getByRole('tab',{name:'Studio map',exact:true})).toBeVisible();
 await expect(page.getByRole('tab',{name:'Pipeline rules',exact:true})).toHaveAttribute('data-state','active');
 const queue=page.getByRole('button',{name:'Open Library revision queue',exact:true});await expect(queue).toBeEnabled();
 const maximum=page.locator('label').filter({hasText:/Max Contributors/}).locator('input');const before=Number(await maximum.inputValue());await maximum.fill(String(before+1));
 await expect(queue).toBeDisabled();await page.getByRole('button',{name:'Close Pipeline tool',exact:true}).click();
 await expect(page.getByRole('alertdialog')).toBeVisible();await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(maximum).toHaveValue(String(before+1));
 await page.getByRole('button',{name:'Save Contributor program',exact:true}).click();await expect(page.getByText('Contributor program saved',{exact:true})).toBeVisible();await expect(queue).toBeEnabled();
 await queue.click();await expect(page.getByLabel('Pipeline discovery mode')).toHaveValue('revisions');await expect(page.getByLabel('Pipeline discovery mode')).toBeFocused();
 await expect(page.getByLabel('Pipeline discovery').getByRole('status')).toContainText('15 matching revisions');
 await page.getByRole('button',{name:'Next revisions'}).click();await expect(page.getByLabel('pipeline Library objects').locator('article')).toHaveCount(3);
 const row=page.locator('[id="library-object-pipeline:submission:10000000-0000-4000-8000-000000000015"]');await row.click();
 await page.getByRole('button',{name:'Review & manage',exact:true}).first().click();await expect(page.getByLabel('Exact revision governance')).toContainText('Material 15');
 await page.getByRole('button',{name:'Manage',exact:true}).click();await expect(page.getByRole('button',{name:'Save control',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Refresh recovery state',exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('contextual-governance.png')});await info.attach('contextual-governance',{path:info.outputPath('contextual-governance.png'),contentType:'image/png'});
 await page.getByRole('button',{name:'Close Pipeline tool',exact:true}).click();
 if(width<900){const details=page.getByRole('dialog',{name:'Material 15',exact:true});await expect(details).toBeVisible();await details.getByRole('button',{name:'Close',exact:true}).click();await expect(row).toBeFocused();}
 await expect(page.getByLabel('Pipeline discovery').getByRole('status')).toContainText('Page 2 of 2');
 const writes=await page.evaluate(()=>(window as typeof window&{libraryRequests:{url:string,method:string}[]}).libraryRequests.filter(r=>r.method!=='GET'));expect(writes).toEqual([expect.objectContaining({url:'/api/pipeline',method:'PUT'})]);expect(evidence.mutations).toEqual([]);expect(evidence.errors).toEqual([]);
});

for(const width of [390,1440]) test(`@golden Desk search reconciles published lineage revisions without residual objects at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const evidence=await mount(page,'?deskActual=1&deskMenu=1&deskSearch=1');
 if(width<900)await page.getByLabel('Open Desk filters',{exact:true}).click();
 await page.getByRole('button',{name:'Choose Desk views',exact:true}).click();await page.getByRole('menuitemcheckbox',{name:'My published',exact:true}).click();await page.keyboard.press('Escape');
 const first=page.locator('[data-desk-set-object-id="pipeline:20000000-0000-4000-8000-000000000001"]');const bridge=page.locator('[data-desk-set-object-id="pipeline:20000000-0000-4000-8000-000000000002"]');await expect(first).toBeVisible();
 await expect(bridge).toHaveCount(1);await expect(bridge).toContainText('Revision 2');
 const original=await bridge.getAttribute('style');
 for(let repeat=0;repeat<3;repeat++){
  await page.getByPlaceholder('Search Desk work').fill('Synthetic material revision one');await expect(page.getByText('1 visible work',{exact:true})).toBeVisible();await expect(first).toBeVisible();await expect(bridge).toHaveCount(0);await expect(page.locator('[data-desk-set-object-id]')).toHaveCount(1);
  await page.getByPlaceholder('Search Desk work').fill('');await expect(bridge).toHaveCount(1);await expect(page.locator('[data-desk-set-object-id]')).toHaveCount(2);expect(await bridge.getAttribute('style')).toBe(original);
 }
 if(width<900)await page.getByLabel('Open Desk filters',{exact:true}).click();
 await bridge.getByRole('button',{name:'Actions for Unrelated Bridge Back',exact:true}).click();await page.getByRole('menuitem',{name:'Review & manage',exact:true}).click();
 await expect(page.getByLabel('Exact revision governance')).toContainText('Selected revision 2');
 await expect(page.getByLabel('Exact revision governance')).toContainText('10000000-0000-4000-8000-000000000004');
 expect(evidence.errors).toEqual([]);expect(evidence.mutations).toEqual([]);
});

for (const width of [390, 1440]) test(`@golden Campaigns search and content reachability at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 757 });
  const evidence = await mount(page, '?campaignActual=1');
  await page.getByRole('navigation', { name: 'Library scopes' }).getByRole('button', { name: /Campaigns/ }).click();
  const campaigns = page.getByRole('tab', { name: 'Campaigns', exact: true });
  const collection = page.locator('[data-library-surface] > section').last();
  await expect(collection).toBeVisible();
  await collection.hover();
  await page.mouse.wheel(0, 700);
  await expect.poll(() => collection.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await campaigns.scrollIntoViewIfNeeded();
  await campaigns.click();
  const card = page.getByRole('button', { name: /Founder Beta Introduction/ });
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeInViewport();
  await card.click();
  await page.getByLabel('Campaign name', { exact: true }).fill('Unsaved local campaign edit');
  const save = page.getByRole('button', { name: 'Save campaign', exact: true });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const search = page.getByRole('searchbox', { name: 'Search campaigns', exact: true });
  await search.fill('zz-no-matching-campaign');
  await expect(card).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'No campaigns match' })).toBeVisible();
  await expect(page.getByLabel('Campaign name', { exact: true })).toHaveValue('Unsaved local campaign edit');
  await page.getByRole('button', { name: 'Clear search campaigns', exact: true }).click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await expect(card).toHaveCount(1);
  await expect(page.getByLabel('Campaign name', { exact: true })).toHaveValue('Unsaved local campaign edit');
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('campaigns.png') });
  await info.attach('actual-components-local-campaigns', { path: info.outputPath('campaigns.png'), contentType: 'image/png' });
  expect(evidence.errors).toEqual([]); expect(evidence.mutations).toEqual([]);
});

for (const width of [320, 390, 1440]) test(`@golden Desk second rail keeps controls reachable and state intact at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 844 });
  const evidence = await mount(page, '?deskActual=1&deskMenu=1&deskSearch=1');
  const toolbar = page.locator('[data-desk="overview"] [data-desk-toolbar]');
  const select = toolbar.getByRole('button', { name: 'Select multiple', exact: true });
  const search = page.getByPlaceholder('Search Desk work');
  await search.fill('material');
  if (width < 768) {
    const filters = toolbar.getByLabel('Open Desk filters', { exact: true });
    const view = toolbar.getByRole('button', { name: 'Desk view controls', exact: true });
    const boxes = await Promise.all([filters, select, view].map(async control => {
      await expect(control).toBeInViewport({ ratio: 1 });
      return (await control.boundingBox())!;
    }));
    const centers = boxes.map(box => box.y + box.height / 2);
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
    for (const box of boxes) { expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44); }
    expect((await toolbar.boundingBox())!.height).toBeLessThanOrEqual(60);
    await filters.click();
    const panel = page.locator('[data-mobile-desk-filters] [aria-label="Desk views and filters"]');
    await expect(panel).toBeInViewport({ ratio: 1 });
    await panel.getByRole('button', { name: 'Choose Desk views', exact: true }).click();
    await page.getByRole('menuitemcheckbox', { name: 'My published', exact: true }).click();
    await page.keyboard.press('Escape');
    await filters.click();
    await select.click();
    await expect(toolbar.getByRole('button', { name: 'Done selecting', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await view.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Fit visible work' })).toBeInViewport({ ratio: 1 });
    await page.keyboard.press('Escape'); await expect(view).toBeFocused();
    await filters.click();
    await panel.getByRole('button', { name: 'Choose Desk views', exact: true }).click();
    await expect(page.getByRole('menuitemcheckbox', { name: 'My published', exact: true })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape'); await filters.click();
    await expect(toolbar.getByRole('button', { name: 'Done selecting', exact: true })).toHaveAttribute('aria-pressed', 'true');
  } else {
    await expect(toolbar.getByRole('button', { name: 'Choose Desk views', exact: true })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Whole Desk', exact: true })).toBeVisible();
    await select.click();
    await expect(toolbar.getByRole('button', { name: 'Done selecting', exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(search).toHaveValue('material');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('desk-second-rail.png') });
  await info.attach('native-desk-second-rail', { path: info.outputPath('desk-second-rail.png'), contentType: 'image/png' });
  expect(evidence.errors).toEqual([]); expect(evidence.mutations).toEqual([]);
});

for (const width of [320, 390, 1440]) test(`@golden Library second rail keeps full scope labels on one row at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 844 });
  const evidence = await mount(page, '?campaignActual=1');
  const scopes = page.getByRole('navigation', { name: 'Library scopes', exact: true });
  const boxes = [];
  for (const label of ['Personal', 'Pipeline', 'Published', 'Campaigns']) {
    const button = scopes.getByRole('button', { name: new RegExp(`^${label}`) });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport({ ratio: 1 });
    const bounds = (await button.boundingBox())!;
    expect(bounds.height).toBeGreaterThanOrEqual(width < 768 ? 44 : 40);
    expect(await button.locator('span').evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await button.click(); await expect(button).toHaveAttribute('aria-current', 'page');
    boxes.push(bounds);
  }
  const centers = boxes.map(box => box.y + box.height / 2);
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
  expect((await scopes.boundingBox())!.height).toBeLessThanOrEqual(48);
  const campaigns = scopes.getByRole('button', { name: /^Campaigns/ });
  await page.getByRole('searchbox', { name: 'Search campaigns' }).fill('founder');
  await scopes.getByRole('button', { name: /^Personal/ }).focus();
  await page.keyboard.press('Enter');
  await expect(scopes.getByRole('button', { name: /^Personal/ })).toHaveAttribute('aria-current', 'page');
  await campaigns.focus(); await page.keyboard.press('Enter');
  await expect(campaigns).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('searchbox', { name: 'Search campaigns' })).toHaveValue('founder');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('library-second-rail.png') });
  await info.attach('native-library-second-rail', { path: info.outputPath('library-second-rail.png'), contentType: 'image/png' });
  if (width === 320) {
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    expect(await scopes.evaluate(node => node.scrollWidth)).toBeGreaterThan(await scopes.evaluate(node => node.clientWidth));
    for (const label of ['Personal', 'Campaigns']) {
      const button = scopes.getByRole('button', { name: new RegExp(`^${label}`) });
      await button.focus(); await page.keyboard.press('Enter');
      await expect(button).toBeInViewport({ ratio: 1 });
      await expect(button).toHaveAttribute('aria-current', 'page');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
  expect(evidence.errors).toEqual([]); expect(evidence.mutations).toEqual([]);
});

for (const width of [320, 390, 800, 1440]) test(`@golden Single shared rails and keyboard search across spaces at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 757 });
  const evidence = await mount(page, '?rail=desk');
  for (const space of ['desk', 'library', 'profile']) {
  if (space !== 'desk') await page.getByRole('link', { name: space === 'library' ? 'Library' : 'Profile', exact: true }).click();
  const rail = page.locator('header[data-has-search="true"]');
  const home = rail.getByRole('link', { name: 'Open the CardForge public site' });
  const search = rail.getByRole('searchbox', { name: `Search ${space}` });
  const account = rail.getByRole('button', { name: 'Profile', exact: true });
  for (const control of [home, search, account]) await expect(control).toBeInViewport();
  const controls = [home, search, account];
  if (space !== 'profile') controls.push(rail.getByRole('button', { name: 'New Set', exact: true }));
  else await expect(rail.getByRole('button', { name: 'New Set' })).toHaveCount(0);
  const boxes = await Promise.all(controls.map(control => control.boundingBox()));
  const centers = boxes.map(box => box!.y + box!.height / 2);
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
  expect(await rail.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.keyboard.press('Control+k'); await expect(search).toBeFocused();
  await page.keyboard.type('test query');
  await rail.getByRole('button', { name: `Clear search ${space}` }).click();
  await expect(search).toHaveValue(''); await expect(search).toBeFocused();
  await expect(page.getByRole('button', { name: 'Open commands' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Actions for this context' })).toHaveCount(0);
  if (width === 320 || width === 1440) await info.attach(`native-${space}-rail-synthetic-account`, { body: await page.screenshot(), contentType: 'image/png' });
  }
  expect(evidence.errors).toEqual([]); expect(evidence.mutations).toEqual([]);
});
for (const width of [390, 1440]) test(`@golden Library uses the existing New Set flow without duplicate search or permanent Refresh at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 757 });
  const evidence = await mount(page, '?campaignActual=1');
  await expect(page.getByRole('searchbox', { name: 'Search personal' })).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: 'Search Library', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Refresh/ })).toHaveCount(0);
  const create = page.getByRole('button', { name: 'New Set', exact: true });
  await create.click();
  await expect(page.getByRole('dialog', { name: 'Start a new Set' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fresh Set', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fresh Set + Design', exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(create).toBeFocused();
  await page.getByRole('navigation', { name: 'Library scopes' }).getByRole('button', { name: /Campaigns/ }).click();
  await expect(page.getByRole('button', { name: /Refresh/ })).toHaveCount(0);
  expect(evidence.errors).toEqual([]); expect(evidence.mutations).toEqual([]);
});
test('@golden Contributor Campaigns shares the native Library search and clear without writes', async ({ page }) => {
  const evidence = await mount(page, '?campaignActual=1&campaignContributor=1');
  await page.getByRole('navigation', { name: 'Library scopes' }).getByRole('button', { name: /Campaigns/ }).click();
  const search = page.getByRole('searchbox', { name: 'Search campaigns' });
  await expect(page.getByRole('heading', { name: 'Printable Deck Introduction', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search campaign packages' })).toHaveCount(0);
  await search.fill('zz-no-matching-package');
  await expect(page.getByRole('heading', { name: 'Printable Deck Introduction', exact: true })).toHaveCount(0);
  await expect(page.getByText('No packages match this queue view.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search campaigns' }).click();
  await expect(page.getByRole('heading', { name: 'Printable Deck Introduction', exact: true })).toBeVisible();
  expect(evidence.errors).toEqual([]); expect(evidence.mutations).toEqual([]);
});

for (const design of [false, true]) test(`@golden Library native fresh Set creation retains return scope (design=${design})`, async ({ page }) => {
  const evidence = await mount(page, '?campaignActual=1');
  await page.getByRole('navigation', { name: 'Library scopes' }).getByRole('button', { name: /Campaigns/ }).click();
  await page.getByRole('searchbox', { name: 'Search campaigns' }).fill('founder');
  await page.getByRole('button', { name: 'New Set', exact: true }).click();
  await page.getByRole('button', { name: design ? 'Fresh Set + Design' : 'Fresh Set', exact: true }).click();
  const destinations = await page.evaluate(() => (window as typeof window & { libraryNavigations: string[] }).libraryNavigations);
  expect(destinations).toHaveLength(1);
  const target = new URL(destinations[0], 'https://cardforge.local');
  expect(target.pathname).toBe('/account');
  expect(target.searchParams.get('focus')).toMatch(/^set:.+/);
  expect(target.searchParams.get('tool')).toBe(design ? 'design' : null);
  const returnTo = new URL(target.searchParams.get('returnTo')!, 'https://cardforge.local');
  expect(returnTo.searchParams.get('section')).toBe('library');
  expect(returnTo.searchParams.get('scope')).toBe('campaigns');
  expect(returnTo.searchParams.get('returnContext')).toBeTruthy();
  expect(evidence.errors).toEqual([]); expect(evidence.mutations).toEqual([]);
});

for (const state of ['connecting', 'signed-out']) test(`@golden Real ${state} auth presentation leaves 320px rail search reachable`, async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 757 });
  const evidence = await mount(page, `?rail=library&railAuth=${state}`);
  const rail = page.locator('header[data-has-search="true"]');
  const search = rail.getByRole('searchbox', { name: 'Search library' });
  const auth = state === 'connecting' ? rail.getByRole('button', { name: 'Connecting to account sign in' }) : rail.getByRole('link', { name: 'Sign in' });
  await expect(auth).toBeInViewport();
  const box = (await auth.boundingBox())!; expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
  await search.fill('query'); await expect(search).toHaveValue('query');
  const clear = rail.getByRole('button', { name: 'Clear search library' });
  await clear.click(); await expect(search).toBeFocused();
  const searchBox = (await search.boundingBox())!; expect(searchBox.width).toBeGreaterThanOrEqual(70);
  expect(searchBox.x + searchBox.width).toBeLessThanOrEqual((await rail.getByRole('button', { name: 'New Set' }).boundingBox())!.x);
  expect(await rail.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  await info.attach('native-auth-state-compact-rail', { body: await page.screenshot(), contentType: 'image/png' });
  expect(evidence.errors).toEqual([]); expect(evidence.mutations).toEqual([]);
});

test('@golden Unsaved Campaign edits block New Set until explicit cancellation', async ({ page }) => {
  const evidence = await mount(page, '?campaignActual=1');
  await page.getByRole('navigation', { name: 'Library scopes' }).getByRole('button', { name: /Campaigns/ }).click();
  await page.getByRole('tab', { name: 'Campaigns', exact: true }).click();
  await page.getByRole('button', { name: /Founder Beta Introduction/ }).click();
  await page.getByLabel('Campaign name', { exact: true }).fill('Retain this campaign draft');
  const create = page.getByRole('button', { name: 'New Set', exact: true });
  await expect(create).toBeDisabled(); await expect(create).toHaveAttribute('title', 'Save or cancel campaign edits before starting a Set.');
  await expect(page.getByRole('status').filter({ hasText: 'Save or cancel campaign edits' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Start a new Set' })).toHaveCount(0);
  await expect(page.getByLabel('Campaign name', { exact: true })).toHaveValue('Retain this campaign draft');
  expect(await page.evaluate(() => (window as typeof window & { libraryNavigations: string[] }).libraryNavigations)).toEqual([]);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(create).toBeEnabled(); await create.click();
  await page.getByRole('button', { name: 'Fresh Set', exact: true }).click();
  expect(await page.evaluate(() => (window as typeof window & { libraryNavigations: string[] }).libraryNavigations)).toHaveLength(1);
  expect(evidence.errors).toEqual([]); expect(evidence.mutations).toEqual([]);
});

for (const width of [390, 1440]) test(`@golden Focused nonlocal deep-link retains exact actions after Done at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const evidence = await mount(page, '?deskActual=1&published=1');
  const rail = page.locator('[data-desk-context-rail][data-depth="work"]');
  const opener = rail.getByRole('button', { name: 'Actions for Synthetic material revision one', exact: true });
  await opener.click();
  await expect(page.getByRole('menuitem', { name: 'Review & manage', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Generate cards', exact: true })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Open published work', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Published work · Synthetic material revision one', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await opener.click(); await page.getByRole('menuitem', { name: 'Review & manage', exact: true }).click();
  await expect(page.getByLabel('Exact revision governance')).toContainText('Synthetic material revision one');
  await expect(page.getByLabel('Exact revision governance')).not.toContainText('Newer revision must not replace selection');
  await page.getByRole('button', { name: 'Return to Desk', exact: true }).click();
  await expect(opener).toBeFocused();
  expect(evidence.errors).toEqual([]); expect(evidence.mutations).toEqual([]);
});

test('@golden Unsaved strategy and destination drafts retain a local discard path before New Set', async ({ page }) => {
  const evidence = await mount(page, '?campaignActual=1');
  await page.getByRole('navigation', { name: 'Library scopes' }).getByRole('button', { name: /Campaigns/ }).click();
  const create = page.getByRole('button', { name: 'New Set', exact: true });
  await page.getByRole('textbox', { name: 'Current offer', exact: true }).fill('Unsaved strategy offer');
  await expect(create).toBeDisabled();
  await page.getByRole('button', { name: 'Discard strategy draft', exact: true }).click();
  await expect(create).toBeEnabled();
  await page.getByRole('tab', { name: 'Distribution', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Unsaved destination');
  await expect(create).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(create).toBeEnabled();
  expect(evidence.errors).toEqual([]); expect(evidence.mutations).toEqual([]);
});

for (const editing of [false, true]) test(`@golden Campaign package pristine and reverted draft preserves New Set (editing=${editing})`, async ({ page }) => {
  const evidence = await mount(page, '?campaignActual=1&campaignContributor=1&campaignComposer=1');
  await page.getByRole('navigation', { name: 'Library scopes' }).getByRole('button', { name: /Campaigns/ }).click();
  if (editing) await page.getByRole('button', { name: 'Edit', exact: true }).click();
  else await page.getByRole('button', { name: 'New campaign package', exact: true }).click();
  const create = page.getByRole('button', { name: 'New Set', exact: true });
  const title = page.getByRole('textbox', { name: /^Content title/ });
  const initial = await title.inputValue();
  await expect(create).toBeEnabled();
  await title.fill('Unsaved package title'); await expect(create).toBeDisabled();
  await expect(title).toHaveValue('Unsaved package title');
  await title.fill(initial); await expect(create).toBeEnabled();
  await page.getByRole('searchbox', { name: 'Search campaigns' }).fill('independent view change');
  await expect(create).toBeEnabled(); await expect(title).toHaveValue(initial);
  expect(evidence.errors).toEqual([]); expect(evidence.mutations).toEqual([]);
});
