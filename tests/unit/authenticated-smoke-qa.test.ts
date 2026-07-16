import { describe, expect, it } from 'vitest';

import {
  buildQaPrivateMetadata,
  ensureQaClerkUsers,
  ensureQaDeveloperProfiles,
  readQaAccountConfiguration,
  summarizeQaBootstrap,
} from '../../scripts/lib/authenticated-smoke-qa.mjs';

const completeEnv = {
  CARDFORGE_E2E_FREE_EMAIL: '  qa-free@example.test ',
  CARDFORGE_E2E_PAID_EMAIL: 'QA-Paid@example.test',
  CARDFORGE_E2E_DEV_EMAIL: 'qa-dev@example.test',
  CARDFORGE_E2E_OWNER_EMAIL: 'qa-owner@example.test',
};

describe('authenticated smoke QA configuration', () => {
  it('normalizes the four unique protected QA email values', () => {
    expect(readQaAccountConfiguration(completeEnv)).toEqual([
      { role: 'free', envKey: 'CARDFORGE_E2E_FREE_EMAIL', email: 'qa-free@example.test' },
      { role: 'paid', envKey: 'CARDFORGE_E2E_PAID_EMAIL', email: 'qa-paid@example.test' },
      { role: 'developer', envKey: 'CARDFORGE_E2E_DEV_EMAIL', email: 'qa-dev@example.test' },
      { role: 'owner', envKey: 'CARDFORGE_E2E_OWNER_EMAIL', email: 'qa-owner@example.test' },
    ]);
  });

  it('rejects a missing protected QA email without echoing another address', () => {
    const env = { ...completeEnv, CARDFORGE_E2E_PAID_EMAIL: '' };
    expect(() => readQaAccountConfiguration(env)).toThrow('Missing required QA email configuration: CARDFORGE_E2E_PAID_EMAIL.');
    expect(() => readQaAccountConfiguration(env)).not.toThrow(/qa-free@example\.test/);
  });

  it('rejects invalid and duplicate addresses without echoing their values', () => {
    const invalid = { ...completeEnv, CARDFORGE_E2E_DEV_EMAIL: 'not-an-email' };
    expect(() => readQaAccountConfiguration(invalid)).toThrow('Invalid QA email configuration: CARDFORGE_E2E_DEV_EMAIL.');
    expect(() => readQaAccountConfiguration(invalid)).not.toThrow(/not-an-email/);

    const duplicate = { ...completeEnv, CARDFORGE_E2E_OWNER_EMAIL: 'qa-dev@example.test' };
    expect(() => readQaAccountConfiguration(duplicate)).toThrow('QA email configuration must use four distinct addresses.');
    expect(() => readQaAccountConfiguration(duplicate)).not.toThrow(/qa-dev@example\.test/);
  });
});

describe('authenticated smoke QA role metadata', () => {
  const existing = {
    unrelated: 'preserved',
    cardforgeAccess: 'paid',
    cardforgeRole: 'owner',
    cardforgeAccessExpiresAt: '2026-08-01T00:00:00.000Z',
  };

  it('removes all CardForge role keys for free QA', () => {
    expect(buildQaPrivateMetadata('free', existing)).toEqual({ unrelated: 'preserved' });
  });

  it('aligns paid QA without retaining an owner role or expiration', () => {
    expect(buildQaPrivateMetadata('paid', existing)).toEqual({
      unrelated: 'preserved',
      cardforgeAccess: 'paid',
    });
  });

  it('aligns developer QA without retaining an owner role or expiration', () => {
    expect(buildQaPrivateMetadata('developer', existing)).toEqual({
      unrelated: 'preserved',
      cardforgeAccess: 'dev',
    });
  });

  it('aligns owner QA with developer access and the owner role', () => {
    expect(buildQaPrivateMetadata('owner', existing)).toEqual({
      unrelated: 'preserved',
      cardforgeAccess: 'dev',
      cardforgeRole: 'owner',
    });
  });

  it('rejects unknown roles without serializing metadata', () => {
    expect(() => buildQaPrivateMetadata('administrator', existing)).toThrow('Unsupported QA role.');
    expect(() => buildQaPrivateMetadata('administrator', existing)).not.toThrow(/preserved/);
  });
});

const createFakeClerk = (initialUsers: Array<{
  id: string;
  email: string;
  privateMetadata?: Record<string, unknown>;
}> = []) => {
  const users = new Map(initialUsers.map((user) => [user.id, {
    id: user.id,
    emailAddresses: [{ emailAddress: user.email }],
    privateMetadata: user.privateMetadata ?? {},
  }]));
  const calls = {
    create: [] as Array<Record<string, unknown>>,
    update: [] as Array<{ userId: string; privateMetadata: Record<string, unknown> }>,
  };

  return {
    calls,
    users: {
      async getUserList({ emailAddress }: { emailAddress: string[] }) {
        const email = emailAddress[0];
        const data = [...users.values()].filter((user) => (
          user.emailAddresses.some((address) => address.emailAddress.toLowerCase() === email.toLowerCase())
        ));
        return { data, totalCount: data.length };
      },
      async createUser(params: Record<string, unknown>) {
        calls.create.push(params);
        const email = (params.emailAddress as string[])[0];
        const user = {
          id: `user_created_${users.size + 1}`,
          emailAddresses: [{ emailAddress: email }],
          privateMetadata: {},
        };
        users.set(user.id, user);
        return user;
      },
      async getUser(userId: string) {
        const user = users.get(userId);
        if (!user) throw new Error('User not found.');
        return user;
      },
      async updateUserMetadata(userId: string, { privateMetadata }: { privateMetadata: Record<string, unknown> }) {
        calls.update.push({ userId, privateMetadata });
        const user = users.get(userId);
        if (!user) throw new Error('User not found.');
        user.privateMetadata = privateMetadata;
        return user;
      },
    },
  };
};

