import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { createPipelineSubmission } from '@/features/pipeline/lib/pipelineStore';
import {
  createUploadedPipelineSubmission,
  preparePipelineUpload,
  removePendingPipelineUpload,
  validatePipelineUploadDescriptor,
} from '@/features/pipeline/lib/pipelineUploadSubmission';

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: vi.fn(),
}));
vi.mock('@/features/pipeline/lib/pipelineStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/pipeline/lib/pipelineStore')>();
  return { ...actual, createPipelineSubmission: vi.fn() };
});

const mockedGetSupabaseServerClient = vi.mocked(getSupabaseServerClient);
const mockedCreatePipelineSubmission = vi.mocked(createPipelineSubmission);

const taxonomy = {
  specialtyTags: ['games'],
  useCaseTags: ['tcg'],
};

const setupStorage = (storedSize = 128, submittedUpload = false) => {
  const createSignedUploadUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: 'https://storage.example/upload/token' },
    error: null,
  });
  const list = vi.fn().mockImplementation(async (_directory: string, options: { search?: string }) => ({
    data: [{ name: options.search, metadata: { size: storedSize } }],
    error: null,
  }));
  const remove = vi.fn().mockResolvedValue({ error: null });
  const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example/gold-divider.svg' } });
  const from = vi.fn().mockReturnValue({ createSignedUploadUrl, list, remove, getPublicUrl });
  const databaseQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: submittedUpload ? { id: 'submission-1' } : null, error: null }),
  };
  databaseQuery.select.mockReturnValue(databaseQuery);
  databaseQuery.eq.mockReturnValue(databaseQuery);
  const databaseFrom = vi.fn().mockReturnValue(databaseQuery);
  mockedGetSupabaseServerClient.mockReturnValue({ storage: { from }, from: databaseFrom } as never);
  return { createSignedUploadUrl, list, remove };
};

const uploadedFile = {
  storagePath: 'contributor-1/dividers/123-gold-divider-token.svg',
  fileName: 'gold-divider.svg',
  fileSizeBytes: 128,
  mimeType: 'image/svg+xml',
};

