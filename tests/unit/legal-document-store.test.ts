import { describe, expect, it, vi } from 'vitest';

import {
  getLegalDocuments,
  LegalDocumentStoreError,
  publishLegalDocument,
  type LegalDocumentStoreClient,
} from '@/features/legal/server';

const row = (overrides: Record<string, unknown> = {}) => ({
  slug: 'privacy',
  version: 2,
  title: 'Privacy v2',
  body: 'Updated privacy body',
  effective_date: '2026-07-17',
  published_at: '2026-07-17T12:00:00.000Z',
  business_identity_version: 3,
  ...overrides,
});

const createClient = ({
  rows = [row()],
  readError = null,
  rpcData = row({ version: 3 }),
  rpcError = null,
}: {
  rows?: unknown[];
  readError?: unknown;
  rpcData?: unknown;
  rpcError?: unknown;
} = {}) => {
  const secondOrder = vi.fn().mockResolvedValue({ data: rows, error: readError });
  const firstOrder = vi.fn(() => ({ order: secondOrder }));
  const select = vi.fn(() => ({ order: firstOrder }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn().mockResolvedValue({ data: rpcData, error: rpcError });
  return {
    client: { from, rpc } as unknown as LegalDocumentStoreClient,
    from,
    select,
    firstOrder,
    secondOrder,
    rpc,
  };
};

describe('legal document store', () => {
  it('loads only the newest publication for each slug', async () => {
    const mocks = createClient({
      rows: [
        row({ version: 2, title: 'Privacy v2' }),
        row({ version: 1, title: 'Privacy v1' }),
        row({ slug: 'terms', version: 4, title: 'Terms v4' }),
      ],
    });

    const documents = await getLegalDocuments({ configured: true, client: mocks.client });

    expect(documents.find(({ slug }) => slug === 'privacy')).toMatchObject({
      version: 2,
      title: 'Privacy v2',
      effectiveDate: '2026-07-17',
      businessIdentityVersion: 3,
    });
    expect(documents.find(({ slug }) => slug === 'terms')).toMatchObject({ version: 4, title: 'Terms v4' });
    expect(documents).toHaveLength(9);
    expect(mocks.select).toHaveBeenCalledWith(
      'slug,version,title,body,effective_date,published_at,business_identity_version',
    );
    expect(mocks.firstOrder).toHaveBeenCalledWith('slug', { ascending: true });
    expect(mocks.secondOrder).toHaveBeenCalledWith('version', { ascending: false });
  });

  it('publishes through the atomic RPC and then returns latest documents', async () => {
    const mocks = createClient({ rows: [row({ version: 3 })] });

    const documents = await publishLegalDocument({
      slug: 'privacy',
      title: ' Privacy v3 ',
      body: ' Updated privacy body ',
      effectiveDate: '2026-07-18',
      expectedBusinessIdentityVersion: 3,
    }, { configured: true, client: mocks.client });

    expect(mocks.rpc).toHaveBeenCalledWith('publish_cardforge_legal_document', {
      p_slug: 'privacy',
      p_title: 'Privacy v3',
      p_body: 'Updated privacy body',
      p_effective_date: '2026-07-18',
      p_expected_identity_version: 3,
    });
    expect(documents.find(({ slug }) => slug === 'privacy')?.version).toBe(3);
  });

  it('maps stale identity and unavailable-schema failures without leaking provider details', async () => {
    const stale = createClient({
      rpcError: { code: 'P0001', message: 'cardforge_business_identity_version_conflict' },
    });
    await expect(publishLegalDocument({
      slug: 'terms', title: 'Terms', body: 'Terms body', effectiveDate: '2026-07-18', expectedBusinessIdentityVersion: 2,
    }, { configured: true, client: stale.client })).rejects.toMatchObject({ status: 409 });

    const missing = createClient({ rpcError: { code: 'PGRST202', message: 'function details' } });
    await expect(publishLegalDocument({
      slug: 'terms', title: 'Terms', body: 'Terms body', effectiveDate: '2026-07-18', expectedBusinessIdentityVersion: 2,
    }, { configured: true, client: missing.client })).rejects.toMatchObject({
      status: 503,
      message: 'Legal publication storage is not ready. Apply the prepared database migration first.',
    });

    const provider = createClient({ rpcError: { code: 'XX000', message: 'secret provider details' } });
    await expect(publishLegalDocument({
      slug: 'terms', title: 'Terms', body: 'Terms body', effectiveDate: '2026-07-18', expectedBusinessIdentityVersion: 2,
    }, { configured: true, client: provider.client })).rejects.toEqual(
      new LegalDocumentStoreError('Unable to publish legal document.'),
    );
  });

  it('validates writes before calling the provider', async () => {
    const mocks = createClient();
    await expect(publishLegalDocument({
      slug: 'terms', title: '', body: 'Terms body', effectiveDate: '2026-07-18', expectedBusinessIdentityVersion: 2,
    }, { configured: true, client: mocks.client })).rejects.toMatchObject({ status: 400 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
