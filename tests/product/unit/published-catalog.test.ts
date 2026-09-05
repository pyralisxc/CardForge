import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCardForgeCatalogManifest } from '@/features/pipeline/lib/catalogManifest';

const database = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: () => database,
  getSupabaseServerConfigStatus: () => ({ configured: true }),
}));

const registryRow = (id: string, tier: 'free' | 'paid' | 'contributor') => ({
  asset_id: id, contributor_submission_id: `submission-${id}`, name: id,
  asset_type: 'icon', url: `https://example.test/${id}.svg`, preview_url: null,
  status: 'published', access_tier: tier, library_source: 'contributor',
  file_size_bytes: 100, updated_at: null, metadata: {}, studio_destinations: ['element.icon'],
});

const setupDatabase = () => {
  const selections = new Map<string, string>();
  const filters: Array<[string, string, unknown]> = [];
  database.from.mockImplementation((table: string) => {
    let rows: Record<string, unknown>[] = table === 'cardforge_asset_registry'
      ? [registryRow('free-icon', 'free'), registryRow('paid-icon', 'paid'), registryRow('contributor-icon', 'contributor')]
      : table === 'cardforge_contributor_asset_submissions'
        ? ['free-icon', 'paid-icon', 'contributor-icon'].map((id) => ({
          id: `submission-${id}`, lineage_id: `lineage-${id}`, source_payload: null,
          description: '  Use this icon for business contact details.  ',
          specialty_tags: ['business', 'unknown'], use_case_tags: ['business-card', 'event-badge', 'unknown'],
          contributor_email: 'private@example.test', source_notes: 'Private permission notes',
        })) : [];
    const query = {
      select: (columns: string) => { selections.set(table, columns); return query; },
      eq: (column: string, value: unknown) => { filters.push([table, column, value]); rows = rows.filter((row) => row[column] === value); return query; },
      in: (column: string, values: unknown[]) => { filters.push([table, column, values]); rows = rows.filter((row) => values.includes(row[column])); return query; },
      order: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return query;
  });
  return { selections, filters };
};

beforeEach(() => vi.clearAllMocks());

describe('published catalog discovery details', () => {
  it.each([
    ['free', ['free-icon']],
    ['paid', ['free-icon', 'paid-icon']],
    ['contributor', ['free-icon', 'paid-icon', 'contributor-icon']],
  ] as const)('shares public copy and normalized tags within %s visibility', async (access, expectedIds) => {
    const { selections, filters } = setupDatabase();
    const catalog = await getCardForgeCatalogManifest(access);
    expect(catalog.pipeline?.items.map((item) => item.id)).toEqual(expectedIds);
    for (const item of catalog.pipeline!.items) {
      expect(item).toMatchObject({ description: 'Use this icon for business contact details.', specialtyTags: ['business'], useCaseTags: ['business-card', 'event-badge'] });
      expect(item).not.toHaveProperty('source_notes');
      expect(item).not.toHaveProperty('contributor_email');
    }
    expect(filters).toContainEqual(['cardforge_asset_registry', 'status', 'published']);
    expect(selections.get('cardforge_contributor_asset_submissions')?.split(',')).toEqual(['id', 'lineage_id', 'source_payload', 'description', 'specialty_tags', 'use_case_tags']);
    expect(database.from.mock.calls.filter(([table]) => table === 'cardforge_contributor_asset_submissions')).toHaveLength(1);
    expect(JSON.stringify(catalog.pipeline)).not.toContain('private@example.test');
    expect(JSON.stringify(catalog.pipeline)).not.toContain('Private permission notes');
  });
});
