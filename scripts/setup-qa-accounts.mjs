import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envLocalPath = path.join(rootDir, '.env.local');
const developerAssetBucket = 'cardforge-developer-assets';

const defaultAccounts = {
  free: {
    envKey: 'CARDFORGE_E2E_FREE_EMAIL',
    email: 'cardforge+fresh-free@example.com',
    firstName: 'FreshFree',
    privateMetadata: {},
  },
  paid: {
    envKey: 'CARDFORGE_E2E_PAID_EMAIL',
    email: 'cardforge+fresh-paid@example.com',
    firstName: 'FreshPaid',
    privateMetadata: { cardforgeAccess: 'paid' },
  },
  developer: {
    envKey: 'CARDFORGE_E2E_DEV_EMAIL',
    email: 'cardforge+freshdev@example.com',
    firstName: 'FreshDev',
    privateMetadata: { cardforgeAccess: 'dev' },
    developerProfile: true,
  },
  owner: {
    envKey: 'CARDFORGE_E2E_OWNER_EMAIL',
    email: 'cardforge+fresh-owner@example.com',
    firstName: 'FreshOwner',
    privateMetadata: { cardforgeAccess: 'dev', cardforgeRole: 'owner' },
    developerProfile: true,
  },
};

const managedEnvKeys = [
  'CARDFORGE_E2E_FREE_EMAIL',
  'CARDFORGE_E2E_PAID_EMAIL',
  'CARDFORGE_E2E_DEV_EMAIL',
  'CARDFORGE_E2E_OWNER_EMAIL',
  'CARDFORGE_E2E_ALLOW_DISPOSABLE_USERS',
  'CARDFORGE_PAID_ACCOUNT_EMAILS',
  'CARDFORGE_DEV_ACCOUNT_EMAILS',
];

