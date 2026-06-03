import { expect, test, type Page } from '@playwright/test';
import { createClerkClient } from '@clerk/backend';
import { setupClerkTestingToken, clerk, clerkSetup } from '@clerk/testing/playwright';
import { createClient } from '@supabase/supabase-js';

type ClerkUserSummary = {
  id: string;
  emailAddresses?: Array<{ emailAddress?: string }>;
};

type RoadmapResponseBody = {
  items?: Array<{ id: string; upVotes: number; downVotes: number; userVote: string | null }>;
};

type DeveloperProgramSettingsBody = Record<string, unknown> & {
  allowContributorSelfVoting?: boolean;
  monthlySubmissionLimit?: number;
  ownerVoteWeight?: number;
};

type DeveloperProgramSubmissionBody = {
  id: string;
  name: string;
  status: string;
  currentUserVote?: string | null;
  positiveVotes?: number;
  negativeVotes?: number;
  sourceUrl?: string | null;
};

type DeveloperProgramResponseBody = {
  program?: {
    settings?: DeveloperProgramSettingsBody;
    effectiveMonthlySubmissionLimit?: number;
    effectiveMonthlyPublishedRequirement?: number;
    profitShareEligible?: boolean;
    developerOwnerNote?: string | null;
    submissions?: DeveloperProgramSubmissionBody[];
    votingQueue?: DeveloperProgramSubmissionBody[];
    developerContributions?: Array<{
      developerId: string;
      submissionLimitOverride?: number | null;
      publishedRequirementOverride?: number | null;
      profitShareEligible?: boolean;
      ownerNote?: string | null;
    }>;
  };
};

let authSetupError: string | null = null;
const createdEmails: string[] = [];
const createdUserIds = new Set<string>();
const createdDeveloperSubmissionIds = new Set<string>();
const createdDeveloperUploadPaths = new Set<string>();
const DEVELOPER_ASSET_BUCKET = 'cardforge-developer-assets';

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
  await getClerkAdminClient().users.updateUserMetadata(userId, { privateMetadata });
}

function withoutCardForgeRole(privateMetadata: Record<string, unknown>) {
  const next = { ...privateMetadata };
  delete next.cardforgeAccess;
  delete next.cardforgeRole;
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

async function getDeveloperProgram(page: Page) {
  const response = await page.request.get('/api/developer-assets');
  await expect(response).toBeOK();
  return response.json() as Promise<DeveloperProgramResponseBody>;
}

async function updateDeveloperSettings(page: Page, settings: DeveloperProgramSettingsBody) {
  const response = await page.request.put('/api/developer-assets', {
    data: { settings },
  });
  await expect(response).toBeOK();
  return response.json() as Promise<DeveloperProgramResponseBody>;
}

async function updateDeveloperProfileRules(page: Page, developerId: string, profile: {
  status?: 'invited' | 'active' | 'inactive' | 'suspended';
  monthlySubmissionLimitOverride?: number | string | null;
  monthlyPublishedRequirementOverride?: number | string | null;
  profitShareEligible?: boolean;
  ownerNote?: string | null;
}) {
  const response = await page.request.patch('/api/developer-assets', {
    data: { developerId, profile },
  });
  await expect(response).toBeOK();
  return response.json() as Promise<DeveloperProgramResponseBody>;
}

function findDeveloperSubmission(body: DeveloperProgramResponseBody, name: string) {
  return body.program?.submissions?.find((submission) => submission.name === name);
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

async function removeRoadmapVotes(userId: string) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
    },
  });

  await supabase
    .from('cardforge_roadmap_votes')
    .delete()
    .eq('user_id', userId);
}

async function cleanupDeveloperSubmissions() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
    },
  });

  for (const submissionId of createdDeveloperSubmissionIds) {
    await supabase
      .from('cardforge_asset_registry')
      .delete()
      .eq('developer_submission_id', submissionId);
    await supabase
      .from('cardforge_developer_asset_votes')
      .delete()
      .eq('submission_id', submissionId);
    await supabase
      .from('cardforge_developer_asset_submissions')
      .delete()
      .eq('id', submissionId);
  }
}

