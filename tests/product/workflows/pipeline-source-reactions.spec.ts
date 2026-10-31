import { buildSync } from 'esbuild';
import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const bundle = buildSync({ entryPoints: ['tests/product/fixtures/pipelineSourceReactions.tsx'], bundle: true, platform: 'browser', format: 'iife', write: false, outfile: join(tmpdir(), 'pipeline-source-reactions.js'), define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_RUNTIME': '"browser"', 'process.env': '{}' } });
const first = '10000000-0000-4000-8000-000000000001';
const second = '10000000-0000-4000-8000-000000000002';
const lineageId = '20000000-0000-4000-8000-000000000001';
async function mount(page: Page, options: { blocked?: boolean; failure?: boolean; delayed?: boolean } = {}) {
  const mutations: { path: string; body: unknown }[] = [];
  const reads: string[] = [];
  const values = { positive: 2, negative: 1, heart: 4, hearted: false, vote: null as string | null };
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__source-reactions') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><style>body{background:#111;color:#eee}button{padding:8px;margin:2px}section{margin:8px;border:1px solid #999}</style></head><body></body></html>' });
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); mutations.push({ path: url.pathname, body });
      if (url.pathname.endsWith('/vote')) { values.vote = body.voteValue; values.positive += body.voteValue === 'positive' ? 1 : 0; values.negative += body.voteValue === 'negative' ? 1 : 0; }
      else { values.hearted = body.hearted; values.heart += body.hearted ? 1 : -1; }
      return route.fulfill({ json: { confirmed: true } });
    }
    if (url.pathname === '/api/catalog/studio-assets') return route.fulfill({ json: { assets: { textures: [], icons: [], dividers: [], imageAssets: [
      { id: 'published-original', name: 'Original source', url: 'data:image/png;base64,', kind: 'image', publishedSubmissionId: first, librarySource: 'official', tileMode: 'contain', seamless: false, allowedTargets: ['image'] },
      { id: 'other-source', name: 'Second source', url: 'data:image/png;base64,', kind: 'image', publishedSubmissionId: second, librarySource: 'official', tileMode: 'contain', seamless: false, allowedTargets: ['image'] },
    ] } } });
    if (url.pathname === '/api/catalog/studio-bootstrap') return route.fulfill({ json: { templates: { defaults: [{ id: 'bootstrap-original', templateRevision: 1, templateRevisionId: 'published-r1' }] }, styles: { styles: [] }, pipeline: [{ assetId: 'bootstrap-original', submissionId: first }] } });
    if (url.pathname === '/api/pipeline/engagement') {
      const id = url.searchParams.get('submissionId')!; reads.push(id);
      if (options.failure) return route.fulfill({ status: 503, json: { error: { message: 'Source service unavailable', code: 'pipeline_reaction_unavailable', kind: 'unavailable' } } });
      if (options.delayed && id === first) await new Promise(resolve => setTimeout(resolve, 500));
      return route.fulfill({ json: { submissionId: id, lineageId, name: id === first ? 'Original revision one' : 'Original revision two', revisionNumber: id === first ? 1 : 2, status: 'published', trashedAt: null, purgeState: null, positiveVotes: values.positive, negativeVotes: values.negative, currentUserVote: values.vote, voteIssue: options.blocked ? 'Contributor review access required' : null, heart: { count: values.heart, hearted: values.hearted }, heartIssue: options.blocked ? 'Sign in to heart Pipeline work.' : null } });
    }
    return route.abort();
  });
  await page.goto('/__source-reactions');
  await page.addScriptTag({ content: bundle.outputFiles.find(file => file.path.endsWith('.js'))!.text });
  return { mutations, reads };
}
test('@golden Studio exact source, lineage heart and other mounted representations refresh through native commands', async ({ page }) => {
  const evidence = await mount(page); const studio = page.getByLabel('Studio original');
  await expect(studio.getByText(/Original revision one/)).toBeVisible();
  await studio.getByRole('button', { name: 'Like 2', exact: true }).click();
  await expect(studio.getByRole('button', { name: 'Like 3', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Other representation').getByRole('button', { name: 'Like 3', exact: true })).toBeVisible();
  await studio.getByRole('button', { name: 'Dislike 1', exact: true }).click();
  await expect(studio.getByRole('button', { name: 'Dislike 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await studio.getByRole('button', { name: 'Heart 4', exact: true }).click();
  await expect(page.getByLabel('Other representation').getByRole('button', { name: 'Heart 5', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(evidence.mutations).toEqual([{ path: `/api/pipeline/${first}/vote`, body: { voteValue: 'positive' } }, { path: `/api/pipeline/${first}/vote`, body: { voteValue: 'negative' } }, { path: '/api/pipeline/hearts', body: { lineageId, hearted: true } }]);
});
test('@golden picker source feedback is pinned to selection and keyboard reactions never apply or select another resource', async ({ page }) => {
  const evidence = await mount(page); await page.getByRole('button', { name: 'Choose from Library', exact: true }).click();
  const original = page.getByRole('option', { name: /Original source/ }); await original.click();
  const details = page.getByLabel('Selected Library resource details'); await expect(details.getByText(/Original revision one/)).toBeVisible();
  await page.getByRole('option', { name: /Second source/ }).hover();
  await expect(details.getByText(/Original revision one/)).toBeVisible();
  await details.getByRole('button', { name: 'Like 2', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(details.getByRole('button', { name: 'Like 3', exact: true })).toBeVisible();
  await expect(original).toHaveAttribute('aria-selected', 'true'); await expect(page.getByLabel('Applied source')).toHaveText('none');
  expect(evidence.mutations).toEqual([{ path: `/api/pipeline/${first}/vote`, body: { voteValue: 'positive' } }]);
  await page.getByRole('option', { name: /Spoofed personal copy/ }).click();
  await expect(details.getByText(/No exact governed Pipeline source/)).toBeVisible(); await expect(details.getByRole('button', { name: /Like/ })).toHaveCount(0);
  await page.getByRole('option', { name: /Forged saved shared claim/ }).click();
  await expect(details.getByText(/No exact governed Pipeline source/)).toBeVisible(); await expect(details.getByRole('button', { name: /Like/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Use selection', exact: true }).click();
  await expect(page.getByLabel('Applied source')).toHaveText('forged-shared');
});
test('@golden stale reads cannot substitute a prior revision after source switch; account changes reload protected signal', async ({ page }) => {
  const evidence = await mount(page, { delayed: true });
  await page.getByRole('button', { name: 'Switch exact source' }).click();
  const studio = page.getByLabel('Studio original'); await expect(studio.getByText(/Original revision two/)).toBeVisible();
  await page.waitForTimeout(600); await expect(studio.getByText(/Original revision one/)).toHaveCount(0);
  const before = evidence.reads.length; await page.getByRole('button', { name: 'Change account scope' }).click();
  await expect.poll(() => evidence.reads.length).toBeGreaterThan(before);
  await studio.getByRole('button', { name: 'Like 2', exact: true }).click(); expect(evidence.mutations[0].path).toBe(`/api/pipeline/${second}/vote`);
});
test('@golden ineligible and unavailable sources do not send mutations or invent empty metrics', async ({ page }) => {
  const evidence = await mount(page, { blocked: true }); const studio = page.getByLabel('Studio original');
  await expect(studio.getByRole('button', { name: 'Like 2', exact: true })).toBeDisabled(); await expect(studio.getByRole('button', { name: 'Heart 4', exact: true })).toBeDisabled();
  expect(evidence.mutations).toEqual([]);
});
test('@golden unavailable source keeps an honest retry action', async ({ page }) => {
  const evidence = await mount(page, { failure: true }); const studio = page.getByLabel('Studio original');
  await expect(studio.getByRole('button', { name: 'Refresh source reactions' })).toBeVisible(); await expect(studio.getByRole('button', { name: /^Like/ })).toHaveCount(0); expect(evidence.mutations).toEqual([]);
});

test('@golden personal edits retain the pinned source controller; actual revision mismatch becomes unavailable', async ({ page }) => {
  const evidence = await mount(page); const source = page.getByLabel('Bootstrap source');
  await expect(source.getByText(/Original revision one/)).toBeVisible();
  const before = evidence.reads.length;
  await page.getByRole('button', { name: 'Edit personal copy', exact: true }).click();
  await expect(source.getByText(/Original revision one/)).toBeVisible();
  expect(evidence.reads).toHaveLength(before);
  await page.getByRole('button', { name: 'Change document revision', exact: true }).click();
  await expect(source.getByText(/No exact governed Pipeline source/)).toBeVisible();
  expect(evidence.mutations).toEqual([]);
});
