import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_MCP_ALLOWANCES,
  isMcpAvailableForAccount,
  resolveMcpUsagePlanKey,
} from '@/features/mcp-usage/lib/mcpUsage';
import { observeMcpToolExecution } from '@/features/mcp-usage/server/mcpUsageStore';

describe('MCP usage observation', () => {
  it('maps account access to usage tiers without changing sign-in entitlement', () => {
    expect(resolveMcpUsagePlanKey({ accessMode: 'free', isOwner: false })).toBe('free');
    expect(resolveMcpUsagePlanKey({ accessMode: 'paid', isOwner: false })).toBe('creator');
    expect(resolveMcpUsagePlanKey({ accessMode: 'paid', paidPlan: 'designer', isOwner: false })).toBe('designer');
    expect(resolveMcpUsagePlanKey({ accessMode: 'contributor', isOwner: false })).toBe('designer');
    expect(resolveMcpUsagePlanKey({ accessMode: 'free', isOwner: true })).toBe('designer');
    expect(isMcpAvailableForAccount({ isSignedIn: true })).toBe(true);
    expect(isMcpAvailableForAccount({ isSignedIn: false })).toBe(false);
    expect(DEFAULT_MCP_ALLOWANCES.map(({ monthlyActionLimit }) => monthlyActionLimit)).toEqual([30, 300, 1_000, 10_000]);
  });

  it('counts successful mutations without letting telemetry break tool results', async () => {
    const record = vi.fn().mockResolvedValue(true);
    await expect(observeMcpToolExecution({
      ownerUserId: 'user_123',
      toolName: 'create_editable_template',
      input: { title: 'Test card' },
      execute: async () => ({ structuredContent: { revision: 1 } }),
      record,
    })).resolves.toEqual({ structuredContent: { revision: 1 } });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ actionUnits: 1, succeeded: true }));

    await expect(observeMcpToolExecution({
      ownerUserId: 'user_123',
      toolName: 'search_studio_library',
      input: { query: 'arcane' },
      execute: async () => 'available',
      record: vi.fn().mockRejectedValue(new Error('telemetry unavailable')),
    })).resolves.toBe('available');
  });
});
