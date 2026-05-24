import { expect, test } from '@playwright/test';
import { createClerkClient } from '@clerk/backend';
import { setupClerkTestingToken, clerk, clerkSetup } from '@clerk/testing/playwright';
import { createClient } from '@supabase/supabase-js';

type ClerkUserSummary = {
  id: string;
  emailAddresses?: Array<{ emailAddress?: string }>;
};

let authSetupError: string | null = null;
const createdEmails: string[] = [];
const createdUserIds = new Set<string>();

async function setupAuthTestEnvironment() {
  try {
    await clerkSetup({ dotenv: true });
  } catch (error) {
    authSetupError = error instanceof Error ? error.message : 'Unable to prepare Clerk testing token.';
  }
}

function getClerkAdminClient() {
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY is required for authenticated smoke cleanup.');
  }
  return createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
}

async function findClerkUserByEmail(email: string) {
  const clerkAdmin = getClerkAdminClient();
  const response = await clerkAdmin.users.getUserList({ emailAddress: [email], limit: 1 });
  return (response.data[0] ?? null) as ClerkUserSummary | null;
}

async function removeFounderBetaClaim(userId: string) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
    },
  });

  await supabase
    .from('cardforge_founder_beta_claims')
    .delete()
    .eq('clerk_user_id', userId);
}

async function cleanupCreatedUsers() {
  const clerkAdmin = process.env.CLERK_SECRET_KEY ? getClerkAdminClient() : null;

  for (const userId of createdUserIds) {
    await removeFounderBetaClaim(userId);
    try {
      await clerkAdmin?.users.deleteUser(userId);
    } catch {
      // The test also exercises self-delete, so a missing user is expected after that path.
    }
  }

  for (const email of createdEmails) {
    try {
      const user = await findClerkUserByEmail(email);
      if (user) {
        await removeFounderBetaClaim(user.id);
        await clerkAdmin?.users.deleteUser(user.id);
      }
    } catch {
      // Keep teardown best-effort so failed cleanup does not hide the actual auth failure.
    }
  }
}

test.beforeAll(async () => {
  await setupAuthTestEnvironment();
});

test.afterAll(async () => {
  await cleanupCreatedUsers();
});

test('creates a free Clerk profile, claims Founder Beta, and supports profile deletion', async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(Boolean(authSetupError), authSetupError ?? 'Unable to prepare Clerk testing token.');
  test.skip(!process.env.CLERK_SECRET_KEY, 'CLERK_SECRET_KEY is required for authenticated smoke tests.');
  test.skip(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required for authenticated smoke tests.');

  const uniqueSuffix = Date.now();
  const email = `cardforge+clerk_test_${uniqueSuffix}@example.com`;
  const password = `CardForge-${uniqueSuffix}!Qa9`;
  createdEmails.push(email);

  await setupClerkTestingToken({ page });
  await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await clerk.loaded({ page });

  await expect(page.getByRole('heading', { name: /Your forge is ready/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Create your account/i })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  const codeInput = page.getByRole('textbox', { name: 'Enter verification code', exact: true });
  await expect(codeInput).toBeVisible({ timeout: 30_000 });
  await codeInput.fill('424242');
  await page.keyboard.press('Enter');

  await page.waitForFunction(() => Boolean(window.Clerk?.user?.id), null, { timeout: 45_000 });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByRole('heading', { name: /Your Forge: Starter Library/i })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await expect(page.getByText('Locked', { exact: true })).toBeVisible();

  const user = await findClerkUserByEmail(email);
  expect(user?.id).toBeTruthy();
  createdUserIds.add(user!.id);

  await expect(page.getByRole('button', { name: /Claim Founder Beta/i })).toBeVisible({ timeout: 30_000 });
  const claimResponsePromise = page.waitForResponse((response) => response.url().includes('/api/founder-beta/claim'));
  await page.getByRole('button', { name: /Claim Founder Beta/i }).click();
  const claimResponse = await claimResponsePromise;
  expect(claimResponse.ok()).toBe(true);
  const claimBody = await claimResponse.json() as { entitlement?: { accessMode?: string; canExportClean?: boolean } };
  expect(claimBody.entitlement).toMatchObject({
    accessMode: 'paid',
    canExportClean: true,
  });
  await expect(page.getByText(/Export active/i)).toBeVisible({ timeout: 45_000 });

  await page.goto('/profile', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByRole('heading', { name: /Manage your forge identity/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Keep your sign-in methods/i)).toBeVisible();
  await clerk.loaded({ page });
  await page.waitForFunction(() => Boolean(window.Clerk?.user?.id), null, { timeout: 45_000 });

  await page.evaluate(async () => {
    const clerkInstance = window.Clerk;
    if (!clerkInstance?.user) throw new Error('No Clerk user is active.');
    await clerkInstance.user.delete();
  });
  await page.waitForFunction(() => window.Clerk?.user === null, null, { timeout: 30_000 });

  await removeFounderBetaClaim(user!.id);
  createdUserIds.delete(user!.id);
  await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByRole('button', { name: 'Sign in for export', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(email, { exact: true })).toHaveCount(0);
});
