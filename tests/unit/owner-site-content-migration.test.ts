import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260821143500_owner_site_content_group_controls.sql'),
  'utf8',
);
const contributorCutover = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260831015135_contributor_cold_cut.sql'),
  'utf8',
);

describe('owner site content group migration', () => {
  it('expands the existing content control-plane allowlist without rewriting user data', () => {
    expect(migration).toContain("^(shell|landing|plans|account|about|founder|developer|roadmap|sharing)");
    expect(migration).toContain('cardforge_site_content_blocks_slug_check');
    expect(migration).toContain('cardforge_site_content_proposals_slug_check');
    expect(migration).not.toContain('delete from');
    expect(migration).not.toContain('drop table');
    expect(migration).not.toContain('drop column');
    expect(contributorCutover).toContain("^(shell|landing|plans|account|about|founder|contributor|roadmap|sharing)");
  });
});
