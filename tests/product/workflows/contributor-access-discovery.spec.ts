import { buildSync } from 'esbuild';
import { expect, test } from '@playwright/test';

const bundle = buildSync({ entryPoints: ['tests/product/fixtures/contributorAccessDiscovery.tsx'], bundle: true,
  platform: 'browser', format: 'iife', write: false, define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' } });

test('discovery remains read-only on load and focus, even alongside an enrolling request', async ({ page }) => {
  const requests: string[] = [];
  let release: (() => void) | undefined;
  const bothStarted = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__access-discovery') return route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' });
    if (url.pathname !== '/api/contributor-access') return route.abort();
    const readOnly = url.searchParams.get('readOnly') === '1';
    requests.push(readOnly ? 'read' : 'enroll');
    if (requests.length === 2) release?.();
    await bothStarted;
    return route.fulfill({ json: { active: !readOnly, scopes: [] } });
  });
  await page.goto('http://localhost:9002/__access-discovery');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await expect(page.getByLabel('Discovery access')).toHaveText('inactive');
  await expect(page.getByLabel('Established access')).toHaveText('active');
  expect(requests.slice(0, 2).sort()).toEqual(['enroll', 'read']);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => requests.length).toBe(4);
  expect(requests.slice(2).sort()).toEqual(['enroll', 'read']);
  await expect(page.getByLabel('Discovery access')).toHaveText('inactive');
});
