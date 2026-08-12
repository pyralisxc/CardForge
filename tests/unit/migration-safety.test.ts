import { describe, expect, it } from 'vitest';

import {
  findUnsafeMigrationChanges,
  parseMigrationChanges,
} from '../../scripts/check-migration-safety.mjs';

describe('migration safety guard', () => {
  it('accepts only newly added forward migrations', () => {
    const changes = parseMigrationChanges([
      'A\tsupabase/migrations/20260812052026_forward.sql',
      '??\tsupabase/migrations/20260812053000_untracked.sql',
      'M\tsrc/app/page.tsx',
    ].join('\n'));

    expect(findUnsafeMigrationChanges(changes)).toEqual([]);
  });

  it.each([
    ['M', 'modified'],
    ['D', 'deleted'],
    ['R100', 'renamed'],
  ])('rejects %s existing migration changes (%s)', (status) => {
    const paths = status.startsWith('R')
      ? 'supabase/migrations/old.sql\tsupabase/migrations/new.sql'
      : 'supabase/migrations/existing.sql';
    const changes = parseMigrationChanges(`${status}\t${paths}`);

    expect(findUnsafeMigrationChanges(changes)).toEqual(changes);
  });
});