describe('contributor asset upload submission', () => {
  beforeEach(() => {
    mockedGetSupabaseServerClient.mockReset();
    mockedCreatePipelineSubmission.mockReset();
  });

  it('prepares a signed direct-to-storage upload instead of proxying file bytes through Vercel', async () => {
    const storage = setupStorage();

    const plan = await preparePipelineUpload({
      contributorId: 'contributor-1',
      maxFileSizeMb: 25,
      assetType: 'dividers',
      studioDestination: 'element.divider',
      fileName: 'gold-divider.svg',
      fileSizeBytes: 20 * 1024 * 1024,
      mimeType: 'image/svg+xml',
    });

    expect(plan).toMatchObject({
      signedUrl: 'https://storage.example/upload/token',
      fileSizeBytes: 20 * 1024 * 1024,
      maxFileSizeBytes: 25 * 1024 * 1024,
    });
    expect(plan.storagePath).toMatch(/^contributor-1\/dividers\//u);
    expect(storage.createSignedUploadUrl).toHaveBeenCalledWith(plan.storagePath, { upsert: false });
  });

  it('persists a verified uploaded object, destination, and taxonomy as one workflow', async () => {
    const storage = setupStorage();
    mockedCreatePipelineSubmission.mockResolvedValue();

    const result = await createUploadedPipelineSubmission({
      contributorId: 'contributor-1',
      contributorEmail: 'contributor@example.com',
      maxFileSizeMb: 25,
      assetType: 'dividers',
      studioDestination: 'element.divider',
      ...taxonomy,
      name: 'Gold Divider',
      description: 'A clean divider.',
      previewUrl: '',
      uploadedFile,
    });

    expect(result).toBeUndefined();
    expect(storage.list).toHaveBeenCalledOnce();
    expect(mockedCreatePipelineSubmission).toHaveBeenCalledWith(expect.objectContaining({
      contributorId: 'contributor-1',
      input: expect.objectContaining({
        assetType: 'dividers',
        studioDestination: 'element.divider',
        specialtyTags: ['games'],
        useCaseTags: ['tcg'],
        sourceUrl: 'https://cdn.example/gold-divider.svg',
        sourceStorageBucket: 'cardforge-contributor-assets',
        sourceStoragePath: uploadedFile.storagePath,
      }),
    }));
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('returns the owner-chosen file boundary when a source is too large', () => {
    expect(() => validatePipelineUploadDescriptor({
      assetType: 'imageAssets',
      studioDestination: 'image.picture',
      fileName: 'high-quality.webp',
      fileSizeBytes: 26 * 1024 * 1024,
      mimeType: 'image/webp',
      maxFileSizeMb: 25,
    })).toThrow('25 MB or smaller');

    try {
      validatePipelineUploadDescriptor({
        assetType: 'imageAssets',
        studioDestination: 'image.picture',
        fileName: 'high-quality.webp',
        fileSizeBytes: 26 * 1024 * 1024,
        mimeType: 'image/webp',
        maxFileSizeMb: 25,
      });
    } catch (error) {
      expect(error).toMatchObject({
        status: 413,
        boundary: {
          kind: 'limit',
          limit: { resource: 'contributor_source_file_bytes', maximum: 25 * 1024 * 1024 },
        },
      });
    }
  });

  it('rejects JPEG border overlays before creating an upload plan', () => {
    setupStorage();

    expect(() => validatePipelineUploadDescriptor({
      assetType: 'imageAssets',
      studioDestination: 'image.border.front',
      fileName: 'border.jpg',
      fileSizeBytes: 256,
      mimeType: 'image/jpeg',
      maxFileSizeMb: 25,
    })).toThrow('SVG, PNG, or WEBP');
  });

  it('removes the uploaded object when submission persistence fails', async () => {
    const storage = setupStorage();
    mockedCreatePipelineSubmission.mockRejectedValue(new Error('insert failed'));

    await expect(createUploadedPipelineSubmission({
      contributorId: 'contributor-1',
      contributorEmail: 'contributor@example.com',
      maxFileSizeMb: 25,
      assetType: 'dividers',
      studioDestination: 'element.divider',
      ...taxonomy,
      name: 'Gold Divider',
      description: '',
      previewUrl: '',
      uploadedFile,
    })).rejects.toThrow('insert failed');

    expect(storage.remove).toHaveBeenCalledWith([uploadedFile.storagePath]);
  });

  it('only removes unfinished uploads through the cleanup endpoint', async () => {
    const pendingStorage = setupStorage();
    await removePendingPipelineUpload({
      contributorId: 'contributor-1',
      assetType: 'dividers',
      storagePath: uploadedFile.storagePath,
    });
    expect(pendingStorage.remove).toHaveBeenCalledWith([uploadedFile.storagePath]);

    const submittedStorage = setupStorage(128, true);
    await expect(removePendingPipelineUpload({
      contributorId: 'contributor-1',
      assetType: 'dividers',
      storagePath: uploadedFile.storagePath,
    })).rejects.toThrow('cannot be removed as an unfinished upload');
    expect(submittedStorage.remove).not.toHaveBeenCalled();
  });

  it('routes Template revisions through Studio instead of the generic uploader', () => {
    setupStorage();

    expect(() => validatePipelineUploadDescriptor({
      assetType: 'templates',
      studioDestination: 'template.front',
      fileName: 'shared-template.json',
      fileSizeBytes: 128,
      mimeType: 'application/json',
      maxFileSizeMb: 25,
    })).toThrow('Templates and Styles are authored in Studio');
  });

  it('accepts one canonical portable Set package without inventing a Studio destination', () => {
    const descriptor = validatePipelineUploadDescriptor({
      assetType: 'sets',
      studioDestination: null,
      fileName: 'playing-card-deck.cardforge',
      fileSizeBytes: 1024,
      mimeType: 'application/vnd.cardforge.project+zip',
      maxFileSizeMb: 25,
    });

    expect(descriptor).toMatchObject({ assetType: 'sets', studioDestination: null, extension: 'cardforge' });
  });
});
