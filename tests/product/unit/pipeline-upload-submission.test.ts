import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { createPipelineSubmission } from '@/features/pipeline/lib/pipelineStore';
import {
  createUploadedPipelineSubmission,
  preparePipelineUpload,
  removePendingPipelineUpload,
  validateUploadedAssetBytes,
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

const VALID_PNG_BYTES = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLJ4QAAAABJRU5ErkJggg==', 'base64');
const validPng = () => new Blob([VALID_PNG_BYTES], { type: 'image/png' });

const setupStorage = (storedSize = VALID_PNG_BYTES.byteLength, submittedUpload = false) => {
  const createSignedUploadUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: 'https://storage.example/upload/token' },
    error: null,
  });
  const list = vi.fn().mockImplementation(async (_directory: string, options: { search?: string }) => ({
    data: [{ name: options.search, metadata: { size: storedSize } }],
    error: null,
  }));
  const remove = vi.fn().mockResolvedValue({ error: null });
  const download = vi.fn().mockResolvedValue({ data: validPng(), error: null });
  const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example/gold-divider.png' } });
  const from = vi.fn().mockReturnValue({ createSignedUploadUrl, list, remove, download, getPublicUrl });
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
  storagePath: 'contributor-1/dividers/123-gold-divider-token.png',
  fileName: 'gold-divider.png',
  fileSizeBytes: VALID_PNG_BYTES.byteLength,
  mimeType: 'image/png',
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
      fileName: 'gold-divider.webp',
      fileSizeBytes: 20 * 1024 * 1024,
      mimeType: 'image/webp',
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
        sourceUrl: 'https://cdn.example/gold-divider.png',
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
    })).toThrow('PNG or WEBP');
  });

  it('rejects direct SVG uploads before any active content reaches shared storage', () => {
    setupStorage();

    expect(() => validatePipelineUploadDescriptor({
      assetType: 'icons',
      studioDestination: 'element.icon',
      fileName: 'active-icon.svg',
      fileSizeBytes: 256,
      mimeType: 'image/svg+xml',
      maxFileSizeMb: 25,
    })).toThrow('Direct SVG uploads are not accepted');
  });

  it('binds declared MIME to the extension and rejects malformed raster bytes', async () => {
    expect(() => validatePipelineUploadDescriptor({
      assetType: 'imageAssets',
      studioDestination: 'image.picture',
      fileName: 'mislabeled.png',
      fileSizeBytes: 256,
      mimeType: 'image/jpeg',
      maxFileSizeMb: 25,
    })).toThrow('declared file type');

    await expect(validateUploadedAssetBytes({
      assetType: 'imageAssets',
      extension: 'png',
      mimeType: 'image/png',
    }, new Blob([Buffer.from('not-an-image')], { type: 'image/png' }))).rejects.toThrow('do not match');
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
