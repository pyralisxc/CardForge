import { devices, expect, test } from '@playwright/test';

import { openScaleSet, seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';
import { createProjectScaleFixture } from '../../fixtures/projectScale';

const pixel7 = devices['Pixel 7'];
const pixel7Context = {
  userAgent: pixel7.userAgent,
  viewport: pixel7.viewport,
  deviceScaleFactor: pixel7.deviceScaleFactor,
  isMobile: pixel7.isMobile,
  hasTouch: pixel7.hasTouch,
};

for (const mobile of [false, true]) {
  test.describe(`Desk tool context on ${mobile ? 'mobile' : 'desktop'}`, () => {
    test.use(mobile ? pixel7Context : { viewport: { width: 1440, height: 900 } });

    test('@golden creates, designs, generates, edits and reopens a fresh Set without seeded cards', async ({ page }, testInfo) => {
      test.setTimeout(180_000);
      page.setDefaultTimeout(15_000);
      if (!mobile) await page.setViewportSize({ width: 1180, height: 757 });
      await seedGuestScaleWorkspace(page, 100, { emptyDesk: true, exportSample: true, publicTemplate: true, unreadableFolderIndex: !mobile });
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-desk-arrival-phase="ready"]')).toBeVisible();
      await expect(page.locator('[data-set-object]')).toHaveCount(0);
      await page.getByRole('button', { name: 'Create your first Set', exact: true }).click();
      await page.getByRole('button', { name: 'Fresh Set', exact: true }).click();
      await page.getByRole('textbox', { name: 'Set name', exact: true }).fill('Creator loop Set');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByText('This Set is ready for its first card', { exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Design', exact: true }).click();
      const design = page.getByRole('region', { name: 'Design', exact: true });
      await expect(design.getByRole('region', { name: 'Template canvas', exact: true })).toBeVisible();
      if (mobile) await design.getByRole('button', { name: 'Open editor menu', exact: true }).click();
      await design.getByRole('button', { name: 'Card Setup', exact: true }).click();
      await design.getByRole('textbox', { name: 'Template name', exact: true }).fill('Creator loop Template');
      if (mobile) await design.getByRole('button', { name: 'Close library', exact: true }).click();
      await design.getByRole('button', { name: mobile ? 'Save a personal Template copy' : 'Save copy', exact: true }).click();
      // Saving forks the public source. The same tool must keep the saved
      // personal copy selected instead of replaying its original entry target.
      if (mobile) await expect(design.getByRole('toolbar', { name: 'Canvas controls' })).toContainText('Creator loop Template Variant');
      else await expect(design.getByRole('textbox', { name: 'Template name', exact: true })).toHaveValue('Creator loop Template Variant');
      const rail = page.locator('[data-desk-context-rail]');
      await rail.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(design).toHaveCount(0);
      await page.getByRole('button', { name: 'Design', exact: true }).click();
      if (mobile) await expect(design.getByRole('toolbar', { name: 'Canvas controls' })).toContainText('Creator loop Template Variant');
      else {
        await design.getByRole('button', { name: 'Card Setup', exact: true }).click();
        await expect(design.getByRole('textbox', { name: 'Template name', exact: true })).toHaveValue('Creator loop Template Variant');
      }
      await rail.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(design).toHaveCount(0);

      const openTool = async (name: 'Generate' | 'Output') => {
        if (mobile) {
          await rail.getByRole('button', { name: 'More Set actions', exact: true }).click();
          await page.getByRole('menuitem', { name, exact: true }).click();
        } else await rail.getByRole('button', { name, exact: true }).click();
      };
      await openTool('Generate');
      await expect(page.locator('#deck-front-template')).toContainText('Creator loop Template Variant');
      await page.getByRole('button', { name: 'Continue to card data', exact: true }).click();
      const artwork = new URL('/brand/cardforge-studio/brand-mark.svg', page.url()).href;
      const data = page.getByLabel('Add your card list', { exact: true });
      await data.fill(`cardName,artwork\nFirst card,${artwork}`);
      await expect(page.getByText('CardForge is ready to make 1 card.', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Add Cards to Set', exact: true }).click();
      await expect(page.getByText(/1 card added to Creator loop Set/)).toBeVisible();
      await page.getByRole('button', { name: 'Add another batch', exact: true }).click();
      await data.fill(`cardName,artwork\nSecond card,${artwork}\nThird card,${artwork}\nFourth card,${artwork}`);
      await expect(page.getByText('CardForge is ready to make 3 cards.', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Add Cards to Set', exact: true }).click();
      await expect(page.getByText(/3 cards added to Creator loop Set/)).toBeVisible();
      await page.getByRole('button', { name: 'View cards on Desk', exact: true }).click();
      await page.getByRole('button', { name: 'Clear Artifact selection', exact: true }).click();
      await expect(page.getByRole('toolbar', { name: 'Selection actions', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Clear all', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Ordered Artifact navigator · 4', exact: true })).toBeVisible();

      if (!mobile) {
        const sourceSummary = page.locator('summary').filter({ hasText: /^One work source needs attention$/ });
        const organize = page.getByRole('button', { name: 'Organize · 4 cards', exact: true });
        for (const width of [770, 390]) {
          await page.setViewportSize({ width, height: 757 });
          await expect(sourceSummary).toBeInViewport({ ratio: 1 });
          for (const expanded of [false, true]) {
            if (expanded) {
              await sourceSummary.click();
              await expect(page.getByText('The saved folder index is unreadable. Existing folder links were left unchanged.', { exact: true })).toBeVisible();
            }
            // Both source states reserve layout space, rather than covering the
            // focused Set's controls while the document itself still fits.
            const noticeBottom = await sourceSummary.evaluate((summary) => summary.closest('details')!.getBoundingClientRect().bottom);
            const control = await organize.boundingBox();
            expect(control!.y).toBeGreaterThanOrEqual(noticeBottom);
            await expect.poll(() => organize.evaluate((button) => {
              const rect = button.getBoundingClientRect();
              const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
              return target === button || button.contains(target);
            })).toBe(true);
            await testInfo.attach(`source-recovery-${width}-${expanded ? 'expanded' : 'collapsed'}`, {
              body: await page.screenshot(), contentType: 'image/png',
            });
          }
          await organize.click();
          await expect(page.getByRole('combobox', { name: 'Arrange cards', exact: true })).toBeVisible();
          await page.keyboard.press('Escape');
          await sourceSummary.click();
        }
        await page.setViewportSize({ width: 1180, height: 757 });
      }
      await page.getByRole('button', { name: 'Organize · 4 cards', exact: true }).click();
      await page.getByRole('combobox', { name: 'Arrange cards', exact: true }).click();
      await page.getByRole('option', { name: 'Arrange as grid', exact: true }).click();
      await page.getByRole('button', { name: 'Organize · 4 cards', exact: true }).click();
      await page.getByRole('button', { name: 'Fit Work', exact: true }).click();
      // The complete interactive tile, including title/subtitle, belongs inside
      // Fit Work. Camera controls must not cover any of that authored work.
      await expect.poll(() => page.locator('[data-desk-artifact-stage]').evaluate((stage) => {
        const bounds = stage.getBoundingClientRect();
        const controls = stage.parentElement!.querySelector('[data-set-view-controls]')!.getBoundingClientRect();
        return Array.from(stage.querySelectorAll<HTMLButtonElement>('button[data-artifact-id]')).flatMap((button) => {
          const rect = button.getBoundingClientRect();
          const tile = button.parentElement!.getBoundingClientRect();
          const inside = rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1
            && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1;
          const modeled = rect.right <= tile.right + 1 && rect.bottom <= tile.bottom + 1;
          const obscured = Math.min(rect.right, controls.right) > Math.max(rect.left, controls.left)
            && Math.min(rect.bottom, controls.bottom) > Math.max(rect.top, controls.top);
          return inside && modeled && !obscured ? [] : [button.getAttribute('aria-label')];
        });
      })).toEqual([]);

      const first = page.getByRole('button', { name: 'First card. Creator loop Template Variant', exact: true });
      await first.focus();
      await first.press('Enter');
      await rail.getByRole('button', { name: 'Edit', exact: true }).click();
      const editor = page.locator('[data-artifact-edit-workspace]');
      if (mobile) {
        await editor.getByRole('button', { name: 'More focused Artifact actions', exact: true }).click();
        await page.getByRole('menuitem', { name: 'All fields', exact: true }).click();
      } else await editor.getByRole('button', { name: 'All fields', exact: true }).click();
      await editor.getByRole('textbox', { name: /Card title|Card name/i }).first().fill('First card revised');
      await editor.getByRole('button', { name: 'Save & Done', exact: true }).click();
      await expect(editor).toHaveCount(0);
      await page.getByRole('button', { name: 'Back to Set', exact: true }).click();
      await openTool('Output');
      const output = page.getByRole('region', { name: 'Output Creator loop Set', exact: true });
      await expect(output).toBeVisible();
      await expect(output.getByRole('button', { name: /^Download PNG set/ })).toBeVisible();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(output).toBeVisible();
      await rail.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(output).toHaveCount(0);
      await expect(page).not.toHaveURL(/[?&]tool=output/);
      await expect(page.getByRole('button', { name: 'First card revised. Creator loop Template Variant', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ordered Artifact navigator · 4', exact: true })).toBeVisible();

      await openTool('Generate');
      await page.getByRole('button', { name: 'Continue to card data', exact: true }).click();
      await data.fill(`cardName,artwork\nUncommitted card,${artwork}`);
      await rail.getByRole('button', { name: 'Review & close', exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Close Generate', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Ordered Artifact navigator · 4', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Uncommitted card. Creator loop Template Variant', exact: true })).toHaveCount(0);
    });

    test('protects an edited card and opens Output without mounting another editor', async ({ page }) => {
      test.setTimeout(120_000);
      await seedGuestScaleWorkspace(page, 100);
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await openScaleSet(page, 100);
      const firstCard = page.getByRole('button', { name: 'Scale Card 0001. Scale Fixture Template', exact: true });
      await firstCard.click();
      await expect(firstCard).toHaveAttribute('aria-pressed', 'true');
      await firstCard.press('Enter');
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      const artwork = page.getByRole('textbox', { name: /Artwork \(Image URL or Upload\)/ });
      const original = await artwork.inputValue();
      await artwork.fill('https://example.com/draft.png');
      await page.getByRole('button', { name: 'Review & close', exact: true }).click();
      await expect(page.getByRole('alertdialog')).toContainText('unsaved changes');
      await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
      await expect(artwork).toHaveValue('https://example.com/draft.png');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(page.getByRole('alertdialog')).toContainText('Discard unsaved card changes');
      await page.keyboard.press('Escape');
      await expect(artwork).toHaveValue('https://example.com/draft.png');
      await page.getByRole('button', { name: 'Review & close', exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Close Edit card', exact: true }).click();
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(artwork).toHaveValue(original);
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.getByRole('button', { name: 'Back to Set', exact: true }).click();
      if (mobile) {
        await page.getByRole('button', { name: 'More Set actions', exact: true }).click();
        await expect(page.getByRole('menuitem', { name: 'Save & move', exact: true })).toBeVisible();
        await page.keyboard.press('Escape');
      } else await expect(page.getByRole('button', { name: 'Save & move', exact: true })).toBeVisible();
      if (mobile) {
        await page.getByRole('button', { name: 'More Set actions', exact: true }).click();
        await page.getByRole('menuitem', { name: 'Output', exact: true }).click();
      } else await page.getByRole('button', { name: 'Output', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Output 100 Card Scale Set', exact: true })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Template canvas', exact: true })).toHaveCount(0);
      await expect(artwork).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Remove all cards', exact: true })).toHaveCount(0);
    });

    test('@golden opens the Set template and back instead of stale tool selections', async ({ page }) => {
      test.setTimeout(120_000);
      await seedGuestScaleWorkspace(page, 100, { staleToolTemplate: true });
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await openScaleSet(page, 100);
      await page.getByRole('button', { name: 'Design', exact: true }).click();
      const design = page.getByRole('region', { name: 'Design', exact: true });
      await expect(design).toBeVisible();
      const spatialPlane = page.locator('[data-desk-plane]');
      await expect(spatialPlane).toBeVisible();
      await expect(spatialPlane).not.toHaveAttribute('data-scene-hidden', 'true');
      await expect(page.locator('[data-desk-tool-surface][data-scene-visible="true"]')).toBeVisible();
      if (mobile) await expect(design.getByRole('toolbar', { name: 'Canvas controls' })).toContainText('Scale Fixture Template');
      else {
        await page.getByRole('button', { name: 'Card Setup', exact: true }).click();
        await expect(page.getByLabel('Template name', { exact: true })).toHaveValue('Scale Fixture Template');
      }
      const rail = page.locator('[data-desk-context-rail][data-depth="tool"]');
      await rail.getByRole('button', { name: 'Done', exact: true }).click();

      if (mobile) {
        await page.getByRole('button', { name: 'More Set actions', exact: true }).click();
        await page.getByRole('menuitem', { name: 'Generate', exact: true }).click();
      } else await page.getByRole('button', { name: 'Generate', exact: true }).click();
      await expect(page.locator('#deck-front-template')).toContainText('Scale Fixture Template');
      await expect(page.locator('#deck-backing-template')).toContainText('Scale Fixture Back');
      await expect(page.getByRole('button', { name: 'Close Generate', exact: true, includeHidden: true })).toHaveCount(0);
      await rail.getByRole('button', { name: 'Done', exact: true }).focus();
      await expect(rail.getByRole('button', { name: 'Done', exact: true })).toBeFocused();

      await page.getByRole('button', { name: 'Edit selected back', exact: true }).click();
      await expect(design).toBeVisible();
      if (mobile) await expect(design.getByRole('toolbar', { name: 'Canvas controls' })).toContainText('Scale Fixture Back');
      else {
        await page.getByRole('button', { name: 'Card Setup', exact: true }).click();
        await expect(page.getByLabel('Template name', { exact: true })).toHaveValue('Scale Fixture Back');
      }
    });

    test('@golden keeps Artifact-scoped Design provisional until Save', async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      await seedGuestScaleWorkspace(page, 100, { staleToolTemplate: true });
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await openScaleSet(page, 100);
      await page.getByRole('button', { name: /^Templates ·/ }).click();
      const templateRow = page.getByRole('dialog', { name: 'Templates in this Set' });
      const frontTemplate = templateRow.getByRole('button', { name: 'Design Template Scale Fixture Template, used by 100 Artifacts', exact: true });
      const backTemplate = templateRow.getByRole('button', { name: 'Design back Template Scale Fixture Back, used by 100 Artifacts', exact: true });
      await expect(frontTemplate).toHaveCSS('border-top-style', 'solid');
      const frontAccent = await frontTemplate.evaluate((node) => getComputedStyle(node).borderTopColor);
      const backAccent = await backTemplate.evaluate((node) => getComputedStyle(node).borderTopColor);
      const visual = page.locator('[data-scene-slot="scale-card-1"][data-scene-slot-depth="board"][data-scene-inline-board="true"]');
      await expect(visual.locator('[data-artifact-template-border]')).toHaveCSS('border-top-style', 'dashed');
      await expect(visual.locator('[data-artifact-template-border]')).toHaveCSS('border-top-color', frontAccent);
      await expect(page.locator('[data-scene-depth="board"][data-scene-moving="true"]')).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath('set-template-identity.png') });
      await backTemplate.click();
      const templateStudio = page.getByRole('region', { name: 'Design', exact: true });
      if (mobile) await expect(templateStudio.getByRole('toolbar', { name: 'Canvas controls' })).toContainText('Scale Fixture Back');
      else {
        await templateStudio.getByRole('button', { name: 'Card Setup', exact: true }).click();
        await expect(page.getByLabel('Template name', { exact: true })).toHaveValue('Scale Fixture Back');
      }
      await page.locator('[data-desk-context-rail]').getByRole('button', { name: 'Done', exact: true }).click();

      const firstCard = page.locator('button[data-artifact-id="scale-card-1"]');
      if (mobile) {
        // Low-zoom touch acquisition is covered by spatial-gestures. This golden owns
        // Artifact-scoped tool context, so use the deterministic keyboard selection path.
        await firstCard.focus();
        await firstCard.press(' ');
      } else await firstCard.click();
      await expect(firstCard).toHaveAttribute('aria-pressed', 'true');
      await firstCard.focus();
      await firstCard.press('Enter');
      const rail = page.locator('[data-desk-context-rail]');
      await rail.getByRole('button', { name: 'Edit', exact: true }).click();
      const editor = page.locator('[data-artifact-edit-workspace]');
      const openAllFields = async () => {
        if (mobile) {
          await editor.getByRole('button', { name: 'More focused Artifact actions', exact: true }).click();
          await page.getByRole('menuitem', { name: 'All fields', exact: true }).click();
        } else await editor.getByRole('button', { name: 'All fields', exact: true }).click();
      };
      await openAllFields();
      const artwork = editor.getByRole('textbox', { name: /Artwork/ }).first();
      await artwork.fill('/brand/cardforge-studio/brand-mark.svg');
      await editor.getByRole('button', { name: 'Save & Design Template', exact: true }).first().click();
      const design = page.getByRole('region', { name: 'Design', exact: true });
      await expect(design).toBeVisible();
      const expectTemplate = async (name: string) => {
        if (mobile) await expect(design.getByRole('toolbar', { name: 'Canvas controls' })).toContainText(name);
        else {
          await design.getByRole('button', { name: 'Card Setup', exact: true }).click();
          await expect(page.getByLabel('Template name', { exact: true })).toHaveValue(name);
        }
      };
      await expectTemplate('Scale Fixture Template');
      await rail.getByRole('button', { name: 'Done', exact: true }).click();
      await rail.getByRole('button', { name: 'Edit', exact: true }).click();
      await openAllFields();
      await expect(artwork).toHaveValue('/brand/cardforge-studio/brand-mark.svg');
      await editor.getByRole('button', { name: 'Cancel', exact: true }).click();

      const focusedWorkspace = page.locator('[data-focused-artifact-workspace]');
      const focusedVisual = focusedWorkspace.locator('[data-scene-slot="scale-card-1"][data-scene-slot-depth="focus"][data-scene-inline-settled="focus"]');
      await focusedWorkspace.getByRole('button', { name: /^Show back of/ }).click();
      await expect(focusedVisual.locator('[data-artifact-template-border]')).toHaveCSS('border-top-color', backAccent);
      if (mobile) {
        await rail.getByRole('button', { name: 'More Artifact actions', exact: true }).click();
        await page.getByRole('menuitem', { name: 'Design Template', exact: true }).click();
      } else await rail.getByRole('button', { name: 'Design', exact: true }).click();
      await expectTemplate('Scale Fixture Back');
      await rail.getByRole('button', { name: 'Done', exact: true }).click();

      await page.getByRole('button', { name: 'Back to Set', exact: true }).click();
      if (mobile) {
        await expect(page.getByRole('button', { name: /^Templates ·/ })).toHaveCount(0);
        await page.getByRole('button', { name: 'Clear Artifact selection', exact: true }).click();
      }
      await page.getByRole('button', { name: /^Templates ·/ }).click();
      const reopenedTemplates = page.getByRole('dialog', { name: 'Templates in this Set' });
      await expect(reopenedTemplates.getByRole('button', { name: 'Design back Template Scale Fixture Back, used by 100 Artifacts', exact: true })).toBeVisible();
      await expect(reopenedTemplates.getByRole('button', { name: /Copy of Scale Fixture Back|Variant/ })).toHaveCount(0);
      await reopenedTemplates.press('Escape');

      const secondCard = page.locator('button[data-artifact-id="scale-card-2"]');
      await secondCard.click();
      await expect(secondCard).toHaveAttribute('aria-pressed', 'true');
      await secondCard.press('Enter');
      await rail.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(editor).toBeVisible();
      await expect(editor).not.toContainText('Copy of');
    });
  });
}

for (const unavailableSource of [false, true]) {
  test(`@golden recovers an absent deep-linked Set without opening another Set's tool${unavailableSource ? ' while retaining source failure' : ''}`, async ({ page }) => {
    await seedGuestScaleWorkspace(page, 100, { unreadableFolderIndex: unavailableSource });
    await page.goto('/account?focus=set%3Amissing-set&tool=generate', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-desk-arrival-phase="ready"]')).toBeVisible();
    await expect(page.locator('[data-set-object]')).toHaveCount(1);
    await expect(page.locator('#deck-front-template')).toHaveCount(0);
    await expect(page).toHaveURL(/\/account$/u);
    await expect(page.getByText(unavailableSource ? 'Requested work could not be opened' : 'Work not found in this workspace', { exact: true })).toBeVisible();
    if (unavailableSource) {
      await page.locator('summary').filter({ hasText: /^One work source needs attention$/u }).click();
      await expect(page.getByText('The saved folder index is unreadable. Existing folder links were left unchanged.', { exact: true })).toBeVisible();
    }
    await openScaleSet(page, 100);
    await expect(page.getByRole('button', { name: 'Ordered Artifact navigator · 100', exact: true })).toBeVisible();
  });
}

test('@golden waits for catalog Templates before opening a deep-linked Generate tool', async ({ page }) => {
  test.setTimeout(120_000);
  await seedGuestScaleWorkspace(page, 100, { staleToolTemplate: true, catalogToolTemplates: true });
  const front = createProjectScaleFixture(100).userTemplates[0]!;
  const back = { ...front, id: 'scale-back', name: 'Scale Fixture Back', templateUsage: 'back-preset' };
  let releaseCatalog!: () => void;
  let catalogRequested!: () => void;
  const catalogReady = new Promise<void>((resolve) => { releaseCatalog = resolve; });
  const requestStarted = new Promise<void>((resolve) => { catalogRequested = resolve; });
  await page.route('**/api/catalog/studio-bootstrap', async (route) => {
    catalogRequested();
    await catalogReady;
    await route.fulfill({ json: {
      templates: { defaults: [front, back], userTemplates: [] },
      styles: { styles: [] },
      studioDefaults: { defaultTemplateId: front.id },
    } });
  });
  await page.goto('/account?focus=set%3Ascale-set-100&tool=generate', { waitUntil: 'domcontentloaded' });
  await requestStarted;
  await expect(page.locator('#deck-front-template')).toHaveCount(0);
  releaseCatalog();
  await expect(page.locator('#deck-front-template')).toContainText('Scale Fixture Template', { timeout: 30_000 });
  await expect(page.locator('#deck-backing-template')).toContainText('Scale Fixture Back');
});

for (const mobile of [false, true]) {
  test.describe(`Selection scope hardening on ${mobile ? 'mobile' : 'desktop'}`, () => {
    test.use(mobile ? { viewport: devices['Pixel 7'].viewport, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });

    test('@golden exposes selection-scoped Edit without making Organize the action gateway', async ({ page }) => {
      test.setTimeout(120_000);
      await seedGuestScaleWorkspace(page, 100, { cardLimit: 3 });
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await openScaleSet(page, 100);

      const quickActionsTrigger = page.getByRole('button', { name: 'Quick actions', exact: true });
      await quickActionsTrigger.click();
      const quickActions = page.getByRole('dialog', { name: 'Desk quick actions' });
      await expect(quickActions.getByRole('region', { name: 'Touch quick actions' })).toBeVisible();
      await expect(quickActions.getByRole('region', { name: 'Desktop quick actions' })).toBeVisible();
      await quickActionsTrigger.click();
      await expect(quickActions).toBeHidden();

      if (mobile) {
        await page.getByRole('button', { name: /^Organize ·/ }).click();
        await page.getByRole('button', { name: 'Select shown', exact: true }).click();
        await page.keyboard.press('Escape');
      } else {
        await page.locator('button[data-artifact-id="scale-card-1"]').click();
        await page.locator('button[data-artifact-id="scale-card-2"]').click({ modifiers: ['Control'] });
      }

      const selectionActions = page.getByRole('toolbar', { name: 'Selection actions', exact: true });
      await expect(selectionActions).toBeVisible();
      await expect(selectionActions.getByRole('button', { name: 'Edit selected', exact: true })).toBeVisible();
      await expect(page.getByRole('dialog', { name: /Organize/i })).toHaveCount(0);
    });
  });
}

test('@golden refuses mixed-Template direct edits instead of guessing field compatibility', async ({ page }) => {
  test.setTimeout(120_000);
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 2, mixedTemplates: true });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await openScaleSet(page, 100);
  await page.locator('button[data-artifact-id="scale-card-1"]').click();
  await page.locator('button[data-artifact-id="scale-card-2"]').click({ modifiers: ['Control'] });

  const selectionActions = page.getByRole('toolbar', { name: 'Selection actions', exact: true });
  await selectionActions.getByRole('button', { name: 'Edit selected', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Edit 2 selected Artifacts', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Edit one design group at a time', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Update from data', exact: true })).toHaveCount(0);
});

test('@golden surfaces derived Needs Work and clears it after repairing required values', async ({ page }) => {
  test.setTimeout(120_000);
  await seedGuestScaleWorkspace(page, 100, { cardLimit: 2, needsWorkFixture: true });
  await page.goto('/account', { waitUntil: 'domcontentloaded' });
  await openScaleSet(page, 100);

  const needsWork = page.getByRole('button', { name: 'Needs work · 2', exact: true });
  await expect(needsWork).toBeVisible();
  await needsWork.click();
  const selectionActions = page.getByRole('toolbar', { name: 'Selection actions', exact: true });
  await expect(selectionActions).toContainText('2 Artifacts selected');
  await selectionActions.getByRole('button', { name: 'Edit selected', exact: true }).click();

  const editor = page.getByRole('region', { name: 'Edit 2 selected Artifacts', exact: true });
  await expect(editor).toBeVisible();
  await editor.getByLabel('Required Fixture', { exact: true }).fill('Ready');
  await editor.getByRole('button', { name: 'Apply to 2', exact: true }).click();
  await page.locator('[data-desk-context-rail][data-depth="tool"]').getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Needs work ·/ })).toHaveCount(0);
});
