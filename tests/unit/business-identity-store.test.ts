import { describe, expect, it, vi } from 'vitest';

import {
  BusinessIdentityStoreError,
  getBusinessIdentity,
  updateBusinessIdentity,
} from '@/features/business-identity/server';
import { DEFAULT_BUSINESS_IDENTITY } from '@/features/business-identity/client';

const storedIdentity = {
  id: 'cardforge',
  identity_version: 3,
  brand_name: 'CardForge Studio',
  legal_operator_name: 'Cameron Locke',
  entity_type: 'sole_proprietor',
  jurisdiction_state: 'Oregon',
  jurisdiction_country: 'United States',
  assumed_business_name_status: 'unverified',
  support_email: 'support@cardforges.com',
  legal_email: 'legal@cardforges.com',
  support_phone: null,
  website_url: 'https://cardforges.com',
  effective_date: '2026-07-16',
  copyright_holder: 'Cameron Locke',
};

const makeReadClient = (result: { data: unknown; error: unknown }) => {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return { client: { from }, from, select, eq, maybeSingle };
};

const makeWriteTable = (result: { data: unknown; error: unknown }) => {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ maybeSingle });
  const versionEq = vi.fn().mockReturnValue({ select });
  const idEq = vi.fn().mockReturnValue({ eq: versionEq });
  const update = vi.fn().mockReturnValue({ eq: idEq });

  return { table: { update }, update, idEq, versionEq, select, maybeSingle };
};

