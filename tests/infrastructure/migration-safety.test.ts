import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  findRetiredPostCutoverReferences,
  findUnsafeMigrationChanges,
  isApprovedBootstrapRepair,
  parseMigrationChanges,
} from '../../scripts/check-migration-safety.mjs';

describe('migration safety guard', () => {
  it('accepts only newly added forward migrations', () => {
    const changes = parseMigrationChanges([
      'A\tsupabase/migrations/20260812052026_forward.sql',
      '??\tsupabase/migrations/20260812053000_untracked.sql',
      'M\tsrc/app/page.tsx',
    ].join('\n'));

    expect(findUnsafeMigrationChanges(changes)).toEqual([]);
  });

  it.each([
    ['M', 'modified'],
    ['D', 'deleted'],
    ['R100', 'renamed'],
  ])('rejects %s existing migration changes (%s)', (status) => {
    const paths = status.startsWith('R')
      ? 'supabase/migrations/old.sql\tsupabase/migrations/new.sql'
      : 'supabase/migrations/existing.sql';
    const changes = parseMigrationChanges(`${status}\t${paths}`);

    expect(findUnsafeMigrationChanges(changes)).toEqual(changes);
  });

  it('accepts only the hash-locked fresh-project bootstrap repairs', () => {
    const approved = parseMigrationChanges('M\tsupabase/migrations/202607140001_harden_privileged_functions.sql')[0]!;
    const unrelated = parseMigrationChanges('M\tsupabase/migrations/202607140004_billing_event_ledger.sql')[0]!;

    expect(isApprovedBootstrapRepair(process.cwd(), approved)).toBe(true);
    expect(isApprovedBootstrapRepair(process.cwd(), unrelated)).toBe(false);
  });

  it('rejects retired Developer tables in post-cutover migrations', () => {
    expect(findRetiredPostCutoverReferences(
      'supabase/migrations/20260923175630_expand_pipeline_catalog_capacity.sql',
      'update public.cardforge_developer_program_settings set updated_at = now();',
    )).toEqual(['cardforge_developer_program_settings']);
    expect(findRetiredPostCutoverReferences(
      'supabase/migrations/20260923175630_expand_pipeline_catalog_capacity.sql',
      'update public.cardforge_contributor_program_settings set updated_at = now();',
    )).toEqual([]);
    expect(findRetiredPostCutoverReferences(
      'supabase/migrations/20260824000100_legacy_grants.sql',
      'grant all on public.cardforge_developer_program_settings to service_role;',
    )).toEqual([]);
  });

  it('syncs an owner-decided revision after rebalance can move it into retention trash', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260923194000_sync_archived_pipeline_registry.sql'),
      'utf8',
    );
    const rebalance = migration.indexOf('changed_count := public.cardforge_rebalance_contributor_asset_pipeline');
    const sync = migration.indexOf('perform public.cardforge_sync_contributor_asset_registry(p_submission_id)');

    expect(rebalance).toBeGreaterThan(-1);
    expect(sync).toBeGreaterThan(rebalance);
    expect(migration).toContain('where id = p_submission_id\n    and purge_state is null;');
    expect(migration).toContain("where submission.status in ('archived', 'rejected')");
    expect(migration).toContain("and registry.status = 'published'");
  });
});
