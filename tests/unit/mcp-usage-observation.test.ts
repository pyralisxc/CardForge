import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_MCP_ALLOWANCES,
  isMcpAvailableForAccount,
  resolveMcpUsagePlanKey,
} from '@/features/mcp-usage/lib/mcpUsage';
import { observeMcpToolExecution } from '@/features/mcp-usage/server/mcpUsageStore';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('MCP usage observation', () => {
  it('maps current CardForge access into the future-facing usage tiers without changing entitlement', () => {
    expect(resolveMcpUsagePlanKey({ accessMode: 'free', isOwner: false })).toBe('free');
    expect(resolveMcpUsagePlanKey({ accessMode: 'paid', isOwner: false })).toBe('creator');
    expect(resolveMcpUsagePlanKey({ accessMode: 'paid', paidPlan: 'designer', isOwner: false })).toBe('designer');
    expect(resolveMcpUsagePlanKey({ accessMode: 'dev', isOwner: false })).toBe('designer');
    expect(resolveMcpUsagePlanKey({ accessMode: 'free', isOwner: true })).toBe('designer');
    expect(DEFAULT_MCP_ALLOWANCES.map(({ monthlyActionLimit }) => monthlyActionLimit)).toEqual([
      30,
      300,
      1_000,
      10_000,
    ]);
    expect(DEFAULT_MCP_ALLOWANCES.map(({ displayName }) => displayName)).toEqual([
      'Free',
      'Creator Pass',
      'Designer Pass',
      'Business Solutions',
    ]);
    expect(DEFAULT_MCP_ALLOWANCES.map(({ priceLabel }) => priceLabel)).toEqual([
      '$0',
      '$8.99',
      '$19.99',
      'Custom',
    ]);
    expect(DEFAULT_MCP_ALLOWANCES.map(({ priceNote }) => priceNote)).toEqual([
      'No card required',
      'per month',
      'per month',
      'Built around your team',
    ]);
    expect(DEFAULT_MCP_ALLOWANCES.find(({ planKey }) => planKey === 'designer')?.isVisible).toBe(true);
    const customerFacingFeatures = DEFAULT_MCP_ALLOWANCES.map(({ featureSummary }) => featureSummary).join('\n');
    expect(customerFacingFeatures).toContain('ChatGPT plugin actions');
    expect(customerFacingFeatures).toContain('private ChatGPT plugin workspace');
    expect(customerFacingFeatures).toContain('Portable CardForge Studio project files');
  });

  it('makes MCP available to every signed-in personal account without a plan switch', () => {
    expect(isMcpAvailableForAccount({ isSignedIn: true })).toBe(true);
    expect(isMcpAvailableForAccount({ isSignedIn: false })).toBe(false);
    expect(DEFAULT_MCP_ALLOWANCES.every((allowance) => !('mcpEnabled' in allowance))).toBe(true);
    expect(DEFAULT_MCP_ALLOWANCES.map(({ featureSummary }) => featureSummary).join('\n')).not.toContain('when enabled');
  });

  it('counts only successful user-visible mutations and never lets telemetry break the tool result', async () => {
    const record = vi.fn().mockResolvedValue(true);
    const result = await observeMcpToolExecution({
      ownerUserId: 'user_123',
      toolName: 'create_editable_template',
      input: { title: 'Test card' },
      execute: async () => ({ structuredContent: { revision: 1 } }),
      record,
    });

    expect(result).toEqual({ structuredContent: { revision: 1 } });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      actionUnits: 1,
      ownerUserId: 'user_123',
      succeeded: true,
      toolName: 'create_editable_template',
    }));

    await expect(observeMcpToolExecution({
      ownerUserId: 'user_123',
      toolName: 'update_editable_template',
      input: {},
      execute: async () => { throw new Error('revision conflict'); },
      record,
    })).rejects.toThrow('revision conflict');
    expect(record).toHaveBeenLastCalledWith(expect.objectContaining({
      actionUnits: 0,
      succeeded: false,
    }));

    await expect(observeMcpToolExecution({
      ownerUserId: 'user_123',
      toolName: 'search_studio_library',
      input: { query: 'arcane' },
      execute: async () => 'available',
      record: vi.fn().mockRejectedValue(new Error('telemetry unavailable')),
    })).resolves.toBe('available');
  });

  it('keeps usage records private, aggregated, and observation-only', () => {
    const migration = readSource('supabase/migrations/20260820060736_mcp_usage_observation.sql');

    expect(migration).toContain('cardforge_mcp_usage_daily');
    expect(migration).toContain('cardforge_mcp_allowance_settings');
    expect(migration).toContain('security invoker');
    expect(migration).toContain('revoke all privileges');
    expect(migration).toContain('to service_role');
    expect(migration).not.toContain('mcp_enabled');
    expect(migration).toContain("'Business Solutions'");
    expect(migration).toContain('price_label');
    expect(migration).toContain('price_note');
    const aggregateColumns = migration.match(/create table public\.cardforge_mcp_usage_daily \(([\s\S]*?)\n\);/)?.[1] ?? '';
    expect(aggregateColumns).not.toMatch(/prompt|card_content|document_payload/i);
  });
});
