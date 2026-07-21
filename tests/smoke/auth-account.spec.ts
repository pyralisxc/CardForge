import { expect, test, type Page } from '@playwright/test';
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

const allowDisposableUsers = () => process.env.CARDFORGE_E2E_ALLOW_DISPOSABLE_USERS === 'true';
const getReusableFreeEmail = () => process.env.CARDFORGE_E2E_FREE_EMAIL?.trim();
const getReusablePaidEmail = () => process.env.CARDFORGE_E2E_PAID_EMAIL?.trim();
const getReusableDevEmail = () => process.env.CARDFORGE_E2E_DEV_EMAIL?.trim();
const getReusableOwnerEmail = () => process.env.CARDFORGE_E2E_OWNER_EMAIL?.trim();

async function expectEntitlement(page: Page, expected: {
  accessMode: 'free' | 'paid' | 'dev';
  canExportClean: boolean;
  isOwner: boolean;
}) {
  const response = await page.request.get('/api/account/entitlement');
  await expect(response).toBeOK();
  const body = await response.json() as {
    accessMode?: string;
    canExportClean?: boolean;
    ownerAccess?: { isOwner?: boolean };
  };
  expect(body).toMatchObject({
    accessMode: expected.accessMode,
    canExportClean: expected.canExportClean,
    ownerAccess: { isOwner: expected.isOwner },
  });
}

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

async function getReusableClerkUser(email: string) {
  const user = await findClerkUserByEmail(email);
  expect(user, `Reusable Clerk QA account not found for ${email}.`).toBeTruthy();
  return user!;
}

async function createDisposableClerkUser() {
  const uniqueSuffix = Date.now();
  const email = `cardforge+clerk_test_${uniqueSuffix}@example.com`;
  const password = `CardForge-${uniqueSuffix}!Qa9`;
  createdEmails.push(email);
  const createdUser = await getClerkAdminClient().users.createUser({
    emailAddress: [email],
    password,
    skipPasswordChecks: true,
    skipLegalChecks: true,
  });
  createdUserIds.add(createdUser.id);
  return { email, userId: createdUser.id };
}

async function resolveQaUser(email: string | undefined) {
  if (email) {
    const user = await getReusableClerkUser(email);
    return { email, userId: user.id, reusable: true };
  }

  const disposableUser = await createDisposableClerkUser();
  return { email: disposableUser.email, userId: disposableUser.userId, reusable: false };
}

async function getPrivateMetadata(userId: string) {
  const clerkAdmin = getClerkAdminClient();
  const user = await clerkAdmin.users.getUser(userId);
  return { ...(user.privateMetadata ?? {}) } as Record<string, unknown>;
}

async function setPrivateMetadata(userId: string, privateMetadata: Record<string, unknown>) {
  await getClerkAdminClient().users.replaceUserMetadata(userId, { privateMetadata });
}

function withoutCardForgeRole(privateMetadata: Record<string, unknown>) {
  const next = { ...privateMetadata };
  delete next.cardforgeAccess;
  delete next.cardforgeRole;
  delete next.cardforgeAccessExpiresAt;
  delete next.cardforgeFounderBetaClaimedAt;
  return next;
}

const isClerkNavigationChurn = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Execution context was destroyed')
    || message.includes('most likely because of a navigation')
    || message.includes('Target page, context or browser has been closed');
};

