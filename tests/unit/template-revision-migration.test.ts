import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260812172450_add_template_revision_workflow.sql'),
  'utf8',
).toLowerCase();

describe('template revision migration', () => {
  it('uses a forward-only atomic and idempotent revision workflow', () => {
    expect(migration).toContain('begin;');
    expect(migration).toContain('commit;');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('submission_key');
    expect(migration).toContain('developer_id,\n    target_registry_asset_id,\n    submission_key');
    expect(migration).toContain('template_revision_conflict');
    expect(migration).toContain('source_payload');
    expect(migration).toContain("'template', submission.source_payload");
  });

  it('keeps privileged functions service-role only', () => {
    expect(migration).toContain('security invoker');
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('to service_role');
    expect(migration).not.toContain('security definer');
  });
});
