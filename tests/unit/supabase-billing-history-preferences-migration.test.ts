import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/202607150002_billing_history_preferences.sql',
);

describe('billing history preferences migration', () => {
  it('adds constrained server-owned display preferences without public grants', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('billing_checkout_history_limit');
    expect(sql).toContain('default 500');
    expect(sql).toContain('between 1 and 500');
    expect(sql).toContain('billing_checkout_history_cleared_before');
    expect(sql).toContain('timestamptz');
    expect(sql).not.toMatch(/grant\s+.+\s+to\s+(public|anon|authenticated)/);
  });
});