async function cleanupDeveloperUploads() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || createdDeveloperUploadPaths.size === 0) return;

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
    },
  });

  await supabase
    .storage
    .from(DEVELOPER_ASSET_BUCKET)
    .remove([...createdDeveloperUploadPaths]);
}

async function cleanupCreatedUsers() {
  const clerkAdmin = process.env.CLERK_SECRET_KEY ? getClerkAdminClient() : null;

  await cleanupDeveloperSubmissions();
  await cleanupDeveloperUploads();

  for (const userId of createdUserIds) {
    await removeRoadmapVotes(userId);
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
        await removeRoadmapVotes(user.id);
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

test('reusable QA account matrix exposes the correct account, developer, and owner surfaces', async ({ page }) => {
  test.setTimeout(240_000);
  test.skip(Boolean(authSetupError), authSetupError ?? 'Unable to prepare Clerk testing token.');
  test.skip(!process.env.CLERK_SECRET_KEY, 'CLERK_SECRET_KEY is required for authenticated smoke tests.');
  test.skip(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required for authenticated smoke tests.');

  const qaAccounts = [
    {
      role: 'free',
      email: getReusableFreeEmail(),
      accountText: /Starter Library is active/i,
      developerHeading: /Join the community shaping the forge/i,
      developerText: /Help shape the shared CardForge library/i,
      studioText: /Free preview mode/i,
      entitlement: { accessMode: 'free' as const, canExportClean: false, isOwner: false },
    },
    {
      role: 'paid',
      email: getReusablePaidEmail(),
      accountText: /Clean export|Creator Pass Library/i,
      developerHeading: /Join the community shaping the forge/i,
      developerText: /Help shape the shared CardForge library/i,
      studioText: /Paid export entitlement active/i,
      entitlement: { accessMode: 'paid' as const, canExportClean: true, isOwner: false },
    },
    {
      role: 'developer',
      email: getReusableDevEmail(),
      accountText: /developer account can submit building blocks/i,
      developerHeading: /Shape the library behind the forge/i,
      developerText: /Developer Asset Hub/i,
      studioText: /Dev export entitlement active/i,
      entitlement: { accessMode: 'dev' as const, canExportClean: true, isOwner: false },
    },
    {
      role: 'owner',
      email: getReusableOwnerEmail(),
      accountText: /Owner access unlocks export, contributor command/i,
      developerHeading: /Shape the library behind the forge/i,
      developerText: /Developer Asset Hub/i,
      studioText: /Dev export entitlement active/i,
      entitlement: { accessMode: 'dev' as const, canExportClean: true, isOwner: true },
    },
  ];

  const missing = qaAccounts.filter((account) => !account.email).map((account) => account.role);
  test.skip(missing.length > 0 && !allowDisposableUsers(), `Set reusable QA emails for account matrix: ${missing.join(', ')}.`);

  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByRole('heading', { name: /Build cards faster/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Free demo seats/i)).toBeVisible();
  await expect(page.locator('header').getByRole('link', { name: /Open Studio/i })).toBeVisible();

  for (const account of qaAccounts) {
    const qaUser = await resolveQaUser(account.email);
    const originalPrivateMetadata = qaUser.reusable ? await getPrivateMetadata(qaUser.userId) : null;

    try {
      await signInWithClerkTestingToken(page, qaUser.email, '/account');
      await expectEntitlement(page, account.entitlement);
      await expect(page.getByRole('heading', { level: 1, name: /Forge|Your Forge/i })).toBeVisible({ timeout: 45_000 });
      await expect(page.locator('main')).toContainText(account.accountText);
      await expect(page.getByRole('link', { name: /Manage Account/i })).toBeVisible();

      await page.goto('/developer', { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await expect(page.getByRole('heading', { name: account.developerHeading })).toBeVisible({ timeout: 45_000 });
      await expect(page.getByText(account.developerText)).toBeVisible({ timeout: 45_000 });
      if (account.entitlement.accessMode === 'dev') {
        await expect(page.getByRole('tab', { name: 'Asset Hub', exact: true })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Standards', exact: true })).toBeVisible();
      } else {
        await expect(page.getByText(/private asset hub/i)).toBeVisible();
        await expect(page.getByText('Developer Asset Hub', { exact: true })).toHaveCount(0);
        const requestAccessLink = page.getByRole('link', { name: /Request developer access/i });
        await expect(requestAccessLink).toHaveAttribute('href', /^mailto:/);
        await expect(requestAccessLink).toHaveAttribute('href', /subject=CardForge%20developer%20program%20request/);
        await expect(requestAccessLink).toHaveAttribute('href', new RegExp(encodeURIComponent(qaUser.email)));
      }

      await page.goto('/studio', { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await expect(page.getByRole('heading', { name: /CardForge Studio/i })).toBeVisible({ timeout: 45_000 });
      await expect(page.getByText(account.studioText)).toBeVisible({ timeout: 45_000 });

      await page.goto('/owner', { waitUntil: 'domcontentloaded', timeout: 120_000 });
      if (account.entitlement.isOwner) {
        await expect(page.getByRole('heading', { name: /Run the forge like a product/i })).toBeVisible({ timeout: 45_000 });
        await expect(page.getByRole('tab', { name: /Site Copy/i })).toBeVisible();
      } else {
        await expect(page.getByRole('heading', { name: /Owner console unavailable/i })).toBeVisible({ timeout: 45_000 });
        await expect(page.locator('main')).toContainText(/Owner access is required|not authorized/i);
      }
    } finally {
      if (!qaUser.reusable && originalPrivateMetadata) {
        await setPrivateMetadata(qaUser.userId, originalPrivateMetadata);
      }
    }
  }
});

test('reusable free QA account can claim Founder Beta, vote, and open profile tools', async ({ page }) => {
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
    await removeRoadmapVotes(qaUser.userId);
    await removeFounderBetaClaim(qaUser.userId);

    await signInWithClerkTestingToken(page, qaUser.email, '/account');
    await expect(page.getByRole('heading', { name: /Forge: Starter Library/i })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(qaUser.email, { exact: true })).toBeVisible();
    await expect(page.getByText('Locked', { exact: true })).toBeVisible();

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
    await expect(page.getByRole('button', { name: 'Export active', exact: true })).toBeVisible({ timeout: 45_000 });

    const roadmapResponse = await page.request.get('/api/roadmap');
    await expect(roadmapResponse).toBeOK();
    const roadmapBody = await roadmapResponse.json() as RoadmapResponseBody;
    const roadmapItem = roadmapBody.items?.[0];
    expect(roadmapItem?.id).toBeTruthy();

    const upvoteResponse = await page.request.post('/api/roadmap/votes', {
      data: { itemId: roadmapItem!.id, vote: 'up' },
    });
    await expect(upvoteResponse).toBeOK();
    const upvoteBody = await upvoteResponse.json() as RoadmapResponseBody;
    const upvotedItem = upvoteBody.items?.find((item) => item.id === roadmapItem!.id);
    expect(upvotedItem?.userVote).toBe('up');
    expect(upvotedItem?.upVotes).toBeGreaterThanOrEqual(roadmapItem!.upVotes + 1);

    const downvoteResponse = await page.request.post('/api/roadmap/votes', {
      data: { itemId: roadmapItem!.id, vote: 'down' },
    });
    await expect(downvoteResponse).toBeOK();
    const downvoteBody = await downvoteResponse.json() as RoadmapResponseBody;
    const downvotedItem = downvoteBody.items?.find((item) => item.id === roadmapItem!.id);
    expect(downvotedItem?.userVote).toBe('down');
    expect(downvotedItem?.downVotes).toBeGreaterThanOrEqual(roadmapItem!.downVotes + 1);

    await page.goto('/profile', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(page.getByRole('heading', { name: /CardForge profile/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Compact account controls/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Open forge summary/i })).toBeVisible();
    await expect(page.locator('.cl-headerTitle')).toHaveCSS('color', 'rgb(255, 241, 199)', { timeout: 45_000 });
    await expect(page.locator('.cl-navbarButtonText__security')).toHaveCSS('color', 'rgb(203, 181, 139)');
    await clerk.loaded({ page });
    await page.waitForFunction(() => Boolean(window.Clerk?.user?.id), null, { timeout: 45_000 });
  } finally {
    await removeRoadmapVotes(qaUser.userId);
    await removeFounderBetaClaim(qaUser.userId);
    if (qaUser.reusable && originalPrivateMetadata) {
      await setPrivateMetadata(qaUser.userId, originalPrivateMetadata);
    }
  }
});

test('reusable owner QA account can submit and publish through the developer asset pipeline', async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(Boolean(authSetupError), authSetupError ?? 'Unable to prepare Clerk testing token.');
  test.skip(!process.env.CLERK_SECRET_KEY, 'CLERK_SECRET_KEY is required for authenticated smoke tests.');
  test.skip(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required for authenticated smoke tests.');
  const reusableOwnerEmail = getReusableOwnerEmail();
  test.skip(!reusableOwnerEmail && !allowDisposableUsers(), 'Set CARDFORGE_E2E_OWNER_EMAIL for reusable developer pipeline QA, or opt into disposable users with CARDFORGE_E2E_ALLOW_DISPOSABLE_USERS=true.');

  const qaUser = await resolveQaUser(reusableOwnerEmail);
  const originalPrivateMetadata = qaUser.reusable ? null : await getPrivateMetadata(qaUser.userId);
  if (!qaUser.reusable) {
    await setPrivateMetadata(qaUser.userId, {
      ...originalPrivateMetadata,
      cardforgeAccess: 'dev',
      cardforgeRole: 'owner',
    });
  }

  const uniqueSuffix = Date.now();

  try {
    await signInWithClerkTestingToken(page, qaUser.email, '/developer');
    await expect(page.getByText(/Developer tools are active/i)).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('heading', { name: /Shape the library behind the forge/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Asset Hub', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Asset Hub', exact: true }).click();
    await expect(page.getByText('Developer Asset Hub', { exact: true })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('tab', { name: 'Submit', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Review Queue', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'My Pipeline', exact: true })).toBeVisible();
    await expect(page.getByText(/Personal Library/i)).toBeVisible();
    await expect(page.getByText(/Drop a file or browse/i)).toBeVisible();

    const uiAssetName = `Smoke UI Asset Hub ${uniqueSuffix}`;
    await page.getByLabel('Asset family').selectOption('templates');
    await expect(page.getByText('Template JSON', { exact: true })).toBeVisible();
    await expect(page.locator('input[type="file"][accept*="application/json"]')).toHaveCount(1);
    await page.getByLabel('Asset family').selectOption('icons');
    await expect(page.getByText('Icon image', { exact: true })).toBeVisible();
    await expect(page.locator('input[type="file"][accept*="image/svg+xml"]')).toHaveCount(1);
    await page.getByLabel('Name').fill(uiAssetName);
    await page.getByLabel('Notes').fill('Smoke test SVG submitted through the visible developer Asset Hub.');
    await page.locator('input[type="file"][accept*=".svg"]').setInputFiles({
      name: `smoke-ui-icon-${uniqueSuffix}.svg`,
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#d5ad54" d="M32 4 40 24 60 32 40 40 32 60 24 40 4 32 24 24Z"/></svg>'),
    });
    await expect(page.getByText(new RegExp(`smoke-ui-icon-${uniqueSuffix}\\.svg`))).toBeVisible();

    const uiUploadResponsePromise = page.waitForResponse((response) => (
      response.url().includes('/api/developer-assets/upload')
      && response.request().method() === 'POST'
    ));
    const uiSubmitResponsePromise = page.waitForResponse((response) => (
      response.url().endsWith('/api/developer-assets')
      && response.request().method() === 'POST'
    ));
    await page.getByRole('button', { name: /Send to Forge Review/i }).click();
    const uiUploadResponse = await uiUploadResponsePromise;
    expect(uiUploadResponse.status()).toBe(201);
    const uiUploadBody = await uiUploadResponse.json() as { path?: string };
    if (uiUploadBody.path) createdDeveloperUploadPaths.add(uiUploadBody.path);
    const uiSubmitResponse = await uiSubmitResponsePromise;
    expect(uiSubmitResponse.status()).toBe(201);
    const uiSubmitBody = await uiSubmitResponse.json() as {
      program?: { submissions?: Array<{ id: string; name: string; status: string; sourceUrl: string | null }> };
    };
    const uiSubmittedAsset = uiSubmitBody.program?.submissions?.find((submission) => submission.name === uiAssetName);
    expect(uiSubmittedAsset).toMatchObject({
      name: uiAssetName,
      status: 'voting',
    });
    createdDeveloperSubmissionIds.add(uiSubmittedAsset!.id);

    await page.getByRole('tab', { name: 'My Pipeline', exact: true }).click();
    await expect(page.getByText(uiAssetName, { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('tab', { name: 'Review Queue', exact: true }).click();
    await expect(page.getByText(/All voteable assets live in one queue/i)).toBeVisible();
    await expect(page.getByLabel('Status')).toBeVisible();
    await expect(page.getByLabel('Tier')).toBeVisible();
    await expect(page.getByText(uiAssetName, { exact: true })).toBeVisible({ timeout: 30_000 });

    const uniqueAssetName = `Smoke Developer Pipeline ${uniqueSuffix}`;
    const submitResponse = await page.request.post('/api/developer-assets', {
      data: {
        assetType: 'icons',
        name: uniqueAssetName,
        description: 'Smoke test asset submitted through the developer pipeline.',
        previewUrl: 'https://example.test/cardforge-smoke-icon.svg',
        sourceUrl: 'https://example.test/cardforge-smoke-icon.svg',
        sourceFileSizeBytes: 2048,
        sourceMimeType: 'image/svg+xml',
        sourceStorageBucket: 'cardforge-smoke',
        sourceStoragePath: `smoke/${uniqueSuffix}.svg`,
      },
    });
    expect(submitResponse.status()).toBe(201);
    const submitBody = await submitResponse.json() as {
      program?: { submissions?: Array<{ id: string; name: string; status: string; sourceUrl: string | null }> };
    };
    const submittedAsset = submitBody.program?.submissions?.find((submission) => submission.name === uniqueAssetName);
    expect(submittedAsset).toMatchObject({
      name: uniqueAssetName,
      status: 'voting',
      sourceUrl: 'https://example.test/cardforge-smoke-icon.svg',
    });
    createdDeveloperSubmissionIds.add(submittedAsset!.id);

    const publishResponse = await page.request.put(`/api/developer-assets/${submittedAsset!.id}`, {
      data: {
        status: 'published',
        ownerNote: 'Smoke verified publish path.',
        ownerAccessTierOverride: 'free',
      },
    });
    await expect(publishResponse).toBeOK();
    const assetsResponse = await page.request.get('/api/assets');
    await expect(assetsResponse).toBeOK();
    const assetsBody = await assetsResponse.json() as {
      icons?: Array<{ name: string; librarySource?: string; registryStatus?: string; accessTier?: string }>;
    };
    expect(assetsBody.icons?.some((asset) => (
      asset.name === uniqueAssetName
      && asset.librarySource === 'developer'
      && asset.registryStatus === 'published'
      && asset.accessTier === 'free'
    ))).toBe(true);
  } finally {
    if (!qaUser.reusable && originalPrivateMetadata) {
      await setPrivateMetadata(qaUser.userId, originalPrivateMetadata);
    }
  }
});

test('reusable developer and owner QA accounts enforce voting rules, vote weight, and archive recovery', async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(Boolean(authSetupError), authSetupError ?? 'Unable to prepare Clerk testing token.');
  test.skip(!process.env.CLERK_SECRET_KEY, 'CLERK_SECRET_KEY is required for authenticated smoke tests.');
  test.skip(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required for authenticated smoke tests.');
  const reusableDevEmail = getReusableDevEmail();
  const reusableOwnerEmail = getReusableOwnerEmail();
  test.skip(!reusableDevEmail || !reusableOwnerEmail, 'Set CARDFORGE_E2E_DEV_EMAIL and CARDFORGE_E2E_OWNER_EMAIL for developer voting QA.');

  const devUser = await resolveQaUser(reusableDevEmail);
  const ownerUser = await resolveQaUser(reusableOwnerEmail);
  const originalOwnerMetadata = ownerUser.reusable ? null : await getPrivateMetadata(ownerUser.userId);
  const originalDevMetadata = devUser.reusable ? null : await getPrivateMetadata(devUser.userId);
  if (!ownerUser.reusable) {
    await setPrivateMetadata(ownerUser.userId, {
      ...originalOwnerMetadata,
      cardforgeAccess: 'dev',
      cardforgeRole: 'owner',
    });
  }
  if (!devUser.reusable) {
    await setPrivateMetadata(devUser.userId, {
      ...originalDevMetadata,
      cardforgeAccess: 'dev',
    });
  }

  let originalSettings: DeveloperProgramSettingsBody | null = null;
  let originalProfileRules: {
    monthlySubmissionLimitOverride?: number | string | null;
    monthlyPublishedRequirementOverride?: number | string | null;
    profitShareEligible?: boolean;
    ownerNote?: string | null;
  } | null = null;
  const uniqueSuffix = Date.now();
  const assetName = `Smoke Voting Rules ${uniqueSuffix}`;

  try {
    await signInWithClerkTestingToken(page, ownerUser.email, '/developer');
    const ownerProgram = await getDeveloperProgram(page);
    originalSettings = ownerProgram.program?.settings ?? null;
    expect(originalSettings).toBeTruthy();

    await updateDeveloperSettings(page, {
      ...originalSettings!,
      allowContributorSelfVoting: false,
      monthlySubmissionLimit: 100,
      ownerVoteWeight: 3,
    });

    await signInWithClerkTestingToken(page, devUser.email, '/developer');
    await getDeveloperProgram(page);
    await signInWithClerkTestingToken(page, ownerUser.email, '/developer');
    const ownerProgramWithProfiles = await getDeveloperProgram(page);
    const existingProfileRules = ownerProgramWithProfiles.program?.developerContributions?.find((contribution) => contribution.developerId === devUser.userId);
    originalProfileRules = {
      monthlySubmissionLimitOverride: existingProfileRules?.submissionLimitOverride ?? null,
      monthlyPublishedRequirementOverride: existingProfileRules?.publishedRequirementOverride ?? null,
      profitShareEligible: existingProfileRules?.profitShareEligible ?? true,
      ownerNote: existingProfileRules?.ownerNote ?? null,
    };
    await updateDeveloperProfileRules(page, devUser.userId, {
      monthlySubmissionLimitOverride: 100,
      monthlyPublishedRequirementOverride: 1,
      profitShareEligible: false,
      ownerNote: 'Smoke verified account-specific developer contract.',
    });

    await signInWithClerkTestingToken(page, devUser.email, '/developer');
    const devProgramWithOverride = await getDeveloperProgram(page);
    expect(devProgramWithOverride.program).toMatchObject({
      effectiveMonthlySubmissionLimit: 100,
      effectiveMonthlyPublishedRequirement: 1,
      profitShareEligible: false,
      developerOwnerNote: 'Smoke verified account-specific developer contract.',
    });

    const submitResponse = await page.request.post('/api/developer-assets', {
      data: {
        assetType: 'icons',
        name: assetName,
        description: 'Smoke test asset for contributor self-voting, owner vote weight, and archive recovery.',
        previewUrl: 'https://example.test/cardforge-smoke-vote-icon.svg',
        sourceUrl: 'https://example.test/cardforge-smoke-vote-icon.svg',
        sourceFileSizeBytes: 2048,
        sourceMimeType: 'image/svg+xml',
        sourceStorageBucket: 'cardforge-smoke',
        sourceStoragePath: `smoke/${uniqueSuffix}-vote.svg`,
      },
    });
    expect(submitResponse.status()).toBe(201);
    const submitBody = await submitResponse.json() as DeveloperProgramResponseBody;
    const submittedAsset = findDeveloperSubmission(submitBody, assetName);
    expect(submittedAsset).toMatchObject({
      name: assetName,
      status: 'voting',
    });
    createdDeveloperSubmissionIds.add(submittedAsset!.id);

    const blockedSelfVote = await page.request.post(`/api/developer-assets/${submittedAsset!.id}/vote`, {
      data: { voteValue: 'positive' },
    });
    expect(blockedSelfVote.status()).toBe(400);
    await expect(blockedSelfVote).not.toBeOK();
    expect(await blockedSelfVote.text()).toContain('Developers cannot vote on their own submissions.');

    await signInWithClerkTestingToken(page, ownerUser.email, '/developer');
    await updateDeveloperSettings(page, {
      ...originalSettings!,
      allowContributorSelfVoting: true,
      monthlySubmissionLimit: 100,
      ownerVoteWeight: 3,
    });

    await signInWithClerkTestingToken(page, devUser.email, '/developer');
    const allowedSelfVote = await page.request.post(`/api/developer-assets/${submittedAsset!.id}/vote`, {
      data: { voteValue: 'positive' },
    });
    await expect(allowedSelfVote).toBeOK();
    const allowedSelfVoteBody = await allowedSelfVote.json() as DeveloperProgramResponseBody;
    expect(findDeveloperSubmission(allowedSelfVoteBody, assetName)).toMatchObject({
      currentUserVote: 'positive',
      positiveVotes: 1,
    });

    await signInWithClerkTestingToken(page, ownerUser.email, '/developer');
    const weightedOwnerVote = await page.request.post(`/api/developer-assets/${submittedAsset!.id}/vote`, {
      data: { voteValue: 'positive' },
    });
    await expect(weightedOwnerVote).toBeOK();
    const weightedOwnerVoteBody = await weightedOwnerVote.json() as DeveloperProgramResponseBody;
    expect(findDeveloperSubmission(weightedOwnerVoteBody, assetName)).toMatchObject({
      currentUserVote: 'positive',
      positiveVotes: 4,
    });

    const archiveResponse = await page.request.put(`/api/developer-assets/${submittedAsset!.id}`, {
      data: {
        status: 'archived',
        ownerNote: 'Smoke verified archive path.',
      },
    });
    await expect(archiveResponse).toBeOK();
    const archiveBody = await archiveResponse.json() as DeveloperProgramResponseBody;
    expect(findDeveloperSubmission(archiveBody, assetName)).toMatchObject({
      status: 'archived',
    });

    const recoverResponse = await page.request.put(`/api/developer-assets/${submittedAsset!.id}`, {
      data: {
        status: 'voting',
        ownerNote: 'Smoke verified recovery path.',
      },
    });
    await expect(recoverResponse).toBeOK();
    const recoverBody = await recoverResponse.json() as DeveloperProgramResponseBody;
    expect(findDeveloperSubmission(recoverBody, assetName)).toMatchObject({
      status: 'voting',
      positiveVotes: 4,
    });

    await page.goto('/owner', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.getByRole('tab', { name: 'Contributor Program' }).click();
    await expect(page.getByText(assetName, { exact: true })).toBeVisible({ timeout: 45_000 });
    await page.getByRole('button', { name: `Archive ${assetName}` }).click();
    await expect(page.getByRole('button', { name: `Recover ${assetName} to review` })).toBeVisible({ timeout: 45_000 });
    await page.getByRole('button', { name: `Recover ${assetName} to review` }).click();
    await expect(page.getByRole('button', { name: `Archive ${assetName}` })).toBeVisible({ timeout: 45_000 });
  } finally {
    if (originalProfileRules) {
      try {
        await signInWithClerkTestingToken(page, ownerUser.email, '/developer');
        await updateDeveloperProfileRules(page, devUser.userId, originalProfileRules);
      } catch {
        // Keep teardown best-effort so a profile restore problem does not hide the smoke failure.
      }
    }
    if (originalSettings) {
      try {
        await signInWithClerkTestingToken(page, ownerUser.email, '/developer');
        await updateDeveloperSettings(page, originalSettings);
      } catch {
        // Keep teardown best-effort so a settings restore problem does not hide the smoke failure.
      }
    }
    if (!ownerUser.reusable && originalOwnerMetadata) {
      await setPrivateMetadata(ownerUser.userId, originalOwnerMetadata);
    }
    if (!devUser.reusable && originalDevMetadata) {
      await setPrivateMetadata(devUser.userId, originalDevMetadata);
    }
  }
});
