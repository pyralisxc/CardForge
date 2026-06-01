import { expect, test, type Page } from '@playwright/test';
import { clerk, clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { promises as fs } from 'fs';
import path from 'path';

const STUDIO_READY_TIMEOUT = 120_000;
const DOWNLOAD_DIR = path.join(process.cwd(), '.tmp-paid-project-import');

let authSetupError: string | null = null;

test.beforeAll(async () => {
  try {
    await clerkSetup({ dotenv: true });
  } catch (error) {
    authSetupError = error instanceof Error ? error.message : 'Unable to prepare Clerk testing token.';
  }
});

test.afterEach(async () => {
  await fs.rm(DOWNLOAD_DIR, { recursive: true, force: true });
});

async function signInWithClerkTestingToken(page: Page, email: string, targetPath: string) {
  await setupClerkTestingToken({ page });
  await page.context().clearCookies();
  await page.goto(targetPath, { waitUntil: 'domcontentloaded', timeout: STUDIO_READY_TIMEOUT });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: STUDIO_READY_TIMEOUT });
  await clerk.loaded({ page });

  const activeEmail = await page.evaluate(() => (
    window.Clerk?.user?.primaryEmailAddress?.emailAddress
    ?? window.Clerk?.user?.emailAddresses?.[0]?.emailAddress
    ?? null
  )).catch(() => null);

  if (activeEmail && activeEmail !== email) {
    await clerk.signOut({ page }).catch(() => undefined);
    await page.waitForFunction(() => !window.Clerk?.user, null, { timeout: 10_000 }).catch(() => undefined);
  }

  if (activeEmail !== email) {
    await clerk.signIn({ page, emailAddress: email });
    await page.waitForFunction(() => Boolean(window.Clerk?.user?.id), null, { timeout: 45_000 });
  }

  await page.goto(targetPath, { waitUntil: 'domcontentloaded', timeout: STUDIO_READY_TIMEOUT });
}

test('paid account can export an edited shipped template and import it after local storage clears', async ({ page }) => {
  test.setTimeout(240_000);
  test.skip(Boolean(authSetupError), authSetupError ?? 'Unable to prepare Clerk testing token.');
  test.skip(!process.env.CLERK_SECRET_KEY, 'CLERK_SECRET_KEY is required for authenticated smoke tests.');
  test.skip(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required for authenticated smoke tests.');
  test.skip(!process.env.CARDFORGE_E2E_PAID_EMAIL, 'CARDFORGE_E2E_PAID_EMAIL is required for paid project import smoke tests.');

  await fs.rm(DOWNLOAD_DIR, { recursive: true, force: true });
  await fs.mkdir(DOWNLOAD_DIR, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInWithClerkTestingToken(page, process.env.CARDFORGE_E2E_PAID_EMAIL!, '/studio');

  const entitlementResponse = await page.request.get('/api/account/entitlement');
  await expect(entitlementResponse).toBeOK();
  await expect(await entitlementResponse.json()).toMatchObject({
    accessMode: 'paid',
    canExportClean: true,
  });

  await page.getByTestId('studio-ready').waitFor({ state: 'visible', timeout: STUDIO_READY_TIMEOUT });
  await page.getByRole('tab', { name: /Layout Studio/i }).click();
  await page.getByRole('tab', { name: 'Template', exact: true }).click();
  const templateName = `Paid Project Import ${Date.now()}`;
  await page.getByLabel('Template Name').fill(templateName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Template Saved', { exact: true })).toBeVisible({ timeout: 30_000 });

  const savedStorage = JSON.parse(await page.evaluate(() => window.localStorage.getItem('card-forge-app-storage-v3')) ?? '{}') as {
    state?: { userTemplates?: Array<{ name?: string; templateSource?: string; templateLibrarySource?: string }> };
  };
  expect(savedStorage.state?.userTemplates).toEqual(expect.arrayContaining([
    expect.objectContaining({
      name: templateName,
      templateSource: 'user',
      templateLibrarySource: 'personal',
    }),
  ]));

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.getByRole('button', { name: /Export Project/i }).click(),
  ]);
  const exportPath = path.join(DOWNLOAD_DIR, download.suggestedFilename());
  await download.saveAs(exportPath);
  const exportedProject = JSON.parse(await fs.readFile(exportPath, 'utf8')) as {
    userTemplates?: Array<{ name?: string; templateSource?: string; templateLibrarySource?: string }>;
  };
  expect(exportedProject.userTemplates).toEqual(expect.arrayContaining([
    expect.objectContaining({
      name: templateName,
      templateSource: 'user',
      templateLibrarySource: 'personal',
    }),
  ]));

  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: STUDIO_READY_TIMEOUT });
  await page.getByTestId('studio-ready').waitFor({ state: 'visible', timeout: STUDIO_READY_TIMEOUT });
  await page.getByRole('tab', { name: /Layout Studio/i }).click();
  await expect(page.getByLabel('Choose template')).not.toContainText(templateName);

  await page.locator('input[type="file"][accept*="json"]').setInputFiles(exportPath);
  await expect(page.getByText('Project Imported', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('1 template imported. No generated outputs were included in this file.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel('Choose template')).toContainText(`Personal / ${templateName}`, { timeout: 30_000 });

  const importedStorage = JSON.parse(await page.evaluate(() => window.localStorage.getItem('card-forge-app-storage-v3')) ?? '{}') as {
    state?: { userTemplates?: Array<{ name?: string; templateSource?: string; templateLibrarySource?: string }> };
  };
  expect(importedStorage.state?.userTemplates).toEqual(expect.arrayContaining([
    expect.objectContaining({
      name: templateName,
      templateSource: 'user',
      templateLibrarySource: 'personal',
    }),
  ]));

  await page.reload({ waitUntil: 'domcontentloaded', timeout: STUDIO_READY_TIMEOUT });
  await page.getByTestId('studio-ready').waitFor({ state: 'visible', timeout: STUDIO_READY_TIMEOUT });
  await page.getByRole('tab', { name: /Layout Studio/i }).click();
  await expect(page.getByLabel('Choose template')).toContainText(`Personal / ${templateName}`, { timeout: 30_000 });
});
