import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('repository security defaults', () => {
  it('does not publish the retired privileged owner identity', () => {
    const files = [
      'AGENTS.md',
      'src/app/api/templates/route.ts',
      'src/app/api/styles/route.ts',
      'scripts/sync-pipeline-defaults.mjs',
      'supabase/migrations/202605220003_owner_console.sql',
    ];

    for (const file of files) {
      expect(readFileSync(join(process.cwd(), file), 'utf8').toLowerCase()).not.toContain('cameron.r.locke96');
    }
  });
});
