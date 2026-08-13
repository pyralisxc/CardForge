import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260813181636_campaign_media_retention.sql'),
  'utf8',
).toLowerCase().replace(/\s+/g, ' ');

describe('campaign media retention migration', () => {
  it('keeps archive reversible and permanent deletion recoverable', () => {
    expect(migration).toContain('add column if not exists pre_archive_review_state');
    expect(migration).toContain('add column if not exists purge_state');
    expect(migration).toContain('cardforge_set_campaign_media_archived');
    expect(migration).toContain('cardforge_prepare_campaign_media_purge');
    expect(migration).toContain('cardforge_finalize_campaign_media_purge');
    expect(migration).not.toContain('cardforge_cancel_campaign_media_purge');
  });

  it('lets the owner delete any media and removes attachments before its derivative lineage', () => {
    const attachmentDelete = migration.indexOf('delete from public.cardforge_social_campaign_media_attachments');
    const derivativeDelete = migration.indexOf('delete from public.cardforge_campaign_media_derivatives');
    const mediaDelete = migration.indexOf('delete from public.cardforge_campaign_media where');
    expect(attachmentDelete).toBeGreaterThan(-1);
    expect(derivativeDelete).toBeGreaterThan(attachmentDelete);
    expect(mediaDelete).toBeGreaterThan(derivativeDelete);
    expect(migration).not.toContain('campaign_media_public_history_must_be_archived');
    expect(migration).not.toContain('campaign_media_still_attached');
  });

  it('keeps all retention commands service-role-only', () => {
    for (const signature of [
      'cardforge_set_campaign_media_archived(uuid, boolean, text)',
      'cardforge_prepare_campaign_media_purge(uuid, text)',
      'cardforge_finalize_campaign_media_purge(uuid)',
    ]) {
      expect(migration).toContain(`revoke execute on function public.${signature} from public, anon, authenticated`);
      expect(migration).toContain(`grant execute on function public.${signature} to service_role`);
    }
  });
});
