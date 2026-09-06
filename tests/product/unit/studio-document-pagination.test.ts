import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { listStudioDocuments, listStudioDocumentsPage } from '@/features/studio-documents/server/studioDocumentStore';

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: vi.fn(),
}));

const mockedGetSupabaseServerClient = vi.mocked(getSupabaseServerClient);

const row = (index: number) => ({
  id: `document-${index}`,
  title: `Document ${index}`,
  creation_source: 'gpt',
  revision: 1,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  last_activity_at: '2026-09-01T00:00:00.000Z',
  expires_at: '2026-10-01T00:00:00.000Z',
  retention_hours: 720,
  deleted_at: null,
  purge_after: null,
  last_installed_revision: null,
  last_installed_at: null,
  last_install_summary: null,
  source_project_provider: null,
  source_project_external_id: null,
  source_provider_revision: null,
  source_project_revision: null,
  source_project_name: null,
});

afterEach(() => vi.restoreAllMocks());

describe('Studio document native pagination', () => {
  it('exposes a cursor after a complete first page and follows it for all private working documents', async () => {
    const query = {
      select: vi.fn(), eq: vi.fn(), is: vi.fn(), order: vi.fn(), range: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.range.mockImplementation((from: number) => Promise.resolve({
      data: from === 0 ? Array.from({ length: 101 }, (_, index) => row(index)) : [row(101)],
      error: null,
    }));
    mockedGetSupabaseServerClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn().mockReturnValue(query),
    } as never);

    await expect(listStudioDocumentsPage('user-1', 720, 0)).resolves.toMatchObject({
      documents: Array.from({ length: 100 }, (_, index) => expect.objectContaining({ id: `document-${index}` })),
      nextCursor: 100,
      hasMore: true,
    });
    await expect(listStudioDocuments('user-1', 720)).resolves.toHaveLength(101);
    expect(query.range).toHaveBeenCalledWith(100, 200);
  });
});
