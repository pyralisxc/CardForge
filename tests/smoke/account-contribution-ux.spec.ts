import { expect, test, type Page } from '@playwright/test';
import axe from 'axe-core';

const READY_TIMEOUT = 120_000;
const WORKSPACE_DATABASE = 'cardforge-browser-storage';
const WORKSPACE_STORE = 'key-value';
const GUEST_WORKSPACE_KEY = 'project-workspace:guest:workspace';

const workflowTemplate = (id: string, name: string, color: string, usage: 'front-preset' | 'back-preset' = 'front-preset') => ({
  id,
  name,
  aspectRatio: '63:88',
  templateSource: 'user',
  templateUsage: usage,
  baseBackgroundColor: color,
  baseTextColor: '#ffffff',
  fieldContracts: usage === 'front-preset' ? [
    { key: 'card_name', elementId: `${id}-name`, label: 'Name', type: 'text', required: true },
    { key: 'note', elementId: `${id}-note`, label: 'Note', type: 'text', required: false },
  ] : [],
  freeformCanvas: {
    width: 630,
    height: 880,
    elements: usage === 'front-preset' ? [
      { id: `${id}-name`, type: 'text', name: 'Name', x: 50, y: 350, width: 530, height: 110, zIndex: 1, content: '{{card_name:"Card name"}}' },
      { id: `${id}-note`, type: 'text', name: 'Note', x: 50, y: 500, width: 530, height: 90, zIndex: 1, content: '{{note:"Review note"}}' },
    ] : [{ id: `${id}-name`, type: 'text', name: 'Name', x: 50, y: 385, width: 530, height: 110, zIndex: 1, content: 'CardForge review back' }],
  },
});

async function seedNewCreatorTemplates(page: Page) {
  await page.goto('/robots.txt', { waitUntil: 'domcontentloaded' });
  const state = {
    userTemplates: [
      workflowTemplate('workflow-ember', 'Ember Template', '#7c2d12'),
      workflowTemplate('workflow-tide', 'Tide Template', '#164e63'),
      workflowTemplate('workflow-back', 'Review Card Back', '#1e293b', 'back-preset'),
    ],
    appearanceStyles: [],
    storedCards: [],
    cardSets: [],
    activeCardSet: null,
    studioView: 'template',
    singleCardGeneratorSelectedTemplateId: 'workflow-ember',
    singleCardGeneratorSelectedBackingTemplateId: 'workflow-back',
    templateEditorSelectedTemplateId: 'workflow-ember',
    exportMode: 'virtual',
    exportDpi: 300,
    customAssets: {
      'cardforge-maker-custom-textures': [], 'cardforge-maker-custom-dividers': [],
      'cardforge-maker-custom-icons': [], 'cardforge-maker-custom-images': [],
    },
  };
  await page.evaluate(async ({ databaseName, objectStoreName, storageKey, stateValue }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(objectStoreName)) request.result.createObjectStore(objectStoreName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const value = JSON.stringify({ state: stateValue, version: 3 });
    const record = JSON.stringify({ cardforgeWorkspaceRecord: 1, revision: 1, writerId: 'playwright-new-creator', value });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(objectStoreName, 'readwrite');
      transaction.objectStore(objectStoreName).put(record, storageKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, { databaseName: WORKSPACE_DATABASE, objectStoreName: WORKSPACE_STORE, storageKey: GUEST_WORKSPACE_KEY, stateValue: state });
}

async function expectNoWcagViolations(page: Page) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const result = await (window as typeof window & { axe: { run: (options: unknown) => Promise<{ violations: Array<{ id: string; nodes: Array<{ target: string[] }> }> }> } }).axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    return result.violations.map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) }));
  });
  expect(violations).toEqual([]);
}

