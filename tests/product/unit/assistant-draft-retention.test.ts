import { describe, expect, it } from 'vitest';

import { DEFAULT_MCP_ALLOWANCES, resolveMcpUsagePlanKey } from '@/features/mcp-usage/lib/mcpUsage';
import { normalizeSiteContentBlockInput } from '@/features/public-site/model/siteContent';

describe('assistant draft retention', () => {
  it('uses the approved plan windows and maps privileged accounts to Designer retention', () => {
    expect(DEFAULT_MCP_ALLOWANCES.slice(0, 3).map((plan) => plan.draftRetentionHours)).toEqual([12, 24, 48]);
    expect(resolveMcpUsagePlanKey({ accessMode: 'free', isOwner: true })).toBe('designer');
    expect(resolveMcpUsagePlanKey({ accessMode: 'contributor', isOwner: false })).toBe('designer');
  });

  it('requires editable retention copy to preserve the dynamic plan token', () => {
    expect(normalizeSiteContentBlockInput({
      slug: 'account.storage.working-drafts.retention',
      body: 'Working drafts use a {retention} active window. Visiting Account does not extend it.',
    })).toMatchObject({ ok: true });
    expect(normalizeSiteContentBlockInput({
      slug: 'account.storage.working-drafts.retention',
      body: 'Working drafts expire according to your plan.',
    })).toEqual({
      ok: false,
      message: 'This site copy must include the {retention} dynamic token.',
    });
  });
});
