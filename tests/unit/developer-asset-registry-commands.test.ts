import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import {
  archivePipelineRegistryAsset,
  DeveloperAssetRegistryCommandError,
  submitTemplateRevision,
  transitionDeveloperAssetStatus,
  upsertPipelineRegistryAsset,
} from '@/features/developer-assets/lib/developerAssetRegistryCommands';
import { getDeveloperProfileReferenceByEmail } from '@/features/developer-access/server';

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: vi.fn(),
}));
vi.mock('@/features/developer-access/server', () => ({
  getDeveloperProfileReferenceByEmail: vi.fn(),
}));

const mockedGetSupabaseServerClient = vi.mocked(getSupabaseServerClient);
const mockedGetDeveloperProfileReferenceByEmail = vi.mocked(getDeveloperProfileReferenceByEmail);

describe('developer asset registry commands', () => {
  beforeEach(() => {
    mockedGetSupabaseServerClient.mockReset();
    mockedGetDeveloperProfileReferenceByEmail.mockReset();
    process.env.CARDFORGE_PIPELINE_OWNER_EMAIL = 'owner@cardforges.com';
  });

  it('upserts a pipeline asset through one atomic database command', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'submission-1', error: null });
    mockedGetSupabaseServerClient.mockReturnValue({ rpc } as never);
    mockedGetDeveloperProfileReferenceByEmail.mockResolvedValue({
      developerId: 'owner-user-id',
      email: 'owner@cardforges.com',
    });

    await upsertPipelineRegistryAsset({
      assetId: 'starter-template',
      name: 'Starter Template',
      submissionAssetType: 'templates',
      registryAssetType: 'template',
      url: '/api/templates#starter-template',
      description: 'Maintained in the Forge Pipeline.',
      fileSizeBytes: 420,
      metadata: { template: { id: 'starter-template' } },
    });

    expect(rpc).toHaveBeenCalledWith('cardforge_upsert_pipeline_registry_asset', {
      p_asset_id: 'starter-template',
      p_name: 'Starter Template',
      p_submission_asset_type: 'templates',
      p_registry_asset_type: 'template',
      p_url: '/api/templates#starter-template',
      p_preview_url: '/api/templates#starter-template',
      p_description: 'Maintained in the Forge Pipeline.',
      p_developer_id: 'owner-user-id',
      p_developer_email: 'owner@cardforges.com',
      p_file_size_bytes: 420,
      p_source_mime_type: 'application/json',
      p_storage_bucket: null,
      p_storage_path: null,
      p_metadata: { template: { id: 'starter-template' } },
    });
  });

  it('archives pipeline submissions and registry visibility together', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    mockedGetSupabaseServerClient.mockReturnValue({ rpc } as never);

    await archivePipelineRegistryAsset('starter-template');

    expect(rpc).toHaveBeenCalledWith('cardforge_archive_pipeline_registry_asset', {
      p_asset_id: 'starter-template',
    });
  });

  it('submits a template revision with identity, expected version, and idempotency key', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{
        id: 'revision-1',
        status: 'submitted',
        base_revision_number: 2,
        revision_number: 3,
        target_registry_asset_id: 'starter-template',
      }],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const rpc = vi.fn().mockResolvedValue({ data: 'revision-1', error: null });
    mockedGetSupabaseServerClient.mockReturnValue({ rpc, from } as never);

    await expect(submitTemplateRevision({
      template: {
        id: 'starter-template',
        name: 'Starter Template',
        aspectRatio: '63:88',
        templateSource: 'default',
      },
      developerId: 'developer-1',
      developerEmail: 'developer@cardforges.com',
      expectedRevision: 2,
      submissionKey: 'save-attempt-1',
    })).resolves.toEqual({
      id: 'revision-1',
      status: 'submitted',
      baseRevision: 2,
      revisionNumber: 3,
      assetId: 'starter-template',
    });

    expect(rpc).toHaveBeenCalledWith('cardforge_submit_template_revision', expect.objectContaining({
      p_asset_id: 'starter-template',
      p_developer_id: 'developer-1',
      p_expected_revision: 2,
      p_submission_key: 'save-attempt-1',
    }));
  });

  it('turns stale base revisions into a recoverable conflict', async () => {
    mockedGetSupabaseServerClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'template_revision_conflict' } }),
    } as never);

    await expect(submitTemplateRevision({
      template: { id: 'starter-template', name: 'Starter Template', aspectRatio: '63:88' },
      developerId: 'developer-1',
      developerEmail: null,
      expectedRevision: 1,
      submissionKey: 'save-attempt-2',
    })).rejects.toEqual(expect.objectContaining<Partial<DeveloperAssetRegistryCommandError>>({
      status: 409,
    }));
  });

  it('uses the atomic transition RPC as the single status and registry write', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'developer-icons-asset-1', error: null });
    mockedGetSupabaseServerClient.mockReturnValue({ rpc } as never);

    await transitionDeveloperAssetStatus({
      submissionId: 'asset-1',
      status: 'published',
      ownerNote: 'Ready for creators',
      ownerAccessTierOverride: 'free',
      ownerAccessTierOverrideProvided: true,
      calculatedAccessTier: 'free',
      qualityScore: 92,
      tierDecisionReason: 'free_candidate',
      registryMetadata: { allowedTargets: ['template'] },
    });

    expect(rpc).toHaveBeenCalledWith('cardforge_transition_developer_asset', {
      p_submission_id: 'asset-1',
      p_status: 'published',
      p_owner_note: 'Ready for creators',
      p_owner_access_tier_override: 'free',
      p_has_owner_access_tier_override: true,
      p_calculated_access_tier: 'free',
      p_quality_score: 92,
      p_tier_decision_reason: 'free_candidate',
      p_registry_metadata: { allowedTargets: ['template'] },
    });
  });

  it('surfaces database failures instead of reporting a successful owner action', async () => {
    mockedGetSupabaseServerClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'registry update failed' } }),
    } as never);

    await expect(transitionDeveloperAssetStatus({
      submissionId: 'asset-1',
      status: 'archived',
      ownerNote: '',
      ownerAccessTierOverride: null,
      ownerAccessTierOverrideProvided: false,
      calculatedAccessTier: 'hidden',
      qualityScore: 0,
      tierDecisionReason: 'archived',
      registryMetadata: {},
    })).rejects.toEqual(expect.objectContaining<Partial<DeveloperAssetRegistryCommandError>>({
      message: 'Unable to update the developer submission and shared registry.',
      status: 500,
    }));
  });
});