describe('business identity store', () => {
  it('returns locked defaults when Supabase is unconfigured', async () => {
    await expect(getBusinessIdentity({
      configured: false,
      client: null,
    })).resolves.toEqual(DEFAULT_BUSINESS_IDENTITY);
  });

  it('strictly parses a configured snake_case database row', async () => {
    const { client, from, select, eq } = makeReadClient({
      data: storedIdentity,
      error: null,
    });

    await expect(getBusinessIdentity({ configured: true, client })).resolves.toEqual({
      ...DEFAULT_BUSINESS_IDENTITY,
      identityVersion: 3,
      supportEmail: 'support@cardforges.com',
      legalEmail: 'legal@cardforges.com',
    });
    expect(from).toHaveBeenCalledWith('cardforge_business_identity');
    expect(select).toHaveBeenCalledWith(
      'id,identity_version,brand_name,legal_operator_name,entity_type,jurisdiction_state,jurisdiction_country,assumed_business_name_status,support_email,legal_email,support_phone,website_url,effective_date,copyright_holder',
    );
    expect(eq).toHaveBeenCalledWith('id', 'cardforge');
  });

  it.each([
    ['a non-record row', null],
    ['the wrong singleton id', { ...storedIdentity, id: 'other' }],
    ['a missing field', (() => {
      const { legal_email: _removed, ...row } = storedIdentity;
      return row;
    })()],
    ['an invalid field type', { ...storedIdentity, support_email: 42 }],
    ['an invalid version', { ...storedIdentity, identity_version: 0 }],
    ['an invalid persisted email', { ...storedIdentity, legal_email: 'invalid' }],
    ['an unsafe persisted website', { ...storedIdentity, website_url: 'https://user:secret@cardforges.com' }],
  ])('rejects malformed persisted data: %s', async (_label, data) => {
    const read = makeReadClient({ data, error: null });

    await expect(getBusinessIdentity({
      configured: true,
      client: read.client,
    })).rejects.toMatchObject({
      name: 'BusinessIdentityStoreError',
      status: 500,
      message: 'Business identity storage returned malformed data.',
    } satisfies Partial<BusinessIdentityStoreError>);
  });

  it('falls back only when the business identity table is missing', async () => {
    const missingTable = makeReadClient({
      data: null,
      error: { code: 'PGRST205', message: 'table missing from schema cache' },
    });

    await expect(getBusinessIdentity({
      configured: true,
      client: missingTable.client,
    })).resolves.toEqual(DEFAULT_BUSINESS_IDENTITY);

    const databaseFailure = makeReadClient({
      data: null,
      error: { code: 'XX000', message: 'database unavailable' },
    });
    await expect(getBusinessIdentity({
      configured: true,
      client: databaseFailure.client,
    })).rejects.toMatchObject({
      name: 'BusinessIdentityStoreError',
      status: 500,
      message: 'Unable to load business identity.',
    } satisfies Partial<BusinessIdentityStoreError>);
  });

  it('strictly rejects malformed owner writes before storage', async () => {
    const from = vi.fn();

    await expect(updateBusinessIdentity({
      identityVersion: 99,
      supportEamil: 'support@example.com',
    }, 3, {
      configured: true,
      client: { from },
    })).rejects.toMatchObject({
      name: 'BusinessIdentityStoreError',
      status: 400,
    } satisfies Partial<BusinessIdentityStoreError>);
    expect(from).not.toHaveBeenCalled();
  });

  it.each([undefined, null, '3', 0, -1, 1.5, 2_147_483_648])(
    'rejects invalid expected identity version %s before storage',
    async (expectedIdentityVersion) => {
      const from = vi.fn();

      await expect(updateBusinessIdentity({
        legalEmail: 'privacy@cardforges.com',
      }, expectedIdentityVersion, {
        configured: true,
        client: { from },
      })).rejects.toMatchObject({
        status: 400,
        message: 'Expected identity version must be a positive integer.',
      } satisfies Partial<BusinessIdentityStoreError>);
      expect(from).not.toHaveBeenCalled();
    },
  );

  it('updates a complete normalized row under an atomic version condition', async () => {
    const read = makeReadClient({ data: storedIdentity, error: null });
    const returnedIdentity = {
      ...storedIdentity,
      identity_version: 4,
      legal_email: 'privacy@cardforges.com',
    };
    const write = makeWriteTable({ data: returnedIdentity, error: null });
    const from = vi.fn()
      .mockReturnValueOnce({ select: read.select })
      .mockReturnValueOnce(write.table);

    await expect(updateBusinessIdentity({
      legalEmail: ' PRIVACY@CardForges.com ',
    }, 3, {
      configured: true,
      client: { from },
    })).resolves.toEqual({
      ...DEFAULT_BUSINESS_IDENTITY,
      identityVersion: 4,
      supportEmail: 'support@cardforges.com',
      legalEmail: 'privacy@cardforges.com',
    });

    expect(write.update).toHaveBeenCalledWith({
      brand_name: 'CardForge Studio',
      legal_operator_name: 'Cameron Locke',
      entity_type: 'sole_proprietor',
      jurisdiction_state: 'Oregon',
      jurisdiction_country: 'United States',
      assumed_business_name_status: 'unverified',
      support_email: 'support@cardforges.com',
      legal_email: 'privacy@cardforges.com',
      support_phone: null,
      website_url: 'https://cardforges.com',
      effective_date: '2026-07-16',
      copyright_holder: 'Cameron Locke',
    });
    expect(write.idEq).toHaveBeenCalledWith('id', 'cardforge');
    expect(write.versionEq).toHaveBeenCalledWith('identity_version', 3);
  });

  it('rejects an assumed-name status transition through the owner write path', async () => {
    const read = makeReadClient({ data: storedIdentity, error: null });

    await expect(updateBusinessIdentity({
      assumedBusinessNameStatus: 'registered',
    }, 3, {
      configured: true,
      client: read.client,
    })).rejects.toMatchObject({
      name: 'BusinessIdentityStoreError',
      status: 400,
      message: 'Assumed business name status requires documented external verification and a separate reviewed update.',
      fieldErrors: {
        assumedBusinessNameStatus: 'Assumed business name status cannot be changed in the owner console.',
      },
    } satisfies Partial<BusinessIdentityStoreError>);
    expect(read.from).toHaveBeenCalledTimes(1);
  });

  it('allows an owner save that preserves the stored assumed-name status', async () => {
    const read = makeReadClient({ data: storedIdentity, error: null });
    const returnedIdentity = {
      ...storedIdentity,
      identity_version: 4,
      legal_email: 'privacy@cardforges.com',
    };
    const write = makeWriteTable({ data: returnedIdentity, error: null });
    const from = vi.fn()
      .mockReturnValueOnce({ select: read.select })
      .mockReturnValueOnce(write.table);

    await expect(updateBusinessIdentity({
      assumedBusinessNameStatus: 'unverified',
      legalEmail: 'privacy@cardforges.com',
    }, 3, {
      configured: true,
      client: { from },
    })).resolves.toMatchObject({
      identityVersion: 4,
      assumedBusinessNameStatus: 'unverified',
      legalEmail: 'privacy@cardforges.com',
    });
    expect(write.update).toHaveBeenCalledTimes(1);
  });

  it('rejects an already-stale expected version without attempting an update', async () => {
    const read = makeReadClient({ data: storedIdentity, error: null });

    await expect(updateBusinessIdentity({
      legalEmail: 'next@cardforges.com',
    }, 2, {
      configured: true,
      client: read.client,
    })).rejects.toMatchObject({
      status: 409,
      message: 'Business identity changed since it was loaded. Refresh and try again.',
    } satisfies Partial<BusinessIdentityStoreError>);
  });

  it('rejects a concurrent update when the atomic version condition matches no row', async () => {
    const read = makeReadClient({ data: storedIdentity, error: null });
    const write = makeWriteTable({ data: null, error: null });
    const from = vi.fn()
      .mockReturnValueOnce({ select: read.select })
      .mockReturnValueOnce(write.table);

    await expect(updateBusinessIdentity({
      legalEmail: 'next@cardforges.com',
    }, 3, {
      configured: true,
      client: { from },
    })).rejects.toMatchObject({
      status: 409,
      message: 'Business identity changed since it was loaded. Refresh and try again.',
    } satisfies Partial<BusinessIdentityStoreError>);
    expect(write.versionEq).toHaveBeenCalledWith('identity_version', 3);
  });

  it('rejects identity-version overflow before writing', async () => {
    const current = {
      ...storedIdentity,
      identity_version: 2_147_483_647,
    };
    const read = makeReadClient({ data: current, error: null });

    await expect(updateBusinessIdentity({ legalEmail: 'next@cardforges.com' }, 2_147_483_647, {
      configured: true,
      client: read.client,
    })).rejects.toMatchObject({
      status: 409,
      message: 'Business identity version cannot be incremented further.',
    } satisfies Partial<BusinessIdentityStoreError>);
  });

  it('fails configured writes clearly when the migration is absent', async () => {
    const read = makeReadClient({
      data: null,
      error: { code: 'PGRST205', message: 'table missing from schema cache' },
    });

    await expect(updateBusinessIdentity({ legalEmail: 'next@cardforges.com' }, 1, {
      configured: true,
      client: read.client,
    })).rejects.toMatchObject({
      status: 503,
      message: 'Business identity storage is not ready. Apply the prepared database migration first.',
    } satisfies Partial<BusinessIdentityStoreError>);
  });

  it('wraps update failures in a typed store error', async () => {
    const read = makeReadClient({ data: storedIdentity, error: null });
    const write = makeWriteTable({
      data: null,
      error: { code: 'XX000', message: 'write failed' },
    });
    const from = vi.fn()
      .mockReturnValueOnce({ select: read.select })
      .mockReturnValueOnce(write.table);

    await expect(updateBusinessIdentity({ legalEmail: 'next@cardforges.com' }, 3, {
      configured: true,
      client: { from },
    })).rejects.toMatchObject({
      name: 'BusinessIdentityStoreError',
      status: 500,
      message: 'Unable to update business identity.',
    } satisfies Partial<BusinessIdentityStoreError>);
  });
});
