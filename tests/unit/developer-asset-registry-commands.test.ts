import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import {
  archivePipelineRegistryAsset,
  castDeveloperAssetVote,
  DeveloperAssetRegistryCommandError,
  saveDeveloperProgramSettings,
  setDeveloperAssetOwnerOverride,
  purgeDeveloperAssetSubmission,
  publishOwnerTemplateRevision,
  submitTemplateRevision,
  upsertPipelineRegistryAsset,
} from '@/features/developer-assets/lib/developerAssetRegistryCommands';
import { DEFAULT_DEVELOPER_PROGRAM_SETTINGS } from '@/features/developer-assets/lib/developerAssets';
import { getUniqueActiveDeveloperProfileReferenceByEmail } from '@/features/developer-access/server';

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: vi.fn(),
}));
vi.mock('@/features/developer-access/server', () => ({
  getUniqueActiveDeveloperProfileReferenceByEmail: vi.fn(),
}));

const mockedGetSupabaseServerClient = vi.mocked(getSupabaseServerClient);
const mockedGetDeveloperProfileReferenceByEmail = vi.mocked(getUniqueActiveDeveloperProfileReferenceByEmail);

describe('developer asset registry commands', () => {
  beforeEach(() => {
    mockedGetSupabaseServerClient.mockReset();
    mockedGetDeveloperProfileReferenceByEmail.mockReset();
    process.env.CARDFORGE_OWNER_ACCOUNT_EMAILS = 'owner@cardforges.com';
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

  it('refuses shared-library writes when the owner publishing identity is ambiguous', async () => {
    process.env.CARDFORGE_OWNER_ACCOUNT_EMAILS = 'owner@cardforges.com,legacy@cardforges.com';

    await expect(upsertPipelineRegistryAsset({
      assetId: 'starter-template',
      name: 'Starter Template',
      submissionAssetType: 'templates',
      registryAssetType: 'template',
      url: '/api/templates#starter-template',
      description: 'Maintained in the Forge Pipeline.',
      fileSizeBytes: 420,
      metadata: { template: { id: 'starter-template' } },
    })).rejects.toEqual(expect.objectContaining<Partial<DeveloperAssetRegistryCommandError>>({
      status: 503,
    }));

    expect(mockedGetDeveloperProfileReferenceByEmail).not.toHaveBeenCalled();
  });

  it('refuses shared-library writes without one active matching owner profile', async () => {
    mockedGetDeveloperProfileReferenceByEmail.mockResolvedValue(null);

    await expect(upsertPipelineRegistryAsset({
      assetId: 'starter-template',
      name: 'Starter Template',
      submissionAssetType: 'templates',
      registryAssetType: 'template',
      url: '/api/templates#starter-template',
      description: 'Maintained in the Forge Pipeline.',
      fileSizeBytes: 420,
      metadata: { template: { id: 'starter-template' } },
    })).rejects.toEqual(expect.objectContaining<Partial<DeveloperAssetRegistryCommandError>>({
      status: 503,
    }));
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

  it('publishes an owner Template revision through one atomic database command', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{
        id: 'revision-4',
        status: 'published',
        base_revision_number: 3,
        revision_number: 4,
        target_registry_asset_id: 'starter-template',
      }],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const rpc = vi.fn().mockResolvedValue({ data: 'revision-4', error: null });
    mockedGetSupabaseServerClient.mockReturnValue({ rpc, from } as never);

    await expect(publishOwnerTemplateRevision({
      template: {
        id: 'starter-template',
        name: 'Starter Template',
        aspectRatio: '63:88',
        templateSource: 'default',
      },
      developerId: 'owner-user-id',
      developerEmail: 'owner@cardforges.com',
      expectedRevision: 3,
      submissionKey: 'owner-save-4',
    })).resolves.toMatchObject({
      id: 'revision-4',
      status: 'published',
      revisionNumber: 4,
    });

    expect(rpc).toHaveBeenCalledWith('cardforge_publish_owner_template_revision', expect.objectContaining({
      p_asset_id: 'starter-template',
      p_developer_id: 'owner-user-id',
      p_expected_revision: 3,
      p_submission_key: 'owner-save-4',
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

  it('casts a vote and applies automatic ranking through one atomic command', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 1, error: null });
    mockedGetSupabaseServerClient.mockReturnValue({ rpc } as never);

    await castDeveloperAssetVote({
      submissionId: 'asset-1',
      developerId: 'dev-1',
      voteValue: 'positive',
      ownerDeveloperId: null,
    });

    expect(rpc).toHaveBeenCalledWith('cardforge_cast_developer_asset_vote', {
      p_submission_id: 'asset-1',
      p_developer_id: 'dev-1',
      p_vote_value: 'positive',
      p_owner_developer_id: null,
    });
  });

  it('saves normalized rules and rebalances through one atomic command', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 4, error: null });
    mockedGetSupabaseServerClient.mockReturnValue({ rpc } as never);

    await saveDeveloperProgramSettings(DEFAULT_DEVELOPER_PROGRAM_SETTINGS, 'owner-1');

    expect(rpc).toHaveBeenCalledWith('cardforge_update_developer_program_settings', {
      p_settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
      p_owner_developer_id: 'owner-1',
    });
  });

  it('pins or clears owner overrides without replacing automatic state', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 1, error: null });
    mockedGetSupabaseServerClient.mockReturnValue({ rpc } as never);

    await setDeveloperAssetOwnerOverride({
      submissionId: 'asset-1',
      ownerStatusOverride: null,
      ownerAccessTierOverride: 'free',
      ownerNote: 'Keep Starter access.',
      ownerDeveloperId: 'owner-1',
    });

    expect(rpc).toHaveBeenCalledWith('cardforge_set_developer_asset_owner_override', {
      p_submission_id: 'asset-1',
      p_update_status_override: true,
      p_status_override: null,
      p_update_tier_override: true,
      p_tier_override: 'free',
      p_owner_note: 'Keep Starter access.',
      p_owner_developer_id: 'owner-1',
    });
  });

  it('surfaces automatic pipeline failures instead of reporting a successful vote', async () => {
    mockedGetSupabaseServerClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'registry update failed' } }),
    } as never);

    await expect(castDeveloperAssetVote({
      submissionId: 'asset-1',
      developerId: 'dev-1',
      voteValue: 'negative',
    })).rejects.toEqual(expect.objectContaining<Partial<DeveloperAssetRegistryCommandError>>({
      message: 'Unable to save the vote and automatic pipeline decision.',
      status: 500,
    }));
  });

  it('permanently removes storage only between database prepare and finalize commands', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: {
          storageObjects: [{
            storageBucket: 'cardforge-developer-assets',
            storagePath: 'developer-1/icons/example.svg',
          }],
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ remove });
    mockedGetSupabaseServerClient.mockReturnValue({ rpc, storage: { from } } as never);

    await purgeDeveloperAssetSubmission({
      submissionId: 'asset-1',
      confirmationName: 'Example icon',
    });

    expect(rpc).toHaveBeenNthCalledWith(1, 'cardforge_prepare_developer_asset_purge', {
      p_submission_id: 'asset-1',
      p_expected_name: 'Example icon',
    });
    expect(from).toHaveBeenCalledWith('cardforge-developer-assets');
    expect(remove).toHaveBeenCalledWith(['developer-1/icons/example.svg']);
    expect(rpc).toHaveBeenNthCalledWith(2, 'cardforge_finalize_developer_asset_purge', {
      p_submission_id: 'asset-1',
    });
  });
});