async function signInWithClerkTestingToken(page: Page, email: string, path: string) {
  await setupClerkTestingToken({ page });

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.context().clearCookies();
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.evaluate(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
      });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
      await clerk.loaded({ page });
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
      const activeEmail = await page.evaluate(() => (
        window.Clerk?.user?.primaryEmailAddress?.emailAddress
        ?? window.Clerk?.user?.emailAddresses?.[0]?.emailAddress
        ?? null
      )).catch(() => null);
      if (activeEmail === email) {
        await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        return;
      }
      if (activeEmail) {
        await clerk.signOut({ page }).catch(() => undefined);
        await page.waitForFunction(() => !window.Clerk?.user, null, { timeout: 10_000 }).catch(() => undefined);
      }
      await clerk.signIn({ page, emailAddress: email });
      await page.waitForFunction(() => Boolean(window.Clerk?.user?.id), null, { timeout: 45_000 });
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("You're already signed in")) {
        const activeEmail = await page.evaluate(() => (
          window.Clerk?.user?.primaryEmailAddress?.emailAddress
          ?? window.Clerk?.user?.emailAddresses?.[0]?.emailAddress
          ?? null
        )).catch(() => null);
        if (activeEmail === email) {
          await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
          return;
        }
      }
      if (isClerkNavigationChurn(error)) {
        const signedInAfterNavigation = await page
          .waitForFunction(() => Boolean(window.Clerk?.user?.id), null, { timeout: 8_000 })
          .then(() => true)
          .catch(() => false);
        if (signedInAfterNavigation) {
          await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 });
          return;
        }
      }
      if (!isClerkNavigationChurn(error) || attempt === 3) break;
      await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(500 * attempt);
    }
  }

  throw lastError;
}

async function removeFounderBetaClaim(userId: string) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
    },
  });

  const { error } = await supabase
    .from('cardforge_founder_beta_claims')
    .delete()
    .eq('clerk_user_id', userId);

  if (error) {
    throw new Error(`Unable to restore Founder Beta QA state: ${error.message}`);
  }
}

