import { buildSync } from 'esbuild';
import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const fixture = buildSync({ entryPoints: ['tests/product/fixtures/ownerRevisionRecovery.tsx'], bundle: true,
  platform: 'browser', format: 'iife', write: false, outfile: join(tmpdir(), 'cardforge-owner-author-note-proof.js'),
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' } });

test('changing the review outcome does not carry the previous author note and retains unsaved outcome drafts', async ({ page }) => {
  await page.route('**/__owner-author-note-proof', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
  await page.route('**/api/pipeline/*?view=editorial', route => route.fulfill({ json: {
    submissionId: '00000000-0000-4000-8000-000000000001', authorNote: 'Please revise the title.',
    reviewNote: 'Private reason', reviewStatus: 'revise', evidenceVersion: 0,
  } }));
  await page.goto('/__owner-author-note-proof');
  await page.addScriptTag({ content: fixture.outputFiles.find(file => file.path.endsWith('.js'))!.text });
  await page.getByRole('button', { name: 'Manage', exact: true }).click();
  const outcome = page.getByLabel('Review outcome');
  const note = page.getByLabel(/Note to the author/);
  await expect(note).toHaveValue('Please revise the title.');
  await outcome.selectOption('quarantine');
  await expect(note).toHaveValue('');
  await note.fill('Please pause work.');
  await outcome.selectOption('revise');
  await expect(note).toHaveValue('Please revise the title.');
  await outcome.selectOption('quarantine');
  await expect(note).toHaveValue('Please pause work.');
});
