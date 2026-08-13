import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DEFAULT_LEGAL_DOCUMENTS } from '@/features/legal/client';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260717010903_version_legal_publications.sql',
);
const retirementMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260811183544_retire_founder_beta.sql',
);
const experienceControlsMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260812153632_owner_experience_controls.sql',
);
const posthogPrivacyMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260812190233_document_posthog_interaction_analytics.sql',
);
const replayRemovalMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260813034733_remove_session_replay_from_privacy.sql',
);

const extractDollarQuoted = (sql: string, tag: string): string | undefined => (
  new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$`).exec(sql)?.[1]
);

describe('versioned legal publication migration', () => {
  it('converts the existing registry to immutable composite versions', async () => {
    const sql = (await readFile(migrationPath, 'utf8')).toLowerCase();

    expect(sql).toContain('add column if not exists version integer');
    expect(sql).toContain('add column if not exists effective_date date');
    expect(sql).toContain('add column if not exists business_identity_version integer');
    expect(sql).toContain('drop constraint if exists cardforge_legal_documents_pkey');
    expect(sql).toContain('primary key (slug, version)');
    expect(sql).toContain('published_at set not null');
    expect(sql).toContain("'creator-pass-terms'");
    expect(sql).toContain("'supporter-terms'");
    expect(sql).toContain("'accessibility'");
    expect(sql).toContain('on conflict (slug, version) do nothing');
  });

  it('preserves edited version-one bodies and binds them to the current identity', async () => {
    const sql = (await readFile(migrationPath, 'utf8')).toLowerCase();

    expect(sql).toContain('update public.cardforge_legal_documents');
    expect(sql).toContain('version = 1');
    expect(sql).toContain('effective_date = coalesce');
    expect(sql).toContain('published_at = coalesce');
    expect(sql).toContain('business_identity_version =');
    expect(sql).not.toContain("where slug = 'privacy'\nset body");
  });

  it('appends the reviewed Gate 2 documents as version two without erasing history', async () => {
    const sql = (await readFile(migrationPath, 'utf8')).toLowerCase();

    expect(sql).toContain('reviewed_gate_two_publications');
    expect(sql).toContain("'privacy',\n      2,\n      'privacy policy'");
    expect(sql).toContain('browser indexeddb');
    expect(sql).toContain("'creator-pool',\n      2,\n      'archived creator pool notice'");
    expect(sql).toContain('the creator pool concept is archived and inactive');
    expect(sql).toContain('reviewed.version,');
    expect(sql).toContain('on conflict (slug, version) do nothing');
  });

  it('publishes the exact reviewed repository bodies across the versioned migrations', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    const retirementSql = await readFile(retirementMigrationPath, 'utf8');
    const experienceControlsSql = await readFile(experienceControlsMigrationPath, 'utf8');
    const posthogPrivacySql = await readFile(posthogPrivacyMigrationPath, 'utf8');
    const replayRemovalSql = await readFile(replayRemovalMigrationPath, 'utf8');
    const tagBySlug = {
      privacy: 'privacy_reviewed',
      terms: 'terms_reviewed',
      'creator-pass-terms': 'creator_pass_reviewed',
      'supporter-terms': 'supporter_reviewed',
      refund: 'refund_reviewed',
      'developer-terms': 'developer_reviewed',
      contact: 'contact_reviewed',
      accessibility: 'accessibility_reviewed',
      'creator-pool': 'creator_pool_reviewed',
    } as const;

    for (const document of DEFAULT_LEGAL_DOCUMENTS) {
      if (document.slug === 'supporter-terms' || document.slug === 'refund') continue;
      if (document.slug === 'privacy') {
        const previousBody = extractDollarQuoted(experienceControlsSql, 'privacy_consent_controls');
        const oldMeasurement = extractDollarQuoted(posthogPrivacySql, 'old_measurement');
        const newMeasurement = extractDollarQuoted(posthogPrivacySql, 'new_measurement');
        const oldChoice = extractDollarQuoted(posthogPrivacySql, 'old_choice');
        const newChoice = extractDollarQuoted(posthogPrivacySql, 'new_choice');
        const oldReplayDisclosure = extractDollarQuoted(replayRemovalSql, 'old_replay_disclosure');
        const newEventDisclosure = extractDollarQuoted(replayRemovalSql, 'new_event_disclosure');
        expect(previousBody, document.slug).toBeDefined();
        expect(oldMeasurement, document.slug).toBeDefined();
        expect(newMeasurement, document.slug).toBeDefined();
        expect(oldChoice, document.slug).toBeDefined();
        expect(newChoice, document.slug).toBeDefined();
        expect(oldReplayDisclosure, document.slug).toBeDefined();
        expect(newEventDisclosure, document.slug).toBeDefined();
        const publishedBody = previousBody
          ?.replace(oldMeasurement ?? '', newMeasurement ?? '')
          .replace(oldChoice ?? '', newChoice ?? '')
          .replace(oldReplayDisclosure ?? '', newEventDisclosure ?? '');
        expect(publishedBody, document.slug).toBe(document.body);
        continue;
      }
      const isRetirementPublication = document.slug === 'contact';
      const tag = isRetirementPublication ? `${document.slug}_retired_demo` : tagBySlug[document.slug];
      const source = isRetirementPublication ? retirementSql : sql;
      expect(extractDollarQuoted(source, tag), document.slug).toBe(document.body);
    }
  });

  it('publishes atomically with identity-version and concurrency protection', async () => {
    const sql = (await readFile(migrationPath, 'utf8')).toLowerCase();

    expect(sql).toContain('create or replace function public.publish_cardforge_legal_document');
    expect(sql).toContain('security definer');
    expect(sql).toContain("set search_path = pg_catalog, public");
    expect(sql).toContain('for update');
    expect(sql).toContain('p_expected_identity_version');
    expect(sql).toContain('cardforge_business_identity_version_conflict');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('coalesce(max(version), 0) + 1');
    expect(sql).toContain('returning');
  });

  it('keeps the table and RPC server-only', async () => {
    const sql = (await readFile(migrationPath, 'utf8')).toLowerCase();

    expect(sql).toContain('alter table public.cardforge_legal_documents enable row level security');
    expect(sql).toContain('revoke all on table public.cardforge_legal_documents from public, anon, authenticated, service_role');
    expect(sql).toContain('grant select, insert on table public.cardforge_legal_documents to service_role');
    expect(sql).toContain('revoke execute on function public.publish_cardforge_legal_document');
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('grant execute on function public.publish_cardforge_legal_document');
    expect(sql).toContain('to service_role');
  });
});
