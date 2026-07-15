import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('legal identity migration', () => {
  it('identifies the operator and removes pre-launch billing copy', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/202607140005_legal_business_identity.sql'),
      'utf8',
    ).toLowerCase().replace(/\s+/g, ' ');
    expect(sql).toContain("business_name = 'neon black interactive llc'");
    expect(sql).toContain('self-service subscription billing');
    expect(sql).not.toContain('before public self-serve billing');
  });
});
