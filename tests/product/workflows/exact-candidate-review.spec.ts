import { buildSync } from 'esbuild';
import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getFreshDefaultTemplateObject } from '../../../src/domain/templates';
const bundle = buildSync({ entryPoints: ['tests/product/fixtures/exactCandidateReview.tsx'], bundle: true, platform: 'browser', format: 'iife', write: false, outfile: join(tmpdir(),'exact-candidate.js'), define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' } });
const template = getFreshDefaultTemplateObject('synthetic-candidate', 'Synthetic candidate proof');
template.freeformCanvas!.elements = template.freeformCanvas!.elements.filter(e => e.type === 'text').slice(0,1).map(e => ({ ...e, content: 'CANDIDATE REVISION 2' }));
template.baseBackgroundColor = '#1844aa';
template.cardBackgroundImageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWOQcFn1H4QZYAwAQpAIFb6jDMcAAAAASUVORK5CYII=';
const hash = createHash('sha256').update(JSON.stringify(template)).digest('hex');
const publishedBase = { assetId: template.id!, lineageId:'00000000-0000-4000-8000-000000000001', parentSubmissionId:'00000000-0000-4000-8000-000000000003', baseRevisionNumber:1, revisionHighWater:1, parentContentVersion:'a'.repeat(32), registryContentVersion:'b'.repeat(32) };
const identity = { submissionId:'00000000-0000-4000-8000-000000000002', lineageId:publishedBase.lineageId, assetId:template.id!, revisionNumber:2, baseRevisionNumber:1, publishedBase, sourceSha256:hash };
// Synthetic intercepted read only: not hosted Owner/provider acceptance.
for (const failure of ['none','stale','altered','missing'] as const) test(`@golden exact specimen PDF ${failure}`, async ({ page }, info) => {
  let reads = 0;
  await page.route('**/api/pipeline/candidate-review', route => {
    reads++;
    expect(route.request().postDataJSON()).toEqual(identity);
    if (failure === 'stale' && reads > 1) return route.fulfill({ status:409, json:{ error:'Candidate changed' } });
    const candidate = failure === 'missing' ? { ...template, cardBackgroundImageUrl:'data:image/webp;base64,YmFk' } : template;
    return route.fulfill({ json:{ identity, expectedBase:publishedBase, template: failure === 'altered' ? { ...template, name:'altered' } : candidate, hydratedSha256:createHash('sha256').update(JSON.stringify(candidate)).digest('hex') } });
  });
  await page.goto('/');
  const styles = await page.locator('head').evaluate(head => [...head.querySelectorAll('style,link[rel="stylesheet"]')].map(n => n.outerHTML).join('\n'));
  await page.route('**/__exact-review', route => route.fulfill({ contentType:'text/html', body:`<!doctype html><html><head>${styles}</head><body></body></html>` }));
  await page.goto('/__exact-review');
  for (const file of bundle.outputFiles.filter(f => f.path.endsWith('.css'))) await page.addStyleTag({ content:file.text });
  await page.addScriptTag({ content:bundle.outputFiles.find(f=>f.path.endsWith('.js'))!.text });
  await page.getByLabel('Exact candidate identity JSON').fill(JSON.stringify(identity));
  await page.getByRole('button',{ name:'Render exact specimen' }).click();
  if (failure === 'altered') { await expect(page.getByRole('alert')).toContainText('handoff changed'); return; }
  if (failure === 'missing') { await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByRole('button',{ name:/PDF/ })).toHaveCount(0); return; }
  await expect(page.getByAltText('Exact pending candidate specimen')).toBeVisible();
  await page.screenshot({ path:info.outputPath('specimen.png'), fullPage:true });
  const downloads: string[] = []; page.on('download', d=>downloads.push(d.suggestedFilename()));
  if (failure === 'stale') {
    await page.getByRole('button',{ name:/PDF/ }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    expect(downloads).toEqual([]); return;
  }
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button',{ name:/PDF/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(`${identity.submissionId}-r2-${hash}`);
  const path = info.outputPath('exact-candidate.pdf'); await download.saveAs(path);
  const pdf = await readFile(path);
  expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
  expect(pdf.toString('latin1')).toContain('/Subtype /Image');
  expect(reads).toBe(3); // initial, before render, before delivery
});
