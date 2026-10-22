import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261022052800_allow_jpeg_social_media_derivatives.sql'),
  'utf8',
);

describe('social public media JPEG compatibility migration', () => {
  it('adds JPEG without weakening the existing public, size, or WebP contract', () => {
    expect(migration).toMatch(/where id = 'cardforge-social-media'\s+for update/iu);
    expect(migration).toContain('social_bucket.public is distinct from true');
    expect(migration).toContain('social_bucket.file_size_limit is distinct from 12582912');
    expect(migration).toContain("'image/webp' = any(social_bucket.allowed_mime_types)");
    expect(migration).toContain("array['image/jpeg']::text[]");
    expect(migration).toContain('array_agg(distinct mime_type order by mime_type)');
    expect(migration).toContain("and public is true");
    expect(migration).toContain('and file_size_limit = 12582912');
    expect(migration).toContain("'image/webp' = any(allowed_mime_types)");
    expect(migration).toContain("'image/jpeg' = any(allowed_mime_types)");
    expect(migration).not.toContain('cardforge-social-sources');
  });

  it('changes only allowed_mime_types on the exact social media bucket', () => {
    const update = migration.match(
      /update storage\.buckets([\s\S]*?)where id = 'cardforge-social-media';/iu,
    )?.[1];
    expect(update).toBeDefined();
    expect(update).toMatch(/set allowed_mime_types\s*=/iu);
    expect(update).not.toMatch(/\b(public|file_size_limit|name)\s*=/iu);
  });

  it('is a new transaction-wrapped migration and refuses unexpected bucket configuration', () => {
    expect(migration.trimStart().startsWith('begin;')).toBe(true);
    expect(migration.trimEnd().endsWith('commit;')).toBe(true);
    expect(migration).toContain('cardforge_social_media_bucket_missing');
    expect(migration).toContain('cardforge_social_media_bucket_visibility_mismatch');
    expect(migration).toContain('cardforge_social_media_bucket_size_limit_mismatch');
    expect(migration).toContain('cardforge_social_media_bucket_webp_contract_mismatch');
    expect(migration).toContain('cardforge_social_media_bucket_jpeg_contract_failed');
  });
});
