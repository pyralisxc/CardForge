import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const QA_ROLE_CONFIGURATION = [
  { role: 'free', envKey: 'CARDFORGE_E2E_FREE_EMAIL' },
  { role: 'paid', envKey: 'CARDFORGE_E2E_PAID_EMAIL' },
  { role: 'developer', envKey: 'CARDFORGE_E2E_DEV_EMAIL' },
  { role: 'owner', envKey: 'CARDFORGE_E2E_OWNER_EMAIL' },
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const qaFirstNames = {
  free: 'Free',
  paid: 'Paid',
  developer: 'Developer',
  owner: 'Owner',
};

const safeBootstrapFailurePatterns = [
  /^Missing protected QA bootstrap configuration: [A-Z0-9_]+\.$/,
  /^Missing required QA email configuration: CARDFORGE_E2E_(?:FREE|PAID|DEV|OWNER)_EMAIL\.$/,
  /^Invalid QA email configuration: CARDFORGE_E2E_(?:FREE|PAID|DEV|OWNER)_EMAIL\.$/,
  /^QA email configuration must use four distinct addresses\.$/,
  /^(?:Unable to look up|Ambiguous|Incomplete|Inexact|Unable to create|Unable to load|Unable to align) Clerk QA account: CARDFORGE_E2E_(?:FREE|PAID|DEV|OWNER)_EMAIL\.$/,
  /^Unable to align QA developer profiles\.$/,
  /^Unsupported QA role\.$/,
];

export const describeQaBootstrapFailure = (stage, error) => {
  const safeMessage = error instanceof Error
    && safeBootstrapFailurePatterns.some((pattern) => pattern.test(error.message))
    ? ` ${error.message}`
    : '';
  return `Authenticated smoke QA bootstrap failed during ${stage}.${safeMessage}`;
};

export const readQaAccountConfiguration = (env) => {
  const accounts = QA_ROLE_CONFIGURATION.map(({ role, envKey }) => {
    const email = env[envKey]?.trim().toLowerCase() ?? '';
    if (!email) throw new Error(`Missing required QA email configuration: ${envKey}.`);
    if (!emailPattern.test(email)) throw new Error(`Invalid QA email configuration: ${envKey}.`);
    return { role, envKey, email };
  });

  if (new Set(accounts.map(({ email }) => email)).size !== accounts.length) {
    throw new Error('QA email configuration must use four distinct addresses.');
  }

  return accounts;
};

export const buildQaPrivateMetadata = (role, existingMetadata = {}) => {
  const nextMetadata = { ...existingMetadata };
  delete nextMetadata.cardforgeAccess;
  delete nextMetadata.cardforgeRole;
  delete nextMetadata.cardforgeAccessExpiresAt;

  if (role === 'free') return nextMetadata;
  if (role === 'paid') return { ...nextMetadata, cardforgeAccess: 'paid' };
  if (role === 'developer') return { ...nextMetadata, cardforgeAccess: 'dev' };
  if (role === 'owner') {
    return {
      ...nextMetadata,
      cardforgeAccess: 'dev',
      cardforgeRole: 'owner',
    };
  }
  throw new Error('Unsupported QA role.');
};

const createQaPassword = () => `CardForge-${crypto.randomBytes(24).toString('base64url')}!Qa9`;

const hasExactEmail = (user, email) => (
  Array.isArray(user?.emailAddresses)
  && user.emailAddresses.some((address) => address?.emailAddress?.trim().toLowerCase() === email)
);

export const ensureQaClerkUsers = async ({
  clerk,
  accounts,
  passwordFactory = createQaPassword,
}) => {
  const results = [];

  for (const account of accounts) {
    const firstName = qaFirstNames[account.role];
    if (!firstName) throw new Error('Unsupported QA role.');

    let lookup;
    try {
      lookup = await clerk.users.getUserList({
        emailAddress: [account.email],
        limit: 2,
      });
    } catch (error) {
      throw new Error(`Unable to look up Clerk QA account: ${account.envKey}.`, { cause: error });
    }

    if (lookup.totalCount > 1 || lookup.data.length > 1) {
      throw new Error(`Ambiguous Clerk QA account lookup: ${account.envKey}.`);
    }
    if (lookup.totalCount > 0 && lookup.data.length === 0) {
      throw new Error(`Incomplete Clerk QA account lookup: ${account.envKey}.`);
    }

    let user = lookup.data[0] ?? null;
    let created = false;
    if (user && !hasExactEmail(user, account.email)) {
      throw new Error(`Inexact Clerk QA account lookup: ${account.envKey}.`);
    }

    if (!user) {
      try {
        user = await clerk.users.createUser({
          emailAddress: [account.email],
          firstName,
          lastName: 'QA',
          password: passwordFactory(account.role),
          skipPasswordChecks: true,
          skipLegalChecks: true,
        });
        created = true;
      } catch (error) {
        throw new Error(`Unable to create Clerk QA account: ${account.envKey}.`, { cause: error });
      }
    }

    let fullUser;
    try {
      fullUser = await clerk.users.getUser(user.id);
    } catch (error) {
      throw new Error(`Unable to load Clerk QA account: ${account.envKey}.`, { cause: error });
    }
    const privateMetadata = buildQaPrivateMetadata(account.role, fullUser.privateMetadata ?? {});
    const metadataUpdated = !isDeepStrictEqual(privateMetadata, fullUser.privateMetadata ?? {});
    if (metadataUpdated) {
      try {
        await clerk.users.replaceUserMetadata(user.id, { privateMetadata });
      } catch (error) {
        throw new Error(`Unable to align Clerk QA account: ${account.envKey}.`, { cause: error });
      }
    }

    results.push({
      role: account.role,
      email: account.email,
      userId: user.id,
      firstName,
      created,
      metadataUpdated,
    });
  }

  return results;
};

export const summarizeQaBootstrap = (accounts) => ({
  total: accounts.length,
  created: accounts.filter((account) => account.created).length,
  metadataUpdated: accounts.filter((account) => account.metadataUpdated).length,
  roles: accounts.map(({ role, created, metadataUpdated }) => ({ role, created, metadataUpdated })),
});

export const ensureQaDeveloperProfiles = async ({ supabase, accounts }) => {
  const rows = accounts
    .filter((account) => account.role === 'developer' || account.role === 'owner')
    .map((account) => ({
      clerk_user_id: account.userId,
      email: account.email,
      status: 'active',
      first_name: account.firstName ?? qaFirstNames[account.role],
      last_name: 'QA',
      eligible_for_profit_share: true,
    }));

  if (rows.length === 0) return;
  const { error } = await supabase
    .from('cardforge_developer_profiles')
    .upsert(rows, { onConflict: 'clerk_user_id' });
  if (error) throw new Error('Unable to align QA developer profiles.', { cause: error });
};