const clerkRequest = async (pathName, {
  method = 'GET',
  body,
  query,
} = {}) => {
  const url = new URL(`https://api.clerk.com/v1${pathName}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.errors?.[0]?.long_message
      ?? payload?.errors?.[0]?.message
      ?? payload?.message
      ?? `Clerk API request failed with ${response.status}.`;
    throw new Error(message);
  }
  return payload;
};

const loadEnvFile = async (filePath) => {
  const contents = await fs.readFile(filePath, 'utf8').catch(() => '');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
};

const readEnvValues = async () => {
  await loadEnvFile(envLocalPath);
  await loadEnvFile(path.join(rootDir, '.env'));
};

const requireEnv = (keys) => {
  const missing = keys.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error([
      `Missing required local setup value${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`,
      'Add the real values to .env.local, then rerun this script.',
    ].join('\n'));
  }
};

const quoteEnvValue = (value) => {
  if (/^[A-Za-z0-9_./:@+-]+$/.test(value)) return value;
  return JSON.stringify(value);
};

const upsertEnvLocalValues = async (values) => {
  const existing = await fs.readFile(envLocalPath, 'utf8').catch(() => '');
  const lines = existing.split(/\r?\n/);
  const handled = new Set();
  const nextLines = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match || !(match[1] in values)) return line;
    handled.add(match[1]);
    return `${match[1]}=${quoteEnvValue(values[match[1]])}`;
  }).filter((line, index, array) => index < array.length - 1 || line.trim() !== '');

  const additions = Object.entries(values)
    .filter(([key]) => !handled.has(key))
    .map(([key, value]) => `${key}=${quoteEnvValue(value)}`);

  if (additions.length > 0) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1].trim()) nextLines.push('');
    nextLines.push('# Reusable CardForge QA accounts');
    nextLines.push(...additions);
  }

  await fs.writeFile(envLocalPath, `${nextLines.join('\n')}\n`, 'utf8');
};

const removeCardForgeAccess = (metadata) => {
  const next = { ...(metadata ?? {}) };
  delete next.cardforgeAccess;
  delete next.cardforgeRole;
  delete next.cardforgeAccessExpiresAt;
  delete next.cardforgeFounderBetaClaimedAt;
  return next;
};

const findUserByEmail = async (email) => {
  const users = await clerkRequest('/users', {
    query: {
      email_address: email,
      limit: 1,
    },
  });
  return users[0] ?? null;
};

const ensureClerkUser = async (role, account) => {
  const email = process.env[account.envKey]?.trim() || account.email;
  let user = await findUserByEmail(email);
  let created = false;

  if (!user) {
    user = await clerkRequest('/users', {
      method: 'POST',
      body: {
        email_address: [email],
        first_name: account.firstName,
        last_name: 'QA',
        skip_password_checks: true,
        skip_legal_checks: true,
        password: process.env.CARDFORGE_QA_ACCOUNT_PASSWORD || `CardForge-${crypto.randomUUID()}!Qa9`,
      },
    });
    created = true;
  }

  const fullUser = await clerkRequest(`/users/${user.id}`);
  const baseMetadata = removeCardForgeAccess(fullUser.private_metadata);
  const privateMetadata = {
    ...baseMetadata,
    ...account.privateMetadata,
  };

  await clerkRequest(`/users/${user.id}/metadata`, {
    method: 'PUT',
    body: {
      private_metadata: privateMetadata,
    },
  });
  return {
    id: user.id,
    email,
    firstName: account.firstName,
    created,
    developerProfile: Boolean(account.developerProfile),
  };
};

const isNetworkLikeError = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('fetch failed')
    || message.includes('Unable to connect')
    || message.includes('ECONNREFUSED')
    || message.includes('ENOTFOUND')
    || message.includes('ETIMEDOUT');
};

const ensureDeveloperProfiles = async (supabase, accounts) => {
  const profileRows = accounts
    .filter((account) => account.developerProfile)
    .map((account) => ({
      clerk_user_id: account.id,
      email: account.email,
      status: 'active',
      first_name: account.firstName,
      last_name: 'QA',
      eligible_for_profit_share: true,
    }));

  if (profileRows.length === 0) return;

  const { error } = await supabase
    .from('cardforge_developer_profiles')
    .upsert(profileRows, { onConflict: 'clerk_user_id' });

  if (error) throw error;
};

const ensureDeveloperAssetBucket = async (supabase) => {
  const { data } = await supabase.storage.getBucket(developerAssetBucket);
  if (data) return 'exists';

  const { error } = await supabase.storage.createBucket(developerAssetBucket, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: [
      'image/svg+xml',
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/json',
      'font/woff2',
      'font/woff',
      'font/ttf',
      'font/otf',
      'application/font-woff',
      'application/x-font-ttf',
      'application/x-font-otf',
      'application/octet-stream',
    ],
  });
  if (error) throw error;
  return 'created';
};

const main = async () => {
  await readEnvValues();
  requireEnv([
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]);

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const results = [];
  for (const [role, account] of Object.entries(defaultAccounts)) {
    results.push({ role, ...await ensureClerkUser(role, account) });
  }

  await ensureDeveloperProfiles(supabase, results);
  const bucketStatus = await ensureDeveloperAssetBucket(supabase);

  await upsertEnvLocalValues({
    CARDFORGE_E2E_FREE_EMAIL: results.find((account) => account.role === 'free').email,
    CARDFORGE_E2E_PAID_EMAIL: results.find((account) => account.role === 'paid').email,
    CARDFORGE_E2E_DEV_EMAIL: results.find((account) => account.role === 'developer').email,
    CARDFORGE_E2E_OWNER_EMAIL: results.find((account) => account.role === 'owner').email,
    CARDFORGE_E2E_ALLOW_DISPOSABLE_USERS: 'false',
    CARDFORGE_PAID_ACCOUNT_EMAILS: results.find((account) => account.role === 'paid').email,
    CARDFORGE_DEV_ACCOUNT_EMAILS: [
      results.find((account) => account.role === 'developer').email,
      results.find((account) => account.role === 'owner').email,
    ].join(','),
  });

  console.log('CardForge reusable QA accounts are ready.');
  for (const account of results) {
    console.log(`${account.role}: ${account.email} (${account.created ? 'created' : 'reused'})`);
  }
  console.log(`Developer asset bucket: ${bucketStatus}.`);
  console.log(`Updated ${path.relative(rootDir, envLocalPath)} with ${managedEnvKeys.join(', ')}.`);
};

main().catch((error) => {
  if (isNetworkLikeError(error)) {
    console.error([
      'Unable to reach Clerk or Supabase from this shell.',
      'Check network access, then rerun: npm run qa:setup-accounts',
    ].join('\n'));
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
