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
const createdDeveloperSubmissionIds = new Set<string>();

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

async function cleanupCreatedUsers() {
  const clerkAdmin = process.env.CLERK_SECRET_KEY ? getClerkAdminClient() : null;

  await cleanupDeveloperSubmissions();

  for (const userId of createdUserIds) {
    await removeRoadmapVotes(userId);
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

test('creates a free Clerk profile, claims Founder Beta, and supports profile deletion', async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(Boolean(authSetupError), authSetupError ?? 'Unable to prepare Clerk testing token.');
  test.skip(!process.env.CLERK_SECRET_KEY, 'CLERK_SECRET_KEY is required for authenticated smoke tests.');
  test.skip(!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required for authenticated smoke tests.');

  const uniqueSuffix = Date.now();
  const email = `cardforge+clerk_test_${uniqueSuffix}@example.com`;
  const password = `CardForge-${uniqueSuffix}!Qa9`;
  createdEmails.push(email);
  const clerkAdmin = getClerkAdminClient();
  const createdUser = await clerkAdmin.users.createUser({
    emailAddress: [email],
    password,
    skipPasswordChecks: true,
    skipLegalChecks: true,
  });
  createdUserIds.add(createdUser.id);

  await setupClerkTestingToken({ page });
  await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await clerk.loaded({ page });
  await clerk.signIn({ page, emailAddress: email });

  await page.waitForFunction(() => Boolean(window.Clerk?.user?.id), null, { timeout: 45_000 });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByRole('heading', { name: /Forge: Starter Library/i })).toBeVisible({ timeout: 45_000 });
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
  await expect(page.getByRole('button', { name: 'Export active', exact: true })).toBeVisible({ timeout: 45_000 });

  const roadmapResponse = await page.request.get('/api/roadmap');
  await expect(roadmapResponse).toBeOK();
  const roadmapBody = await roadmapResponse.json() as {
    items?: Array<{ id: string; upVotes: number; downVotes: number; userVote: string | null }>;
  };
  const roadmapItem = roadmapBody.items?.[0];
  expect(roadmapItem?.id).toBeTruthy();

  const upvoteResponse = await page.request.post('/api/roadmap/votes', {
    data: { itemId: roadmapItem!.id, vote: 'up' },
  });
  await expect(upvoteResponse).toBeOK();
  const upvoteBody = await upvoteResponse.json() as typeof roadmapBody;
  const upvotedItem = upvoteBody.items?.find((item) => item.id === roadmapItem!.id);
  expect(upvotedItem?.userVote).toBe('up');
  expect(upvotedItem?.upVotes).toBeGreaterThanOrEqual(roadmapItem!.upVotes + 1);

  const downvoteResponse = await page.request.post('/api/roadmap/votes', {
    data: { itemId: roadmapItem!.id, vote: 'down' },
  });
  await expect(downvoteResponse).toBeOK();
  const downvoteBody = await downvoteResponse.json() as typeof roadmapBody;
  const downvotedItem = downvoteBody.items?.find((item) => item.id === roadmapItem!.id);
  expect(downvotedItem?.userVote).toBe('down');
  expect(downvotedItem?.downVotes).toBeGreaterThanOrEqual(roadmapItem!.downVotes + 1);

  await clerkAdmin.users.updateUserMetadata(user!.id, {
    privateMetadata: {
      cardforgeAccess: 'dev',
      cardforgeRole: 'owner',
    },
  });
  await page.goto('/developer', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByText(/Developer tools are active/i)).toBeVisible({ timeout: 45_000 });

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

  await page.goto('/profile', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByRole('heading', { name: /CardForge profile/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Compact account controls/i)).toBeVisible();
  await clerk.loaded({ page });
  await page.waitForFunction(() => Boolean(window.Clerk?.user?.id), null, { timeout: 45_000 });

  await page.evaluate(async () => {
    const clerkInstance = window.Clerk;
    if (!clerkInstance?.user) throw new Error('No Clerk user is active.');
    await clerkInstance.user.delete();
  });
  await page.waitForFunction(() => window.Clerk?.user === null, null, { timeout: 30_000 });

  await removeRoadmapVotes(user!.id);
  await removeFounderBetaClaim(user!.id);
  createdUserIds.delete(user!.id);
  await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByRole('button', { name: 'Sign in for export', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(email, { exact: true })).toHaveCount(0);
});
