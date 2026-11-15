import { devices, expect, test, type Page } from '@playwright/test';
import { buildCardForgeProjectSnapshot, encodeCardForgeProjectPackage } from '@/features/project/lib/projectPackageCodec';
import type { ProjectDocumentV1 } from '@/features/project/client/package-document';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
import { closeScaleSet, seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

const context = '  A complete Set\nhttps://example.test/literal-context  ';
const project = () => {
  const document = createProjectScaleFixture(100, { uniqueArtwork: true });
  document.version = 2;
  document.storedCards = document.storedCards.slice(0, 2);
  document.cardSets[0]!.plan = { version: 1, context };
  document.userTemplates.push({ ...structuredClone(document.userTemplates[0]!), id: 'set-file-back', name: 'Set File Back' });
  document.cardSets[0]!.templateIds = document.userTemplates.map((template) => template.id!);
  document.storedCards.forEach((card) => { card.backingTemplateId = 'set-file-back'; card.backingData = { cardName: 'Authored reverse' }; });
  return document;
};
const upload = async (document = project()) => ({
  name: 'transfer.cardforge', mimeType: 'application/octet-stream',
  buffer: Buffer.from(await encodeCardForgeProjectPackage(await buildCardForgeProjectSnapshot({ document, name: 'Set transfer' }))),
});
const readWorkspace = (page: Page) => page.evaluate(async () => {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('cardforge-browser-storage');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const records = await Promise.all(['guest', 'local'].map((scope) => new Promise<{ revision: number; value: string }>((resolve, reject) => {
    const request = database.transaction('key-value').objectStore('key-value').get(`project-workspace:${scope}:workspace`);
    request.onsuccess = () => resolve(JSON.parse(request.result as string));
    request.onerror = () => reject(request.error);
  })));
  database.close();
  return JSON.parse(records.sort((left, right) => right.revision - left.revision)[0]!.value).state as Pick<ProjectDocumentV1, 'cardSets' | 'storedCards' | 'userTemplates'>;
});
const chooser = (page: Page) => page.getByRole('dialog', { name: 'Start a new Set', exact: true });
const input = (page: Page) => chooser(page).getByLabel('Choose a .cardforge Set file', { exact: true });

for (const mobile of [false, true]) {
  test.describe(`native Set file opening on ${mobile ? 'mobile' : 'desktop'}`, () => {
    test.use(mobile ? { viewport: devices['Pixel 7'].viewport, isMobile: true, hasTouch: true } : { viewport: { width: 1180, height: 757 } });

    test('@golden opens a complete Set from an empty Desk and retains it on reload', async ({ page }) => {
      test.setTimeout(90_000);
      await seedGuestScaleWorkspace(page, 100, { emptyDesk: true });
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Your desk is ready', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Create your first Set', exact: true }).click();
      await expect(chooser(page).getByRole('button', { name: 'Open a Set file', exact: true })).toBeVisible();
      await input(page).setInputFiles(await upload());
      await expect(chooser(page)).toHaveCount(0);
      await expect(page.getByRole('searchbox', { name: 'Search cards in this Set', exact: true })).toBeVisible();
      await expect(page.locator('button[data-artifact-id]').filter({ hasText: 'Scale Card 0001' })).toBeVisible();
      await expect.poll(async () => (await readWorkspace(page)).cardSets.length).toBe(1);
      const state = await readWorkspace(page);
      const set = state.cardSets[0]!;
      expect(set.id).not.toBe('scale-set-100');
      expect(set.plan?.context).toBe(context);
      expect(set.templateIds).toHaveLength(2);
      expect(state.storedCards).toHaveLength(2);
      expect(state.storedCards.every((card) => card.setId === set.id && set.templateIds!.includes(card.templateId) && set.templateIds!.includes(card.backingTemplateId!))).toBe(true);
      expect(state.storedCards[0]!.data.artwork).toMatch(/^cardforge-browser-asset:\/\//);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('searchbox', { name: 'Search cards in this Set', exact: true })).toBeVisible();
      expect((await readWorkspace(page)).cardSets[0]!.plan?.context).toBe(context);
      await closeScaleSet(page);
      await expect(page.getByRole('button', { name: /^(Select|Selected) 100 Card Scale Set/ })).toBeVisible();
    });

    test('@golden refuses invalid and multi-Set input, supports cancellation/retry, and preserves colliding work', async ({ page }) => {
      test.setTimeout(90_000);
      await seedGuestScaleWorkspace(page, 100, { cardLimit: 2 });
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-desk-arrival-phase="ready"]')).toBeVisible();
      const before = await readWorkspace(page);
      await page.getByRole('button', { name: 'New Set', exact: true }).click();
      await input(page).setInputFiles({ name: 'transfer.cardforge', mimeType: 'application/octet-stream', buffer: Buffer.from('not an archive') });
      await expect(chooser(page).getByText('This file is not a readable CardForge project package.', { exact: true })).toBeVisible();
      const multiple = project();
      multiple.cardSets.push({ id: 'unrelated-legacy-set', name: 'Other Set' });
      await input(page).setInputFiles(await upload(multiple));
      await expect(chooser(page).getByText(/exactly one Set/)).toBeVisible();
      expect((await readWorkspace(page)).cardSets).toEqual(before.cardSets);
      expect((await readWorkspace(page)).storedCards).toEqual(before.storedCards);
      await input(page).setInputFiles([]);
      await page.keyboard.press('Escape');
      await expect(chooser(page)).toHaveCount(0);
      await page.getByRole('button', { name: 'New Set', exact: true }).click();
      await input(page).setInputFiles(await upload());
      await expect(page.getByRole('searchbox', { name: 'Search cards in this Set', exact: true })).toBeVisible();
      await expect.poll(async () => (await readWorkspace(page)).cardSets.length).toBe(2);
      const after = await readWorkspace(page);
      expect(after.cardSets.find((set) => set.id === 'scale-set-100')).toEqual({ ...before.cardSets[0], templateIds: ['scale-template'] });
      expect(after.storedCards.filter((card) => card.setId === 'scale-set-100')).toEqual(before.storedCards);
      expect(after.userTemplates.find((template) => template.id === 'scale-template')).toEqual(before.userTemplates[0]);
      expect(after.cardSets.find((set) => set.id !== 'scale-set-100')!.plan?.context).toBe(context);
    });
  });
}
