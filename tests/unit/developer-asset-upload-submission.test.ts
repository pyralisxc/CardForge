import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { createDeveloperAssetSubmission } from '@/features/developer-assets/lib/developerAssetStore';
import { createUploadedDeveloperAssetSubmission } from '@/features/developer-assets/lib/developerAssetUploadSubmission';

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: vi.fn(),
}));
vi.mock('@/features/developer-assets/lib/developerAssetStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/developer-assets/lib/developerAssetStore')>();
  return { ...actual, createDeveloperAssetSubmission: vi.fn() };
});

const mockedGetSupabaseServerClient = vi.mocked(getSupabaseServerClient);
const mockedCreateDeveloperAssetSubmission = vi.mocked(createDeveloperAssetSubmission);

const sourceFile = {
  name: 'gold-divider.svg',
  type: 'image/svg+xml',
  size: 128,
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(128)),
} as unknown as File;

const setupStorage = () => {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example/gold-divider.svg' } });
  const from = vi.fn().mockReturnValue({ upload, remove, getPublicUrl });
  mockedGetSupabaseServerClient.mockReturnValue({ storage: { from } } as never);
  return { from, upload, remove };
};

describe('developer asset upload submission', () => {
  beforeEach(() => {
    mockedGetSupabaseServerClient.mockReset();
    mockedCreateDeveloperAssetSubmission.mockReset();
  });

  it('persists the uploaded object and submission as one server-owned workflow', async () => {
    const storage = setupStorage();
    mockedCreateDeveloperAssetSubmission.mockResolvedValue({ submissions: [] } as never);

    const program = await createUploadedDeveloperAssetSubmission({
      developerId: 'developer-1',
      developerEmail: 'dev@example.com',
      currentContributorIds: ['developer-1'],
      assetType: 'dividers',
      studioDestination: 'element.divider',
      name: 'Gold Divider',
      description: 'A clean divider.',
      previewUrl: '',
      file: sourceFile,
    });

    expect(program).toEqual({ submissions: [] });
    expect(storage.upload).toHaveBeenCalledOnce();
    expect(mockedCreateDeveloperAssetSubmission).toHaveBeenCalledWith(expect.objectContaining({
      developerId: 'developer-1',
      input: expect.objectContaining({
        assetType: 'dividers',
        sourceUrl: 'https://cdn.example/gold-divider.svg',
        sourceStorageBucket: 'cardforge-developer-assets',
      }),
    }));
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('accepts transparency-capable professional border overlays', async () => {
    const storage = setupStorage();
    mockedCreateDeveloperAssetSubmission.mockResolvedValue({ submissions: [] } as never);

    await createUploadedDeveloperAssetSubmission({
      developerId: 'developer-1',
      developerEmail: 'dev@example.com',
      currentContributorIds: ['developer-1'],
      assetType: 'imageAssets',
      studioDestination: 'image.border.front',
      name: 'Ornate Gold Overlay',
      description: 'Transparent card border art.',
      previewUrl: '',
      file: {
        name: 'ornate-border.webp',
        type: 'image/webp',
        size: 256,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(256)),
      } as unknown as File,
    });

    expect(storage.upload).toHaveBeenCalledOnce();
    expect(mockedCreateDeveloperAssetSubmission).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        assetType: 'imageAssets',
        studioDestination: 'image.border.front',
      }),
    }));
  });

  it('rejects JPEG border overlays because they cannot preserve transparency', async () => {
    const storage = setupStorage();

    await expect(createUploadedDeveloperAssetSubmission({
      developerId: 'developer-1',
      developerEmail: 'dev@example.com',
      currentContributorIds: ['developer-1'],
      assetType: 'imageAssets',
      studioDestination: 'image.border.front',
      name: 'Flat Border',
      description: '',
      previewUrl: '',
      file: {
        name: 'border.jpg',
        type: 'image/jpeg',
        size: 256,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(256)),
      } as unknown as File,
    })).rejects.toThrow('SVG, PNG, or WEBP');

    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('removes the uploaded object when submission persistence fails', async () => {
    const storage = setupStorage();
    mockedCreateDeveloperAssetSubmission.mockRejectedValue(new Error('insert failed'));

    await expect(createUploadedDeveloperAssetSubmission({
      developerId: 'developer-1',
      developerEmail: 'dev@example.com',
      currentContributorIds: ['developer-1'],
      assetType: 'dividers',
      studioDestination: 'element.divider',
      name: 'Gold Divider',
      description: '',
      previewUrl: '',
      file: sourceFile,
    })).rejects.toThrow('insert failed');

    expect(storage.remove).toHaveBeenCalledWith([expect.stringContaining('developer-1/dividers/')]);
  });

  it('routes Template revisions through Studio instead of the generic file uploader', async () => {
    const storage = setupStorage();

    await expect(createUploadedDeveloperAssetSubmission({
      developerId: 'developer-1',
      developerEmail: 'dev@example.com',
      currentContributorIds: ['developer-1'],
      assetType: 'templates',
      studioDestination: 'template.front',
      name: 'Shared Template revision',
      description: '',
      previewUrl: '',
      file: {
        name: 'shared-template.json',
        type: 'application/json',
        size: 128,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(128)),
      } as unknown as File,
    })).rejects.toThrow('Templates and Styles are authored in Studio');

    expect(storage.upload).not.toHaveBeenCalled();
    expect(mockedCreateDeveloperAssetSubmission).not.toHaveBeenCalled();
  });
});
