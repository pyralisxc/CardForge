import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  findRetiredPostCutoverReferences,
  findUnapprovedOwnerPresentationWrites,
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

  it('blocks post-cutover migrations from silently editing Owner-controlled presentation state', () => {
    expect(findUnapprovedOwnerPresentationWrites(
      'supabase/migrations/20261009000100_bad_content_update.sql',
      "update public.cardforge_site_content_blocks set body = 'new copy' where slug = 'landing.hero.headline';",
    )).toEqual(['cardforge_site_content_blocks']);

    expect(findUnapprovedOwnerPresentationWrites(
      'supabase/migrations/20261009000200_bad_plan_update.sql',
      "insert into public.cardforge_mcp_allowance_settings (plan_key, display_name) values ('creator', 'Creator');",
    )).toEqual(['cardforge_mcp_allowance_settings']);
  });

  it('allows schema-only Owner migrations and requires an explicit rationale for exceptional state writes', () => {
    expect(findUnapprovedOwnerPresentationWrites(
      'supabase/migrations/20261009000300_schema_only.sql',
      'alter table public.cardforge_owner_settings add column if not exists example_flag boolean;',
    )).toEqual([]);

    expect(findUnapprovedOwnerPresentationWrites(
      'supabase/migrations/20261009000400_explicit_transition.sql',
      [
        '-- CARDFORGE_OWNER_STATE_WRITE: seed the new presentation row only when it does not exist',
        "insert into public.cardforge_site_content_blocks (slug, body) values ('new.slug', 'Seed') on conflict do nothing;",
      ].join('\n'),
    )).toEqual([]);
  });

  it('keeps historical pre-cutover presentation migrations readable without retroactively invalidating them', () => {
    expect(findUnapprovedOwnerPresentationWrites(
      'supabase/migrations/20260902214500_complete_public_desk_truth.sql',
      "update public.cardforge_mcp_allowance_settings set description = 'legacy transition';",
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
  it('keeps official source for verified first-party fonts in the native Pipeline function', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261010030000_first_party_font_registry_source.sql'), 'utf8');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.cardforge_upsert_pipeline_registry_asset');
    expect(sql).toContain("p_registry_asset_type = 'font'");
    expect(sql).toContain("p_metadata ->> 'sourceKind' = 'reviewed-first-party-original'");
    expect(sql).toContain("p_storage_bucket = 'cardforge-contributor-assets'");
    expect(sql).toContain("case when reviewed_first_party_font then 'official' else 'contributor' end");
    expect(sql).toContain("and p_metadata ->> 'reviewedBatchDigest' ~ '^[a-f0-9]{64}$';");
    expect(sql).toContain("and p_metadata ->> 'sourceGitBlobSha' ~ '^[a-f0-9]{40}$'");
    expect(sql).toContain('on conflict (asset_id) do update');
    expect(sql).not.toContain('library_source = excluded.library_source');
    expect(sql).toContain('to service_role;');
    expect(sql).not.toMatch(/update public\\.cardforge_asset_registry\\s+set/iu);
  });

});