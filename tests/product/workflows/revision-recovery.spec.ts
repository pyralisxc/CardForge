import { buildSync } from 'esbuild';
import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const fixture = buildSync({ entryPoints: ['tests/product/fixtures/revisionRecoveryControls.tsx'], bundle: true,
  platform: 'browser', format: 'iife', write: false, outfile: join(tmpdir(), 'cardforge-revision-recovery-proof.js'),
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
});
const ownerFixture = buildSync({ entryPoints: ['tests/product/fixtures/ownerRevisionRecovery.tsx'], bundle: true,
  platform: 'browser', format: 'iife', write: false, outfile: join(tmpdir(), 'cardforge-owner-revision-recovery-proof.js'),
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
});
const first = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';
const snapshot = (submissionId: string, trashed = true) => ({ name: submissionId === first ? 'First exact revision' : 'Second exact revision',
  state: { scope: 'revision', submissionId, lineageId: '00000000-0000-4000-8000-000000000003', revisionNumber: 1,
    registrySubmissionId: null, revisionHighWater: 2, recoveryVersion: trashed ? '2' : '3', status: 'archived', updatedAt: '2026-10-31T18:00:00Z',
    trashedAt: trashed ? '2026-10-31T18:00:00Z' : null, purgeAfter: trashed ? '2026-11-30T18:00:00Z' : null, held: false },
  retentionDays: 30, trashActor: trashed ? 'contributor' : null, trashReasons: trashed ? ['revision_already_trashed'] : [],
  restoreReasons: trashed ? [] : ['revision_not_trashed'], canHold: false, publicationRetained: true, sourceUncertainty: 'legacy_destructive_history_unverified',
});
async function mount(page: import('@playwright/test').Page) {
  await page.route('**/__revision-recovery-proof', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui;padding:16px}button{margin:8px;padding:8px}p{overflow-wrap:anywhere}</style><body></body>' }));
  await page.goto('/__revision-recovery-proof');
  await page.addScriptTag({ content: fixture.outputFiles.find(file => file.path.endsWith('.js'))!.text });
}
// Credential-free native component proof. API replies are intercepted; this is
// neither hosted account authority nor PostgreSQL/Storage acceptance.
test('@golden revision recovery fences pending reads across exact target and account switches', async ({ page }) => {
  let release: (() => void) | undefined;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/pipeline/*/lifecycle', async route => {
    const id = route.request().url().includes(first) ? first : second;
    if (id === first) await pending;
    await route.fulfill({ json: snapshot(id) });
  });
  await mount(page);
  await page.getByRole('button', { name: 'Inspect revision recovery' }).click();
  await page.getByRole('button', { name: 'Switch revision' }).click();
  release!();
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Inspect revision recovery' }).click();
  await expect(page.getByRole('button', { name: 'Restore revision to history' })).toBeEnabled();
  await expect(page.getByText('Recovering this record does not prove its source bytes are present.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Switch account' }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restore revision to history' })).toHaveCount(0);
});
test('@golden revision recovery requires a new read after uncertainty and ignores old account mutation receipts', async ({ page }) => {
  let posts = 0;
  let release: (() => void) | undefined;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/pipeline/*/lifecycle', async route => {
    if (route.request().method() === 'POST') {
      posts++;
      expect(route.request().postDataJSON()).toEqual({ action: 'restore', expected: snapshot(first).state });
      if (posts === 1) return route.fulfill({ status: 503, json: { error: 'Outcome uncertain; read exact state.' } });
      await pending;
      return route.fulfill({ json: snapshot(first, false) });
    }
    return route.fulfill({ json: snapshot(first) });
  });
  await mount(page);
  await page.getByRole('button', { name: 'Inspect revision recovery' }).click();
  await page.getByRole('button', { name: 'Restore revision to history' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restore revision to history' })).toHaveCount(0);
  expect(posts).toBe(1);
  await page.getByRole('button', { name: 'Inspect revision recovery' }).click();
  await page.getByRole('button', { name: 'Restore revision to history' }).click();
  await page.getByRole('button', { name: 'Switch account' }).click();
  release!();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Move revision to Trash' })).toHaveCount(0);
  await expect(page.getByText('Refreshes: 0', { exact: true })).toBeVisible();
  expect(posts).toBe(2);
});

test('@golden Owner recovery refreshes native outer revision and deletion affordances', async ({ page }) => {
  let state = { ...snapshot(first, false).state, status: 'voting' };
  await page.route('**/api/**', async route => {
    if (!route.request().url().endsWith('/lifecycle')) return route.abort();
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON();
      expect(input.expected).toEqual(state);
      state = { ...state, status: 'archived', recoveryVersion: String(Number(state.recoveryVersion) + 1),
        trashedAt: input.action === 'trash' ? '2026-10-31T18:00:00Z' : null,
        purgeAfter: input.action === 'trash' ? '2026-11-30T18:00:00Z' : null };
    }
    return route.fulfill({ json: { ...snapshot(first), name: 'Owner recovery projection', state,
      publicationRetained: false, trashActor: state.trashedAt ? 'owner' : null,
      trashReasons: state.trashedAt ? ['revision_already_trashed'] : [], restoreReasons: state.trashedAt ? [] : ['revision_not_trashed'] } });
  });
  await page.route('**/__revision-recovery-proof', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
  await page.goto('/__revision-recovery-proof');
  for (const file of ownerFixture.outputFiles.filter(file => file.path.endsWith('.css'))) await page.addStyleTag({ content: file.text });
  await page.addScriptTag({ content: ownerFixture.outputFiles.find(file => file.path.endsWith('.js'))!.text });
  await page.getByRole('button', { name: 'Manage', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete now (one revision)' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Inspect revision recovery' }).click();
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Move revision to Trash' }).click();
  await expect(page.getByRole('button', { name: 'Delete now (one revision)' })).toBeVisible();
  await page.getByRole('button', { name: 'Restore revision to history' }).click();
  await expect(page.getByRole('button', { name: 'Delete now (one revision)' })).toHaveCount(0);
});
