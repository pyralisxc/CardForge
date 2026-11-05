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
  await page.getByText('Dependency coverage diagnostics (1)').click();
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

// Native component proof; PostgreSQL independently owns real impact/CAS evidence.
test('@golden @preview catalog impact requires explicit consent and reconciles stale evidence', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  let fingerprint = 'a'.repeat(64);
  let moved = false;
  const commands: Array<{ confirmation?: string; expected: { impactFingerprint?: string } }> = [];
  const snapshot = () => ({ name: 'Impact source', state: { ...active, impactFingerprint: fingerprint,
    trashedAt: moved ? '2026-11-01T00:00:00Z' : null, purgeAfter: moved ? '2026-12-01T00:00:00Z' : null },
    retentionDays: 30, reasons: [], entryReasons: ['json_consumer_inventory_unverified'], recoveryReasons: [],
    impact: { fingerprint, confirmationRequired: true, affectedCount: 2, privateAffectedCount: 1, coverageWarningCount: 3,
      items: [{ origin: 'registry', recordId: 'affected-template', objectId: identity.lineageId, submissionId: identity.submissionId, name: 'Affected Template' }] } });
  await page.route('**/api/**', async route => {
    if (!route.request().url().includes('/catalog-trash')) return route.abort();
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); commands.push(body);
      if (commands.length === 1) { fingerprint = 'b'.repeat(64); return route.fulfill({ status: 409, json: { message: 'Impact changed. Read state before retrying.' } }); }
      expect(body.confirmation).toBe(fingerprint); expect(body.expected.impactFingerprint).toBe(fingerprint); moved = true;
    }
    return route.fulfill({ json: snapshot() });
  });
  await page.goto('/');
  const styles = await page.locator('style, link[rel="stylesheet"]').evaluateAll(nodes => nodes.map(node => node.outerHTML).join('\n'));
  await page.route('**/__impact-proof', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head>${styles}</head><body></body></html>` }));
  await page.goto('/__impact-proof');
  await page.addScriptTag({ content: fixture.outputFiles.find(file => file.path.endsWith('.js'))!.text });
  await page.getByRole('button', { name: 'Refresh recovery state' }).click();
  await expect(page.getByRole('region', { name: 'Trash impact preview' })).toContainText('Affected Template');
  await expect(page.getByText('1 private affected record:', { exact: false })).toBeVisible();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Move to Trash', exact: true }).click();
  expect(commands).toHaveLength(0);
  page.once('dialog', dialog => { expect(dialog.message()).toContain('2 known record(s)'); void dialog.accept(); });
  await page.getByRole('button', { name: 'Move to Trash', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(commands).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Move to Trash', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Refresh recovery state' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Move to Trash', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('In Trash');
  expect(commands).toHaveLength(2);
});
