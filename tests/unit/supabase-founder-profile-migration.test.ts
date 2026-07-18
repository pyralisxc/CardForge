import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationSql = (): string => {
  const directory = resolve(process.cwd(), 'supabase/migrations');
  const files = readdirSync(directory).filter((file) => file.endsWith('_founder_profile_public_media.sql'));
  expect(files).toHaveLength(1);
  return readFileSync(resolve(directory, files[0]), 'utf8').toLowerCase().replace(/\s+/g, ' ');
};

describe('founder profile and public media migration', () => {
  it('creates one private service-role founder profile record', () => {
    const sql = migrationSql();

    expect(sql).toContain('create table public.cardforge_founder_profile');
    expect(sql).toContain("check (id = 'cameron-locke')");
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('revoke all on table public.cardforge_founder_profile from public, anon, authenticated, service_role');
    expect(sql).toContain('grant select, insert, update on table public.cardforge_founder_profile to service_role');
    expect(sql).not.toContain('create policy');
  });

  it('creates a public WebP-only portrait bucket with an eight-megabyte limit', () => {
    const sql = migrationSql();

    expect(sql).toContain("'cardforge-public-media'");
    expect(sql).toContain('file_size_limit');
    expect(sql).toContain('8388608');
    expect(sql).toContain("array['image/webp']");
    expect(sql).toContain('public = true');
  });

  it('updates the official playing-card payload in place to use artwork', () => {
    const sql = migrationSql();

    expect(sql).toContain("where asset_id = 'default-playing-card-theme'");
    expect(sql).toContain('"artwork"');
    expect(sql).toContain('"cardtitle"');
    expect(sql).not.toContain('"centermark"');
    expect(sql).not.toContain('\\"?\\"');
  });
});