test.describe('account contribution surfaces', () => {
  test.describe.configure({ timeout: 180_000 });
  test.beforeEach(async ({ page }) => {
    const previewShareUrl = process.env.CARDFORGE_E2E_PREVIEW_SHARE_URL;
    if (previewShareUrl) {
      await page.goto(previewShareUrl, { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
    }
  });

  test('walks a new creator through a mixed-Template, reversible 10-card Set', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedNewCreatorTemplates(page);
    await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });

    await expect(page.getByRole('heading', { name: 'Your creative workspace' })).toBeVisible();
    await page.getByRole('button', { name: 'Create your first Set' }).click();
    await page.getByRole('button', { name: 'Fresh Set', exact: true }).click();
    await expect(page.locator('[data-home-work-object][data-presentation="focused"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Inside this Set' })).toBeVisible();
    await page.getByLabel('Work name').fill('Mixed Template Review Set');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    const generateBatch = async (templateName: string, prefix: string) => {
      await page.locator('#generation-step-setup').click();
      await page.locator('#deck-front-template').click();
      await page.getByRole('option', { name: new RegExp(templateName) }).click();
      await page.locator('#deck-backing-template').click();
      await page.getByRole('option', { name: /Review Card Back/ }).click();
      await page.getByRole('button', { name: /Continue to card data/ }).click();
      const rows = ['card_name,note', ...Array.from({ length: 5 }, (_, index) => `${prefix} ${index + 1},Mixed Template walkthrough`)].join('\n');
      await page.getByLabel('Add your card list').fill(rows);
      await expect(page.getByText('CardForge is ready to make 5 cards.')).toBeVisible();
      await page.getByRole('button', { name: 'Add Cards to Set' }).click();
      await expect(page.getByText(/5 cards added to Mixed Template Review Set/)).toBeVisible();
    };

    await page.getByRole('button', { name: 'Generate cards', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Generate into Mixed Template Review Set' })).toBeVisible();
    await generateBatch('Ember Template', 'Ember');
    await page.getByRole('button', { name: 'Add another batch' }).click();
    await generateBatch('Tide Template', 'Tide');
    await page.getByRole('button', { name: 'View cards on Desk' }).click();
    await page.getByRole('button', { name: 'Clear all', exact: true }).click();
    await expect(page.getByText('10 shown', { exact: true })).toBeVisible();
    await page.getByText('Ordered Artifact navigator · 10', { exact: true }).click();
    await expect(page.getByRole('option')).toHaveCount(10);
    await expect(page.getByRole('option').filter({ hasText: 'Ember Template' })).toHaveCount(5);
    await expect(page.getByRole('option').filter({ hasText: 'Tide Template' })).toHaveCount(5);

    const setFlip = page.getByRole('button', { name: /^Show back of Card / }).first();
    const emberTile = setFlip.locator('xpath=..');
    const artifactId = await emberTile.locator('[data-artifact-id]').getAttribute('data-artifact-id');
    expect(artifactId).toBeTruthy();
    await setFlip.click();
    const flippedTile = page.locator(`[data-card-face]:has([data-artifact-id="${artifactId}"])`);
    await expect(flippedTile).toHaveAttribute('data-card-face', 'back');
    await flippedTile.locator('[data-artifact-id]').click();
    const stage = page.locator('[data-home-artifact-stage]:visible');
    await expect(stage).toHaveAttribute('data-artifact-focus-exclusive', 'true');
    await expect(stage.locator('[data-artifact-id]')).toHaveCount(1);
    const readCenterOffset = () => stage.locator('[data-artifact-id]').evaluate((node) => {
      const box = node.getBoundingClientRect();
      const viewport = node.closest('[data-home-artifact-stage]')!.getBoundingClientRect();
      return Math.max(
        Math.abs((box.left + box.width / 2) - (viewport.left + viewport.width / 2)),
        Math.abs((box.top + box.height / 2) - (viewport.top + viewport.height / 2)),
      );
    });
    await expect.poll(readCenterOffset).toBeLessThan(3);
    expect(await stage.evaluate((node) => ({ horizontal: node.scrollWidth - node.clientWidth, vertical: node.scrollHeight - node.clientHeight }))).toEqual({ horizontal: 0, vertical: 0 });
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 2)).toBe(true);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    expect(await stage.evaluate((node) => node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 2)).toBe(true);
    await page.getByRole('button', { name: /^Show back of Card / }).click();
    await expect(page.locator('[data-card-face="back"]')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Fit', exact: true }).click();
    await expect.poll(() => stage.evaluate((node) => ({ horizontal: node.scrollWidth - node.clientWidth, vertical: node.scrollHeight - node.clientHeight }))).toEqual({ horizontal: 0, vertical: 0 });
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 2)).toBe(true);
    await expect.poll(readCenterOffset).toBeLessThan(3);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole('button', { name: 'Fit', exact: true }).click();

    await page.getByRole('button', { name: 'Edit Artifact' }).click();
    const studioDialog = page.getByRole('dialog', { name: 'Design Artifacts' });
    await expect(studioDialog).toBeVisible();
    await expect(studioDialog.getByRole('button', { name: 'Close Studio tool' })).toHaveCount(1);
    await expect(studioDialog.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
    await expect(studioDialog.getByRole('link', { name: 'Create account' })).toHaveCount(0);
    await expect(studioDialog.getByRole('button', { name: /Back to/ })).toHaveCount(0);
    const studioBounds = await studioDialog.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    });
    expect(studioBounds.x).toBeLessThan(2);
    expect(studioBounds.y).toBeLessThan(2);
    expect(Math.abs(studioBounds.width - 1280)).toBeLessThan(2);
    expect(Math.abs(studioBounds.height - 720)).toBeLessThan(2);
    const artifactEditor = studioDialog.locator('[data-artifact-edit-workspace]');
    await expect(artifactEditor).toBeVisible();
    await expect(page.getByRole('dialog', { name: /^Edit:/ })).toHaveCount(0);
    const artifactEditStage = artifactEditor.locator('[data-artifact-edit-stage]');
    await expect(artifactEditStage).toHaveAttribute('data-auto-fit', 'true');
    await expect.poll(() => artifactEditStage.evaluate((node) => ({
      horizontal: node.scrollWidth - node.clientWidth,
      vertical: node.scrollHeight - node.clientHeight,
    }))).toEqual({ horizontal: 0, vertical: 0 });
    const artifactEditOverflow = await artifactEditStage.evaluate((node) => window.getComputedStyle(node).overflow);
    expect(artifactEditOverflow).toBe('hidden');
    await expect(artifactEditor.getByRole('complementary', { name: 'Artifact fields' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 2)).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await artifactEditor.getByRole('button', { name: 'Fit', exact: true }).click();
    await expect.poll(() => artifactEditStage.evaluate((node) => ({
      horizontal: node.scrollWidth - node.clientWidth,
      vertical: node.scrollHeight - node.clientHeight,
    }))).toEqual({ horizontal: 0, vertical: 0 });
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 2)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Design Artifacts' })).toHaveCount(0);
    await expect(stage).toHaveAttribute('data-artifact-focus-exclusive', 'true');
    await page.getByRole('button', { name: 'Back to Set' }).click();
    await expect(page.getByText('10 shown', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Desk' }).click();
    await expect(page.getByRole('heading', { name: 'Your creative workspace' })).toBeVisible();
    await page.getByRole('button', { name: 'Show back of Mixed Template Review Set' }).click();
    await expect(page.locator('[data-home-set-stack][data-card-face="back"]')).toBeVisible();
    await page.getByRole('link', { name: 'Library' }).first().click();
    await page.getByRole('button', { name: 'Show back of Mixed Template Review Set' }).click();
    await expect(page.locator('[data-card-face="back"]')).toBeVisible();
    await expectNoWcagViolations(page);
  });

  test('translates retired pseudo-surfaces and Studio destination links', async ({ page }) => {
    await page.goto('/account?section=storage', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
    await expect(page.getByRole('heading', { name: 'Locations & connections' })).toBeVisible();

    await page.goto('/account?section=billing', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
    await expect(page.getByRole('heading', { name: 'Manage access, billing, and usage' })).toBeVisible();

    await page.goto('/studio', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole('heading', { name: 'Your creative workspace' })).toBeVisible();
    await expect(page.locator('[data-studio-ready]')).toHaveCount(0);
  });

  test('keeps contribution work inside the responsive Library environment', async ({ page }) => {
    await page.goto('/account?section=library&scope=pipeline', { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });

    await expect(page.getByRole('heading', { name: 'Your materials and work' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Library scopes' })).toBeVisible();
    await expect(page.getByText('Contributor', { exact: true })).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('navigation', { name: 'CardForge zones' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Library scopes' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expectNoWcagViolations(page);
  });

  test('retired account and program routes are cold-cut to 404', async ({ page }) => {
    for (const route of ['/developer', '/developer/cockpit', '/developer-terms', '/profile', '/environment-lab', '/creator-pool']) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT });
      expect(response?.status(), route).toBe(404);
    }
  });
});