describe('authenticated smoke Clerk QA bootstrap', () => {
  it('creates missing users with an unreported password and aligns their roles', async () => {
    const clerk = createFakeClerk();
    const accounts = readQaAccountConfiguration(completeEnv);
    const results = await ensureQaClerkUsers({
      clerk,
      accounts,
      passwordFactory: () => 'Unlogged-Random-Password!Qa9',
    });

    expect(clerk.calls.create).toHaveLength(4);
    expect(clerk.calls.create[0]).toMatchObject({
      emailAddress: ['qa-free@example.test'],
      password: 'Unlogged-Random-Password!Qa9',
      skipPasswordChecks: true,
      skipLegalChecks: true,
    });
    expect(clerk.calls.update.map((call) => call.privateMetadata)).toEqual([
      { cardforgeAccess: 'paid' },
      { cardforgeAccess: 'dev' },
      { cardforgeAccess: 'dev', cardforgeRole: 'owner' },
    ]);
    expect(results.every((result) => result.created)).toBe(true);

    const summaryText = JSON.stringify(summarizeQaBootstrap(results));
    expect(summaryText).not.toContain('qa-free@example.test');
    expect(summaryText).not.toContain('Unlogged-Random-Password!Qa9');
    expect(summaryText).not.toContain('user_created_');
    expect(JSON.parse(summaryText)).toEqual({
      total: 4,
      created: 4,
      metadataUpdated: 3,
      roles: [
        { role: 'free', created: true, metadataUpdated: false },
        { role: 'paid', created: true, metadataUpdated: true },
        { role: 'developer', created: true, metadataUpdated: true },
        { role: 'owner', created: true, metadataUpdated: true },
      ],
    });
  });

  it('reuses exact users, preserves unrelated metadata, and updates only drifted roles', async () => {
    const clerk = createFakeClerk([
      { id: 'free_id', email: 'qa-free@example.test', privateMetadata: { unrelated: 'free' } },
      { id: 'paid_id', email: 'qa-paid@example.test', privateMetadata: { unrelated: 'paid', cardforgeAccess: 'free', cardforgeRole: 'owner' } },
      { id: 'dev_id', email: 'qa-dev@example.test', privateMetadata: { unrelated: 'dev', cardforgeAccess: 'dev' } },
      { id: 'owner_id', email: 'qa-owner@example.test', privateMetadata: { unrelated: 'owner', cardforgeAccess: 'dev', cardforgeRole: 'owner' } },
    ]);

    const results = await ensureQaClerkUsers({
      clerk,
      accounts: readQaAccountConfiguration(completeEnv),
      passwordFactory: () => 'unused',
    });

    expect(clerk.calls.create).toEqual([]);
    expect(clerk.calls.update).toEqual([{
      userId: 'paid_id',
      privateMetadata: { unrelated: 'paid', cardforgeAccess: 'paid' },
    }]);
    expect(results.map(({ created, metadataUpdated }) => ({ created, metadataUpdated }))).toEqual([
      { created: false, metadataUpdated: false },
      { created: false, metadataUpdated: true },
      { created: false, metadataUpdated: false },
      { created: false, metadataUpdated: false },
    ]);
  });

  it('fails closed on an ambiguous exact-email lookup without creating or updating', async () => {
    const clerk = createFakeClerk([
      { id: 'duplicate_1', email: 'qa-free@example.test' },
      { id: 'duplicate_2', email: 'qa-free@example.test' },
    ]);

    await expect(ensureQaClerkUsers({
      clerk,
      accounts: readQaAccountConfiguration(completeEnv),
      passwordFactory: () => 'unused',
    })).rejects.toThrow('Ambiguous Clerk QA account lookup: CARDFORGE_E2E_FREE_EMAIL.');
    expect(clerk.calls.create).toEqual([]);
    expect(clerk.calls.update).toEqual([]);
  });
});

describe('authenticated smoke developer profiles', () => {
  it('upserts only developer and owner QA profiles', async () => {
    const calls: Array<{ rows: Array<Record<string, unknown>>; options: Record<string, unknown> }> = [];
    const supabase = {
      from(table: string) {
        expect(table).toBe('cardforge_developer_profiles');
        return {
          async upsert(rows: Array<Record<string, unknown>>, options: Record<string, unknown>) {
            calls.push({ rows, options });
            return { error: null };
          },
        };
      },
    };
    const clerk = createFakeClerk();
    const results = await ensureQaClerkUsers({
      clerk,
      accounts: readQaAccountConfiguration(completeEnv),
      passwordFactory: () => 'Unlogged-Random-Password!Qa9',
    });

    await ensureQaDeveloperProfiles({ supabase, accounts: results });

    expect(calls).toEqual([{
      rows: [
        expect.objectContaining({ email: 'qa-dev@example.test', status: 'active', first_name: 'Developer', last_name: 'QA' }),
        expect.objectContaining({ email: 'qa-owner@example.test', status: 'active', first_name: 'Owner', last_name: 'QA' }),
      ],
      options: { onConflict: 'clerk_user_id' },
    }]);
  });

  it('propagates a developer-profile storage failure without exposing account data', async () => {
    const supabase = {
      from() {
        return { upsert: async () => ({ error: new Error('provider failure') }) };
      },
    };
    const accounts = [{
      role: 'developer',
      email: 'qa-dev@example.test',
      userId: 'secret-user-id',
      created: false,
      metadataUpdated: false,
    }];

    await expect(ensureQaDeveloperProfiles({ supabase, accounts })).rejects.toThrow('Unable to align QA developer profiles.');
  });
});