async function cleanupCreatedUsers() {
  const clerkAdmin = process.env.CLERK_SECRET_KEY ? getClerkAdminClient() : null;

  for (const userId of createdUserIds) {
    await removeFounderBetaClaim(userId);
    try {
      await clerkAdmin?.users.deleteUser(userId);
    } catch {
      // A failed disposable cleanup should not hide the actual smoke-test failure.
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
  if (process.env.CARDFORGE_E2E_REQUIRE_AUTH === 'true' && authSetupError) {
    throw new Error(`Authenticated smoke setup failed: ${authSetupError}`);
  }
});

test.afterAll(async () => {
  await cleanupCreatedUsers();
});

test('signed-out production auth follows the public sign-in route without Clerk bootstrap failures', async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(Boolean(authSetupError), authSetupError ?? 'Unable to prepare Clerk testing token.');
  test.skip(!process.env.CLERK_SECRET_KEY, 'CLERK_SECRET_KEY is required for authenticated smoke tests.');
  test.skip(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required for authenticated smoke tests.');

  const clerkBootstrapResponses: Array<{ url: string; status: number }> = [];
  const failedClerkBootstrapRequests: Array<{ url: string; status: number }> = [];
  const clerkConsoleErrors: string[] = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    const isBootstrapRequest = url.pathname.endsWith('/v1/client')
      || url.pathname.endsWith('/v1/environment');
    if (isBootstrapRequest) {
      const clerkResponse = { url: response.url(), status: response.status() };
      clerkBootstrapResponses.push(clerkResponse);
      if (response.status() >= 400) {
        failedClerkBootstrapRequests.push(clerkResponse);
      }
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && /clerk/i.test(message.text())) {
      clerkConsoleErrors.push(message.text());
    }
  });

  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  const publicHeader = page.locator('header');
  const signInLink = publicHeader.getByRole('link', { name: 'Sign in', exact: true });
  await expect(signInLink).toBeVisible({ timeout: 45_000 });
  await expect(signInLink).toHaveAttribute('href', '/sign-in');
  await expect(publicHeader).not.toContainText(/Connecting/i);

  await Promise.all([
    page.waitForURL(/\/sign-in(?:[/?#]|$)/, { timeout: 45_000 }),
    signInLink.click(),
  ]);
  await clerk.loaded({ page });
  await expect(page.locator([
    '.cl-socialButtonsBlockButton',
    'input[name="identifier"]',
    'input[type="email"]',
  ].join(', ')).first()).toBeEnabled({ timeout: 45_000 });
  await page.waitForTimeout(1_000);

  await test.info().attach('clerk-browser-diagnostics', {
    body: JSON.stringify({ clerkBootstrapResponses, failedClerkBootstrapRequests, clerkConsoleErrors }, null, 2),
    contentType: 'application/json',
  });
  expect(failedClerkBootstrapRequests).toEqual([]);
  expect(clerkConsoleErrors).toEqual([]);
});

test('reusable QA account matrix enforces entitlement, developer, and owner access', async ({ page }) => {
  test.setTimeout(240_000);
  test.skip(Boolean(authSetupError), authSetupError ?? 'Unable to prepare Clerk testing token.');
  test.skip(!process.env.CLERK_SECRET_KEY, 'CLERK_SECRET_KEY is required for authenticated smoke tests.');
  test.skip(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required for authenticated smoke tests.');

  const qaAccounts = [
    {
      role: 'free',
      email: getReusableFreeEmail(),
      entitlement: { accessMode: 'free' as const, canExportClean: false, isOwner: false },
      privateMetadata: {},
    },
    {
      role: 'paid',
      email: getReusablePaidEmail(),
      entitlement: { accessMode: 'paid' as const, canExportClean: true, isOwner: false },
      privateMetadata: { cardforgeAccess: 'paid' },
    },
    {
      role: 'developer',
      email: getReusableDevEmail(),
      entitlement: { accessMode: 'dev' as const, canExportClean: true, isOwner: false },
      privateMetadata: { cardforgeAccess: 'dev' },
    },
    {
      role: 'owner',
      email: getReusableOwnerEmail(),
      entitlement: { accessMode: 'dev' as const, canExportClean: true, isOwner: true },
      privateMetadata: { cardforgeAccess: 'dev', cardforgeRole: 'owner' },
    },
  ];

  const missing = qaAccounts.filter((account) => !account.email).map((account) => account.role);
  test.skip(missing.length > 0 && !allowDisposableUsers(), `Set reusable QA emails for account matrix: ${missing.join(', ')}.`);

  for (const account of qaAccounts) {
    const qaUser = await resolveQaUser(account.email);
    const originalPrivateMetadata = qaUser.reusable ? await getPrivateMetadata(qaUser.userId) : null;

    try {
      await setPrivateMetadata(qaUser.userId, {
        ...(account.role === 'free' ? withoutCardForgeRole(originalPrivateMetadata ?? {}) : originalPrivateMetadata),
        ...account.privateMetadata,
      });
      await signInWithClerkTestingToken(page, qaUser.email, '/account');
      await expectEntitlement(page, account.entitlement);

      const developerResponse = await page.request.get('/api/developer-assets');
      expect(developerResponse.status()).toBe(account.entitlement.accessMode === 'dev' ? 200 : 403);

      const ownerResponse = await page.request.get('/api/owner/console');
      expect(ownerResponse.status()).toBe(account.entitlement.isOwner ? 200 : 403);
    } finally {
      if (originalPrivateMetadata) {
        await setPrivateMetadata(qaUser.userId, originalPrivateMetadata);
      }
    }
  }
});

test('reusable free QA account can claim Founder Beta access', async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(Boolean(authSetupError), authSetupError ?? 'Unable to prepare Clerk testing token.');
  test.skip(!process.env.CLERK_SECRET_KEY, 'CLERK_SECRET_KEY is required for authenticated smoke tests.');
  test.skip(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required for authenticated smoke tests.');
  const reusableFreeEmail = getReusableFreeEmail();
  test.skip(!reusableFreeEmail && !allowDisposableUsers(), 'Set CARDFORGE_E2E_FREE_EMAIL for reusable QA, or opt into disposable users with CARDFORGE_E2E_ALLOW_DISPOSABLE_USERS=true.');

  const qaUser = await resolveQaUser(reusableFreeEmail);
  const originalPrivateMetadata = qaUser.reusable ? await getPrivateMetadata(qaUser.userId) : null;

  try {
    if (qaUser.reusable) {
      await setPrivateMetadata(qaUser.userId, withoutCardForgeRole(originalPrivateMetadata!));
    }
    await removeFounderBetaClaim(qaUser.userId);

    await signInWithClerkTestingToken(page, qaUser.email, '/account');
    await expectEntitlement(page, { accessMode: 'free', canExportClean: false, isOwner: false });

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
    await expectEntitlement(page, { accessMode: 'paid', canExportClean: true, isOwner: false });
  } finally {
    await removeFounderBetaClaim(qaUser.userId);
    if (qaUser.reusable && originalPrivateMetadata) {
      await setPrivateMetadata(qaUser.userId, originalPrivateMetadata);
    }
  }
});
