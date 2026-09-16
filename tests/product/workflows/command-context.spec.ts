import { expect, test } from '@playwright/test';

import { openScaleSet, seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

test.describe('contextual commands', () => {
  test('@golden keeps focused Set work actionable through the command shortcut', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await seedGuestScaleWorkspace(page, 100);
    await page.goto('/account');
    await openScaleSet(page, 100);

    await page.keyboard.press('Control+k');
    const commands = page.getByRole('dialog', { name: 'Actions for this context' });
    await expect(commands).toBeVisible();
    await expect(commands.getByRole('button', { name: 'Open Set', exact: true })).toBeVisible();
    await expect(commands.getByText('No available action matches that search.')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('focused-set-commands.png') });
  });
});
