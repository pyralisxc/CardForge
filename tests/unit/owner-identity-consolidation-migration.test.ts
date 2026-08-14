import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260814220651_consolidate_owner_identity.sql'),
  'utf8',
).toLowerCase().replace(/\s+/g, ' ');

describe('owner identity consolidation migration', () => {
  it('fails closed unless the canonical owner and reviewed proxy identities match', () => {
    expect(migration).toContain('canonical_owner_profile_missing');
    expect(migration).toContain('legacy_owner_identity_mismatch');
    expect(migration).toContain('unreviewed_development_proxy_identity');
    expect(migration).toContain('development_proxy_has_financial_or_entitlement_history');
  });

  it('merges one-person votes before removing proxy profiles', () => {
    expect(migration).toContain('on conflict (submission_id, developer_id) do update');
    expect(migration).toContain('on conflict (item_id, user_id) do update');
    expect(migration).toContain("perform public.cardforge_rebalance_developer_asset_pipeline( 'user_3gj7v9nhlhde7alqvisepit3tmg' )");
    expect(migration.indexOf('delete from public.cardforge_developer_profiles'))
      .toBeGreaterThan(migration.indexOf('cardforge_rebalance_developer_asset_pipeline'));
  });

  it('moves storage references, normalizes visible attribution, and leaves one audit event', () => {
    expect(migration).toContain('canonical_owner_storage_copy_missing');
    expect(migration).toContain('canonical_owner_storage_copy_mismatch');
    expect(migration).toContain('user_3gj7v9nhlhde7alqvisepit3tmg/templates/1786597290358-arcane-playing-card-template-9nsubdfm.json');
    expect(migration).toContain("'{style,contributorname}'");
    expect(migration).toContain("'{template,templatecontributorname}'");
    expect(migration).toContain("'identity.development_proxies.consolidated'");
    expect(migration).toContain("'pyralis cameron'");
    expect(migration).toContain('development_proxy_attribution_remains');
    expect(migration).toContain('development_proxy_registry_provenance_remains');
  });

  it('preserves raw activity while aliasing and durably retiring proxy identities', () => {
    expect(migration).toContain('create table if not exists public.cardforge_identity_aliases');
    expect(migration).toContain('cardforge_prevent_retired_identity_recreation');
    expect(migration).toContain('revoke execute on function public.cardforge_prevent_retired_identity_recreation() from public, anon, authenticated');
    expect(migration).not.toContain('update public.cardforge_owner_activity set');
    expect(migration).not.toContain('delete from public.cardforge_owner_activity');
    expect(migration).toContain('update public.cardforge_campaign_media_derivatives set approved_by');
  });
});
