import { buildSync } from 'esbuild';
import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const fixture = buildSync({ entryPoints: ['tests/product/fixtures/catalogTrashControls.tsx'], bundle: true,
  platform: 'browser', format: 'iife', write: false, outfile: join(tmpdir(), 'cardforge-catalog-trash-proof.js'),
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
});
const identity = { lineageId: '00000000-0000-4000-8000-000000000001', submissionId: '00000000-0000-4000-8000-000000000002', registrySubmissionId: '00000000-0000-4000-8000-000000000002', revisionHighWater: 3 };
const active = { identity, trashedAt: null as string | null, purgeAfter: null as string | null, held: false };
// Credential-free component proof. Requests below are intercepted fixture state,
// not Owner authentication, PostgreSQL execution, Storage or hosted acceptance.
for (const width of [320, 1180]) test(`@golden catalog recovery exposes guarded Move/Hold/Restore at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 850 });
  let state = { ...active };
  let blocked = true;
  const commands: unknown[] = [];
  await page.route('**/api/**', async route => {
    if (!route.request().url().includes('/catalog-trash')) return route.abort();
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); commands.push(body);
      expect(body.expected).toEqual(state);
      if (body.action === 'trash') state = { ...state, trashedAt: '2026-10-26T00:00:00Z', purgeAfter: '2026-11-25T00:00:00Z' };
      else if (body.action === 'hold') state = { ...state, held: body.held };
      else if (body.action === 'restore') state = { ...active };
      else throw new Error('Unexpected cleanup action');
    }
    return route.fulfill({ json: { name: 'Synthetic catalog icon', state, retentionDays: 30,
      entryReasons: blocked ? ['legacy_destructive_history_unverified','json_consumer_inventory_unverified'] : [],
      inventoryDetails: blocked ? [{origin:'registry',recordId:'standard-playing-card-deck',payloadKind:'set',conditions:['set_package_not_natively_decoded']}] : [],
      reasons: ['physical_expiry_unavailable_complete_reference_and_worker_proof_required'] } });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const styles = await page.locator('head').evaluate(head => [...head.querySelectorAll('style,link[rel="stylesheet"]')].map(node => node.outerHTML).join('\n'));
  await page.route('**/__catalog-trash-proof', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${styles}</head><body></body></html>` }));
  await page.goto('/__catalog-trash-proof');
  for (const file of fixture.outputFiles.filter(file => file.path.endsWith('.css'))) await page.addStyleTag({ content: file.text });
  await page.addScriptTag({ content: fixture.outputFiles.find(file => file.path.endsWith('.js'))!.text });
  await page.getByRole('button', { name: 'Refresh recovery state' }).click();
  await expect(page.getByRole('button', { name: 'Move to Trash' })).toBeDisabled();
  await expect(page.getByText('Earlier deletion attempts need reconciliation', { exact: false })).toBeVisible();
  await page.getByText('Consumer inventory blockers (1)').click();
  await expect(page.getByText('registry · set · standard-playing-card-deck')).toBeVisible();
  await expect(page.getByText('Set package has no supported complete native dependency inspection.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Move to Trash' })).toBeDisabled();
  const screenshot = await page.screenshot({ path: testInfo.outputPath('inventory-blockers.png'), fullPage: true });
  await testInfo.attach('inventory-blockers', {body:screenshot,contentType:'image/png'});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(commands).toHaveLength(0);
  blocked = false;
  await page.getByRole('button', { name: 'Refresh recovery state' }).click();
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Move to Trash' }).click();
  await expect(page.getByRole('status')).toContainText('In Trash');
  await page.getByRole('button', { name: 'Hold', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('On hold');
  await expect(page.getByText('Physical expiry is blocked', { exact: false })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('held-catalog.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Not in Trash');
  expect(commands).toHaveLength(3);
});
