import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20260719100604_make_roadmap_financials_auditable.sql';

describe('roadmap financial accuracy migration', () => {
  it('replaces speculative targets with sourced provider expenses and planning settings', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).not.toContain('drop column if exists target_mrr_cents');
    expect(sql).toContain('roadmap_estimated_tax_percent integer not null default 30');
    expect(sql).toContain('roadmap_operating_reserve_percent integer not null default 20');
    expect(sql).toContain("monthly_cost_cents = 2500");
    expect(sql).toContain("expense_source_url = 'https://supabase.com/pricing'");
    expect(sql).toContain("expense_source_url = 'https://vercel.com/pricing'");
    expect(sql).toContain("expense_source_url = 'https://resend.com/pricing'");
    expect(sql).toContain("expense_source_url = 'https://clerk.com/pricing'");
    expect(sql).toContain("and item_type = 'roi_checkpoint'\n  and title = 'Account recovery and safety tooling'");
    expect(sql).not.toContain("title in ('Account recovery and safety tooling', 'Clerk Pro authentication controls')");
    expect(sql).toContain('cardforge_roadmap_items_expense_checkpoint_check');
  });
});
