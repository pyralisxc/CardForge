import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260812190233_document_posthog_interaction_analytics.sql'),
  'utf8',
).toLowerCase().replace(/\s+/gu, ' ');
const replayRemovalMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260813034733_remove_session_replay_from_privacy.sql'),
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

describe('session replay removal privacy publication migration', () => {
  it('publishes a forward, atomic, concurrency-safe legal version', () => {
    expect(replayRemovalMigration).toContain('begin;');
    expect(replayRemovalMigration).toContain('commit;');
    expect(replayRemovalMigration).toContain('pg_advisory_xact_lock');
    expect(replayRemovalMigration).toContain('for update');
    expect(replayRemovalMigration).toContain('current_publication.version + 1');
    expect(replayRemovalMigration).toContain('insert into public.cardforge_legal_documents');
    expect(replayRemovalMigration).not.toContain('update public.cardforge_legal_documents');
  });

  it('replaces only the exact replay disclosure and preserves owner-authored copy', () => {
    expect(replayRemovalMigration).toContain('position(old_replay_disclosure in current_publication.body) = 0');
    expect(replayRemovalMigration).toContain("raise exception 'cardforge_privacy_publication_changed_before_replay_removal'");
    expect(replayRemovalMigration).toContain('replace(current_publication.body, old_replay_disclosure, new_event_disclosure)');
  });

  it('documents event-only PostHog measurement with no page recording', () => {
    expect(replayRemovalMigration).toContain('cardforge does not use posthog session replay');
    expect(replayRemovalMigration).toContain('only the allow-listed event properties described above');
    expect(replayRemovalMigration).toContain('does not receive recordings of page content');
  });
});
