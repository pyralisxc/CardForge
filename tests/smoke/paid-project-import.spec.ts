import { expect, test, type Page, type Response } from '@playwright/test';
import { clerk, clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { promises as fs } from 'fs';
import path from 'path';

const STUDIO_READY_TIMEOUT = 120_000;
const DOWNLOAD_DIR = path.join(process.cwd(), '.tmp-paid-project-import');

let authSetupError: string | null = null;

async function readWorkspaceStorage(page: Page): Promise<string | null> {
  return page.evaluate(() => new Promise<string | null>((resolve, reject) => {
    const request = indexedDB.open('cardforge-browser-storage', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('key-value')) {
        database.close();
        resolve(null);
        return;
      }
      let workspaceValue: string | null = null;
      const transaction = database.transaction('key-value', 'readonly');
      const getRequest = transaction.objectStore('key-value').get('project-workspace:workspace');
      getRequest.onsuccess = () => {
        workspaceValue = typeof getRequest.result === 'string' ? getRequest.result : null;
      };
      getRequest.onerror = () => reject(getRequest.error);
      transaction.oncomplete = () => {
        database.close();
        resolve(workspaceValue);
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error);
      };
    };
  }));
}

async function clearCardForgeBrowserStorage(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('cardforge-browser-storage');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('CardForge browser storage is still open.'));
  }));
}

test.beforeAll(async () => {
  try {
    await clerkSetup({ dotenv: true });
  } catch (error) {
    authSetupError = error instanceof Error ? error.message : 'Unable to prepare Clerk testing token.';
  }
  if (process.env.CARDFORGE_E2E_REQUIRE_AUTH === 'true' && authSetupError) {
    throw new Error(`Authenticated smoke setup failed: ${authSetupError}`);
  }
});

test.afterEach(async () => {
  await fs.rm(DOWNLOAD_DIR, { recursive: true, force: true });
});

async function signInWithClerkTestingToken(page: Page, email: string, targetPath: string): Promise<Response> {
  await setupClerkTestingToken({ page });
  await page.context().clearCookies();
  await page.goto('/privacy', { waitUntil: 'domcontentloaded', timeout: STUDIO_READY_TIMEOUT });
  await page.evaluate(() => window.sessionStorage.clear());
  await page.goto('/studio', { waitUntil: 'domcontentloaded', timeout: STUDIO_READY_TIMEOUT });
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

  const entitlementResponsePromise = page.waitForResponse((response) => (
    new URL(response.url()).pathname === '/api/account/entitlement'
    && response.request().method() === 'GET'
  ), { timeout: STUDIO_READY_TIMEOUT });
  await page.goto(targetPath, { waitUntil: 'domcontentloaded', timeout: STUDIO_READY_TIMEOUT });
  return entitlementResponsePromise;
}

test('paid account can export an edited shipped template and import it after browser storage clears', async ({ page }) => {
  test.setTimeout(240_000);
  test.skip(Boolean(authSetupError), authSetupError ?? 'Unable to prepare Clerk testing token.');
  test.skip(!process.env.CLERK_SECRET_KEY, 'CLERK_SECRET_KEY is required for authenticated smoke tests.');
  test.skip(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required for authenticated smoke tests.');
  test.skip(!process.env.CARDFORGE_E2E_PAID_EMAIL, 'CARDFORGE_E2E_PAID_EMAIL is required for paid project import smoke tests.');

  await fs.rm(DOWNLOAD_DIR, { recursive: true, force: true });
  await fs.mkdir(DOWNLOAD_DIR, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  const entitlementResponse = await signInWithClerkTestingToken(
    page,
    process.env.CARDFORGE_E2E_PAID_EMAIL!,
    '/studio',
  );

  expect(entitlementResponse.ok()).toBe(true);
  await expect(await entitlementResponse.json()).toMatchObject({
    accessMode: 'paid',
    canExportClean: true,
  });

  await page.getByTestId('studio-ready').waitFor({ state: 'visible', timeout: STUDIO_READY_TIMEOUT });
  await page.getByRole('tab', { name: /Layout Studio/i }).click();
  await expect(page.getByRole('button', { name: 'Buy Creator Pass', exact: true })).toHaveCount(0, {
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Card setup', exact: true }).click();
  const templateName = `Paid Project Import ${Date.now()}`;
  await page.getByLabel('Template Name').fill(templateName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect.poll(() => readWorkspaceStorage(page), { timeout: 10_000 }).not.toBeNull();
  const savedStorage = JSON.parse(await readWorkspaceStorage(page) ?? '{}') as {
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
    page.getByRole('button', { name: 'Download project', exact: true }).click(),
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

  const context = page.context();
  await page.close();
  const recoveryPage = await context.newPage();
  await setupClerkTestingToken({ page: recoveryPage });
  await recoveryPage.goto('/privacy', { waitUntil: 'domcontentloaded', timeout: STUDIO_READY_TIMEOUT });
  await recoveryPage.evaluate(() => window.sessionStorage.clear());
  await clearCardForgeBrowserStorage(recoveryPage);
  await recoveryPage.goto('/studio', { waitUntil: 'domcontentloaded', timeout: STUDIO_READY_TIMEOUT });
  await recoveryPage.getByTestId('studio-ready').waitFor({ state: 'visible', timeout: STUDIO_READY_TIMEOUT });
  await recoveryPage.getByRole('tab', { name: /Layout Studio/i }).click();
  await expect(recoveryPage.getByRole('button', { name: 'Buy Creator Pass', exact: true })).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect.poll(async () => {
    const storedWorkspace = await readWorkspaceStorage(recoveryPage);
    if (!storedWorkspace) return false;
    const parsedWorkspace = JSON.parse(storedWorkspace) as {
      state?: { userTemplates?: Array<{ name?: string }> };
    };
    return parsedWorkspace.state?.userTemplates?.some((template) => template.name === templateName) ?? false;
  }, { timeout: 10_000 }).toBe(false);

  await recoveryPage.locator('input[type="file"][accept*="json"]').setInputFiles(exportPath);
  const replaceProjectButton = recoveryPage.getByRole('button', { name: 'Replace Project' });
  await expect(replaceProjectButton).toBeVisible({ timeout: 30_000 });
  await replaceProjectButton.click();
  const importedDesignControl = recoveryPage.getByRole('combobox').filter({ hasText: templateName });
  await expect(importedDesignControl).toHaveCount(1, { timeout: 30_000 });

  await expect.poll(() => readWorkspaceStorage(recoveryPage), { timeout: 10_000 }).not.toBeNull();
  const importedStorage = JSON.parse(await readWorkspaceStorage(recoveryPage) ?? '{}') as {
    state?: { userTemplates?: Array<{ name?: string; templateSource?: string; templateLibrarySource?: string }> };
  };
  expect(importedStorage.state?.userTemplates).toEqual(expect.arrayContaining([
    expect.objectContaining({
      name: templateName,
      templateSource: 'user',
      templateLibrarySource: 'personal',
    }),
  ]));

  await recoveryPage.reload({ waitUntil: 'domcontentloaded', timeout: STUDIO_READY_TIMEOUT });
  await recoveryPage.getByTestId('studio-ready').waitFor({ state: 'visible', timeout: STUDIO_READY_TIMEOUT });
  await recoveryPage.getByRole('tab', { name: /Layout Studio/i }).click();
  await expect(importedDesignControl).toHaveCount(1, { timeout: 30_000 });
});
