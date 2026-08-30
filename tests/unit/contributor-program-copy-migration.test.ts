import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260830113000_refresh_contributor_program_copy.sql'),
  'utf8',
);

describe('contributor program copy migration', () => {
  it('replaces only the untouched developer-program seed copy', () => {
    expect(migration).toContain("('developer.meta.title', 'CardForge Developer Program')");
    expect(migration).toContain("('developer.hero.eyebrow', 'Developer Program')");
    expect(migration).toContain("when 'developer.meta.title' then 'CardForge Contributor Program'");
    expect(migration).toContain("when 'developer.hero.eyebrow' then 'Contributor Program'");
    expect(migration).not.toContain('delete from');
    expect(migration).not.toContain('drop table');
    expect(migration).not.toContain('drop column');
  });
});
