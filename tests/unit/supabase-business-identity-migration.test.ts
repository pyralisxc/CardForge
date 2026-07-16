import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const normalizedFile = (path: string): string => readFileSync(path, 'utf8')
  .toLowerCase()
  .replace(/\s+/g, ' ');

const migrationSql = (): string => {
  const migrationDirectory = resolve(process.cwd(), 'supabase/migrations');
  const files = readdirSync(migrationDirectory)
    .filter((file) => file.endsWith('_business_identity_foundation.sql'));

  expect(files).toHaveLength(1);
  return normalizedFile(resolve(migrationDirectory, files[0]));
};

describe('business identity foundation migration', () => {
  it('creates one structured, constrained CardForge identity row', () => {
    const sql = migrationSql();

    expect(sql).toContain('create table public.cardforge_business_identity');
    expect(sql).toContain("check (id = 'cardforge')");
    expect(sql).toContain('identity_version integer not null default 1');
    expect(sql).toContain("check (entity_type in ('sole_proprietor'))");
    expect(sql).toContain("check (assumed_business_name_status in ('unverified', 'registered'))");
    expect(sql).toContain("website_url ~ '^https://[^[:space:]/?#@]+(/[^[:space:]?#]*)?$'");
    expect(sql).toContain("'cardforge studio'");
    expect(sql).toContain("'cameron locke'");
    expect(sql).toContain("'oregon'");
    expect(sql).toContain("'united states'");
  });

  it('keeps identity private to server-owned service-role access', () => {
    const sql = migrationSql();

    expect(sql).toContain('enable row level security');
    expect(sql).toContain('revoke all on table public.cardforge_business_identity from public, anon, authenticated, service_role');
    expect(sql).toContain('grant select, insert, update on table public.cardforge_business_identity to service_role');
    expect(sql).not.toContain('create policy');
  });

  it('owns updated timestamps and monotonic versions in the database', () => {
    const sql = migrationSql();

    expect(sql).toContain('cardforge_business_identity_touch_updated_at');
    expect(sql).toContain('cardforge_increment_business_identity_version');
    expect(sql).toContain('old.identity_version >= 2147483647');
    expect(sql).toContain('new.identity_version := old.identity_version + 1');
  });

  it('preserves edited legal bodies while correcting active operator text', () => {
    const sql = migrationSql();
    const retiredOperator = ['neon', 'black interactive llc'].join(' ');

    expect(sql).toContain('regexp_replace(');
    expect(sql).toContain("where slug = 'privacy'");
    expect(sql).toContain("where slug = 'terms'");
    expect(sql).toContain("where slug = 'refund'");
    expect(sql).toContain("where slug in ('contact', 'developer-terms')");
    expect(sql).toContain("|| e'\\n\\n' || body");
    expect(sql).toContain('body not ilike');
    expect(sql).toContain('body ~*');
    expect(sql).not.toContain('body = case slug');
    expect(sql).not.toContain(retiredOperator);
    expect(sql).not.toContain("'creator-pool'");
  });

  it('keeps destructive cleanup outside the automatic migration path', () => {
    const automaticSql = migrationSql();
    const cleanupDirectory = resolve(process.cwd(), 'supabase/post-deploy');
    const cleanupSql = normalizedFile(resolve(
      cleanupDirectory,
      'drop_legacy_owner_identity_columns.sql',
    ));
    const instructions = normalizedFile(resolve(cleanupDirectory, 'README.md'));

    expect(automaticSql).not.toContain('drop column');
    expect(readdirSync(resolve(process.cwd(), 'supabase/migrations')))
      .not.toContain('drop_legacy_owner_identity_columns.sql');
    expect(cleanupSql).toContain('drop column business_name');
    expect(cleanupSql).toContain('drop column owner_name');
    expect(cleanupSql).toContain('drop column support_email');
    expect(cleanupSql).toContain('drop column support_phone');
    expect(cleanupSql).toContain('drop column website_url');
    expect(cleanupSql).not.toMatch(/drop (table|schema|database)/);
    expect(cleanupSql).toContain("brand_name = 'cardforge studio'");
    expect(cleanupSql).toContain("legal_operator_name = 'cameron locke'");
    expect(cleanupSql).toContain("entity_type = 'sole_proprietor'");
    expect(cleanupSql).toContain("jurisdiction_state = 'oregon'");
    expect(cleanupSql).toContain("jurisdiction_country = 'united states'");
    expect(cleanupSql).toContain("assumed_business_name_status = 'unverified'");
    expect(cleanupSql).not.toContain("assumed_business_name_status = 'registered'");
    expect(instructions).toContain('after the gate 1 code is deployed');
    expect(instructions).toContain('live verification');
    expect(instructions).toContain('do not run before');
    expect(instructions).toContain('documented verification');
    expect(instructions).toContain('re-review the sql guard');
  });
});
