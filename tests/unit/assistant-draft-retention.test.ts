import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_MCP_ALLOWANCES, resolveMcpUsagePlanKey } from '@/features/mcp-usage/lib/mcpUsage';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('assistant draft retention', () => {
  const migration = readSource('supabase/migrations/20260821010756_assistant_draft_retention.sql');
  const worker = readSource('supabase/functions/purge-assistant-drafts/index.ts');
  const storageLibrary = readSource('src/features/storage-management/components/AssistantDraftLibrary.tsx');
  const planChoiceGrid = readSource('src/features/mcp-usage/components/PlanChoiceGrid.tsx');

  it('uses the approved plan windows and maps owner/developer accounts to Designer retention', () => {
    expect(DEFAULT_MCP_ALLOWANCES.slice(0, 3).map((plan) => plan.draftRetentionHours)).toEqual([12, 24, 48]);
    expect(resolveMcpUsagePlanKey({ accessMode: 'free', isOwner: true })).toBe('designer');
    expect(resolveMcpUsagePlanKey({ accessMode: 'dev', isOwner: false })).toBe('designer');
    expect(planChoiceGrid).toContain('plan.draftRetentionHours');
  });

  it('tracks real activity without letting account listing extend a draft', () => {
    expect(migration).toContain('cardforge_touch_studio_document');
    expect(migration).toContain('last_activity_at = pg_catalog.now()');
    expect(migration).toContain('cardforge_apply_studio_document_retention');
    expect(storageLibrary).toContain('visiting this page does not');
    expect(storageLibrary).toContain("'plan-specific'");
    expect(storageLibrary).not.toContain("?? 'plan'}-hour");
    expect(migration).toContain('returning expires_at into current_deadline');
    expect(readSource('src/features/studio-documents/server/studioDocumentStore.ts'))
      .toContain(".gt('expires_at', new Date().toISOString())");
  });

  it('backfills legacy drafts with a protected deadline', () => {
    expect(migration).toContain('retention_hours = coalesce(retention_hours, 48)');
    expect(migration).toContain("retention_grace_until = coalesce(retention_grace_until, pg_catalog.now() + interval '48 hours')");
    expect(migration).not.toMatch(/pg_catalog\.(?:coalesce|greatest)/u);
    expect(migration).toContain("pg_catalog.now() + interval '48 hours'");
    expect(migration).toContain('alter column expires_at set not null');
  });

  it('provides recoverable trash and retry-safe permanent cleanup', () => {
    expect(migration).toContain("purge_after = pg_catalog.now() + interval '24 hours'");
    expect(migration).toContain('for update skip locked');
    expect(migration).toContain("purge_state = 'processing'");
    expect(migration).toContain('cardforge_release_studio_document_purge');
    expect(worker.indexOf('.remove(paths)')).toBeLessThan(worker.indexOf('cardforge_finalize_studio_document_purge'));
    expect(worker).toContain('cardforge_release_studio_document_purge');
    expect(readSource('src/features/studio-documents/server/studioDocumentAssetStore.ts'))
      .not.toContain('removeUnreferencedStudioDocumentAssets');
    expect(storageLibrary).toContain('Recoverable trash');
    expect(storageLibrary).toContain('Restore draft');
  });

  it('keeps retention functions server-only and requires custom worker authorization', () => {
    expect(migration).toContain('security invoker');
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('to service_role');
    expect(readSource('supabase/config.toml')).toContain('verify_jwt = false');
    expect(worker).not.toContain('SUPABASE_ANON_KEY');
    expect(worker).toContain('x-cardforge-cron-secret');
    expect(migration).toContain("'apikey', (");
    expect(migration).not.toContain("'Authorization', 'Bearer '");
    expect(worker.indexOf('cardforge_authorize_assistant_draft_retention'))
      .toBeLessThan(worker.indexOf('cardforge_expire_studio_documents'));
  });
});
