import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260812190233_document_posthog_interaction_analytics.sql'),
  'utf8',
).toLowerCase().replace(/\s+/gu, ' ');

describe('PostHog analytics privacy publication migration', () => {
  it('publishes a forward, atomic, concurrency-safe legal version', () => {
    expect(migration).toContain('begin;');
    expect(migration).toContain('commit;');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('for update');
    expect(migration).toContain('current_publication.version + 1');
    expect(migration).toContain('insert into public.cardforge_legal_documents');
    expect(migration).not.toContain('update public.cardforge_legal_documents');
  });

  it('preserves owner-authored copy unless both exact prior analytics passages match', () => {
    expect(migration).toContain('position(old_measurement in current_publication.body) = 0');
    expect(migration).toContain('position(old_choice in current_publication.body) = 0');
    expect(migration).toContain("raise exception 'cardforge_privacy_publication_changed_before_posthog_cutover'");
    expect(migration).toContain('replace(replace(current_publication.body, old_measurement, new_measurement), old_choice, new_choice)');
  });

  it('documents masked public replay and private-workspace exclusion', () => {
    expect(migration).toContain('posthog uses an anonymous identifier kept only in browser session storage');
    expect(migration).toContain('all visible text and form inputs are masked in the browser');
    expect(migration).toContain('studio, sign-in, account, profile, owner, and developer-cockpit pages are never recorded');
  });
});
