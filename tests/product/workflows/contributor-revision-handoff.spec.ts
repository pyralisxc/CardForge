import { buildSync } from 'esbuild';
import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const bundle = buildSync({ entryPoints: ['tests/product/fixtures/contributorRevisionHandoff.tsx'], bundle: true,
  platform: 'browser', format: 'iife', write: false, outfile: join(tmpdir(), 'contributor-revision-handoff.js'), define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' } });
test('saved reviewed revision survives an uncertain browser handoff and retries the same snapshot only after readback', async ({ page }) => {
  const attempts: { lookup: boolean; key: string; actor: string; body: unknown }[] = [];
  let posts = 0;
  await page.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname === '/__contributor-handoff') return route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' });
    if (url.pathname === '/api/templates/submissions' && request.method() === 'GET') return route.fulfill({ json: { contributorId: 'fixture-author' } });
    if (url.pathname === '/api/templates/submissions' && request.method() === 'POST') {
      const lookup = url.searchParams.get('lookup') === '1'; const headers = request.headers();
      attempts.push({ lookup, key: headers['idempotency-key'], actor: headers['x-pipeline-contributor'], body: request.postDataJSON() });
      if (lookup) return route.fulfill({ json: { openInPipelineUrl: null } });
      posts++;
      return posts === 1 ? route.fulfill({ status: 503, json: { error: 'Unconfirmed' } })
        : route.fulfill({ status: 201, json: { openInPipelineUrl: '/account?section=library&scope=pipeline&tool=contribute&submission=fixture' } });
    }
    return route.abort();
  });
  const boot = async () => { await page.goto('http://localhost:9002/__contributor-handoff'); await page.addScriptTag({ content: bundle.outputFiles.find(file => file.path.endsWith('.js'))!.text }); };
  await boot();
  await page.getByLabel('Saved Template').selectOption('saved-personal');
  await page.getByRole('button', { name: 'Continue saved Template' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await boot();
  await page.getByLabel('Saved Template').selectOption('saved-personal');
  await page.getByRole('button', { name: 'Check submission outcome' }).click();
  await page.getByRole('button', { name: 'Retry original snapshot' }).click();
  await expect(page.getByLabel('Opened Pipeline destination')).toContainText('submission=fixture');
  expect(posts).toBe(2);
  expect(new Set(attempts.map(attempt => attempt.key)).size).toBe(1);
  expect(attempts.every(attempt => attempt.actor === 'fixture-author')).toBe(true);
  expect(attempts.every(attempt => JSON.stringify(attempt.body) === JSON.stringify(attempts[0].body))).toBe(true);
  expect(attempts[0].body).toMatchObject({ id: 'saved-personal', revisionBase: { parentSubmissionId: '11111111-1111-4111-8111-111111111111', assetId: 'shared-original' } });
});

test('late receipt for one saved Template cannot navigate after selecting another', async ({ page }) => {
  let posts = 0; let release: (() => void) | undefined;
  await page.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname === '/__contributor-handoff') return route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' });
    if (url.pathname === '/api/templates/submissions' && request.method() === 'GET') return route.fulfill({ json: { contributorId: 'fixture-author' } });
    if (url.pathname === '/api/templates/submissions' && request.method() === 'POST') {
      if (url.searchParams.get('lookup') === '1') {
        if (!posts) return route.fulfill({ json: { openInPipelineUrl: null } });
        await new Promise<void>(resolve => { release = resolve; });
        return route.fulfill({ json: { openInPipelineUrl: '/account?section=library&scope=pipeline&tool=contribute&submission=old' } });
      }
      posts++; return route.fulfill({ status: 503, json: { error: 'Unconfirmed' } });
    }
    return route.abort();
  });
  await page.goto('http://localhost:9002/__contributor-handoff');
  await page.addScriptTag({ content: bundle.outputFiles.find(file => file.path.endsWith('.js'))!.text });
  await page.getByLabel('Saved Template').selectOption('saved-personal');
  await page.getByRole('button', { name: 'Continue saved Template' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Check submission outcome' }).click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await page.getByLabel('Saved Template').selectOption('other-personal');
  const responseDone = page.waitForResponse(response => response.url().includes('lookup=1') && response.status() === 200);
  release!(); await responseDone; await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  await expect(page.getByLabel('Opened Pipeline destination')).toHaveText('');
  await expect(page.getByText('No committed draft was found.')).toHaveCount(0);
});

test('does not start another handoff before saved attempts are readable', async ({ page }) => {
  let release: (() => void) | undefined; let writes = 0;
  await page.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname === '/__contributor-handoff') return route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' });
    if (url.pathname === '/api/templates/submissions' && request.method() === 'GET') {
      await new Promise<void>(resolve => { release = resolve; });
      return route.fulfill({ json: { contributorId: 'fixture-author' } });
    }
    if (request.method() === 'POST') writes++;
    return route.abort();
  });
  await page.goto('http://localhost:9002/__contributor-handoff');
  await page.addScriptTag({ content: bundle.outputFiles.find(file => file.path.endsWith('.js'))!.text });
  await page.getByLabel('Saved Template').selectOption('saved-personal');
  await expect.poll(() => Boolean(release)).toBe(true);
  await expect(page.getByRole('button', { name: 'Continue saved Template' })).toBeDisabled();
  expect(writes).toBe(0);
  release!();
  await expect(page.getByRole('button', { name: 'Continue saved Template' })).toBeEnabled();
  expect(writes).toBe(0);
});

test('a failed saved-attempt read can be retried before continuing', async ({ page }) => {
  let reads = 0; let writes = 0;
  await page.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname === '/__contributor-handoff') return route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' });
    if (url.pathname === '/api/templates/submissions' && request.method() === 'GET') {
      reads++;
      return reads === 1 ? route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } })
        : route.fulfill({ json: { contributorId: 'fixture-author' } });
    }
    if (request.method() === 'POST') writes++;
    return route.abort();
  });
  await page.goto('http://localhost:9002/__contributor-handoff');
  await page.addScriptTag({ content: bundle.outputFiles.find(file => file.path.endsWith('.js'))!.text });
  await page.getByLabel('Saved Template').selectOption('saved-personal');
  await expect(page.getByRole('button', { name: 'Continue saved Template' })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry saved attempts' }).click();
  await expect(page.getByRole('button', { name: 'Continue saved Template' })).toBeEnabled();
  expect(writes).toBe(0);
});
