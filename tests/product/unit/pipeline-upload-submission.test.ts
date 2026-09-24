import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { buildCardForgeProjectSnapshot, createCardForgeProjectPackageBlob } from '@/features/project/lib/projectPackageCodec';
import { createProjectDocumentFromState } from '@/features/project/model/projectDocument';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { createPipelineSubmission, updatePipelineSubmissionDetails } from '@/features/pipeline/lib/pipelineStore';
import {
  createUploadedPipelineSubmission,
  preparePipelineUpload,
  removePendingPipelineUpload,
  validateUploadedAssetBytes,
  validatePipelineUploadDescriptor,
} from '@/features/pipeline/lib/pipelineUploadSubmission';
import { getPipelineUploadTransportBlob } from '@/features/pipeline/lib/pipelineUploadPolicy';

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerClient: vi.fn(),
}));
vi.mock('@/features/pipeline/lib/pipelineStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/pipeline/lib/pipelineStore')>();
  return { ...actual, createPipelineSubmission: vi.fn() };
});

const mockedGetSupabaseServerClient = vi.mocked(getSupabaseServerClient);
const mockedCreatePipelineSubmission = vi.mocked(createPipelineSubmission);

describe('Pipeline partial classification edits', () => {
  it.each([
    ['icons', ['general'], [], { useCaseTags: [] }, true],
    ['icons', ['games'], ['tcg'], { useCaseTags: [] }, false],
    ['icons', ['general'], [], { specialtyTags: ['games'] }, false],
    ['templates', ['general'], ['tcg'], { useCaseTags: [] }, false],
    ['sets', ['general'], ['tcg'], { useCaseTags: [] }, false],
  ])('validates merged taxonomy before writing %s', async (assetType, specialtyTags, useCaseTags, edit, allowed) => {
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const query = { select: vi.fn(), eq: vi.fn(), limit: vi.fn().mockResolvedValue({ data: [{ contributor_id: 'owner', status: 'draft', asset_type: assetType, specialty_tags: specialtyTags, use_case_tags: useCaseTags }], error: null }), update };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    mockedGetSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) } as never);
    const result = updatePipelineSubmissionDetails({ submissionId: 'draft', contributorId: 'owner', input: { name: 'Original', ...edit } });
    if (allowed) {
      await expect(result).resolves.toBeUndefined();
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ use_case_tags: [] }));
    } else {
      await expect(result).rejects.toThrow('Choose a supported specialty and use case');
      expect(update).not.toHaveBeenCalled();
    }
  });
});

const taxonomy = {
  specialtyTags: ['games'],
  useCaseTags: ['tcg'],
};

const VALID_PNG_BYTES = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWP4z8DQAMIMMAYAOOgF/Q/eI6wAAAAASUVORK5CYII=', 'base64');
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
  const update = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ createSignedUploadUrl, list, remove, download, getPublicUrl, update });
  const databaseQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: submittedUpload ? { id: 'submission-1' } : null, error: null }),
  };
  databaseQuery.select.mockReturnValue(databaseQuery);
  databaseQuery.eq.mockReturnValue(databaseQuery);
  const databaseFrom = vi.fn().mockReturnValue(databaseQuery);
  mockedGetSupabaseServerClient.mockReturnValue({ storage: { from }, from: databaseFrom } as never);
  return { createSignedUploadUrl, list, remove, download, update };
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

  it('keeps unsanitized SVG inert during direct-to-storage transport', () => {
    const svg = new Blob(['<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>'], { type: 'image/svg+xml' });
    expect(getPipelineUploadTransportBlob(svg).type).toBe('application/octet-stream');
    expect(getPipelineUploadTransportBlob(validPng()).type).toBe('image/png');
  });

  it('quarantines raw SVG under a non-vector storage extension', async () => {
    setupStorage();

    const plan = await preparePipelineUpload({
      contributorId: 'contributor-1',
      maxFileSizeMb: 25,
      assetType: 'icons',
      studioDestination: 'element.icon',
      fileName: 'custom-icon.svg',
      fileSizeBytes: 512,
      mimeType: 'image/svg+xml',
    });

    expect(plan.storagePath).toMatch(/^contributor-1\/icons\/.+\.cfsvg$/u);
    expect(plan.mimeType).toBe('image/svg+xml');
  });

  it.each(['textures', 'dividers', 'icons', 'imageAssets'] as const)('decodes all supported raster formats for %s', async (assetType) => {
    for (const extension of ['png', 'jpg', 'webp'] as const) {
      const bytes = await sharp(VALID_PNG_BYTES).toFormat(extension === 'jpg' ? 'jpeg' : extension).toBuffer();
      await expect(validateUploadedAssetBytes({ assetType, extension, mimeType: `image/${extension === 'jpg' ? 'jpeg' : extension}` }, new Blob([bytes])))
        .resolves.toBeNull();
    }
  });

  it.each([true, false])('validates the complete uploaded Set before registering it (has cards: %s)', async (hasCards) => {
    const document = createProjectDocumentFromState({
      cardSets: [{ id: 'set-1', name: 'Test Set' }], activeCardSetId: 'set-1',
      userTemplates: [{ id: 'template-1', name: 'Test Template', aspectRatio: '63:88', freeformCanvas: { width: 630, height: 880, elements: [] } }],
      storedCards: hasCards ? [{ uniqueId: 'card-1', setId: 'set-1', templateId: 'template-1', data: { name: 'One' } }] : [],
      appearanceStyles: [],
    });
    const bytes = await createCardForgeProjectPackageBlob(await buildCardForgeProjectSnapshot({ document, name: 'Test Set' }));
    const storage = setupStorage(bytes.size);
    storage.download.mockResolvedValue({ data: bytes, error: null });
    const upload = { storagePath: 'contributor-1/sets/test.cardforge', fileName: 'test.cardforge', fileSizeBytes: bytes.size, mimeType: 'application/vnd.cardforge.project+zip' };
    const result = createUploadedPipelineSubmission({ contributorId: 'contributor-1', contributorEmail: 'contributor@example.com',
      maxFileSizeMb: 25, assetType: 'sets', studioDestination: null, ...taxonomy, name: 'Test Set', description: '', previewUrl: '', uploadedFile: upload });
    if (hasCards) {
      await expect(result).resolves.toBeUndefined();
      expect(mockedCreatePipelineSubmission).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ assetType: 'sets', sourceMimeType: upload.mimeType }) }));
      expect(storage.remove).not.toHaveBeenCalled();
    } else {
      await expect(result).rejects.toThrow('at least one card');
      expect(mockedCreatePipelineSubmission).not.toHaveBeenCalled();
      expect(storage.remove).toHaveBeenCalledWith([upload.storagePath]);
    }
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

  it('replaces an inertly transported SVG with sanitized vector bytes before registration', async () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#fff" d="M2 2h20v20H2z"/></svg>';
    const sourceBlob = new Blob([source], { type: 'application/octet-stream' });
    const storage = setupStorage(sourceBlob.size);
    storage.download.mockResolvedValue({ data: sourceBlob, error: null });
    mockedCreatePipelineSubmission.mockResolvedValue();

    await createUploadedPipelineSubmission({
      contributorId: 'contributor-1', contributorEmail: 'contributor@example.com', maxFileSizeMb: 25,
      assetType: 'icons', studioDestination: 'element.icon', ...taxonomy, name: 'Safe Vector', description: '', previewUrl: '',
      uploadedFile: {
        storagePath: 'contributor-1/icons/safe-vector.cfsvg', fileName: 'safe-vector.svg',
        fileSizeBytes: sourceBlob.size, mimeType: 'image/svg+xml',
      },
    });

    expect(storage.update).toHaveBeenCalledWith(
      'contributor-1/icons/safe-vector.cfsvg',
      expect.any(Buffer),
      { contentType: 'image/svg+xml', cacheControl: '31536000' },
    );
    expect(mockedCreatePipelineSubmission).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ assetType: 'icons', sourceMimeType: 'image/svg+xml' }),
    }));
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

  it.each([
    ['icons', 'element.icon'],
    ['dividers', 'element.divider'],
    ['imageAssets', 'image.border.front'],
  ] as const)('accepts SVG only in the safe vector lane for %s', (assetType, studioDestination) => {
    expect(validatePipelineUploadDescriptor({
      assetType,
      studioDestination,
      fileName: 'scalable-art.svg',
      fileSizeBytes: 256,
      mimeType: 'image/svg+xml',
      maxFileSizeMb: 25,
    })).toMatchObject({ extension: 'svg', mimeType: 'image/svg+xml' });
  });

  it.each([
    ['textures', 'appearance.texture'],
    ['imageAssets', 'image.picture'],
    ['imageAssets', 'image.frame.front'],
  ] as const)('rejects SVG outside the safe vector lane for %s', (assetType, studioDestination) => {
    expect(() => validatePipelineUploadDescriptor({
      assetType,
      studioDestination,
      fileName: 'misrouted.svg',
      fileSizeBytes: 256,
      mimeType: 'image/svg+xml',
      maxFileSizeMb: 25,
    })).toThrow('SVG is reserved');
  });

  it('sanitizes a safe SVG and rejects active or externally referenced content', async () => {
    const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="240" height="240" viewBox="0 0 24 24"><title>Safe icon</title><defs><path id="shape" d="M2 2h20v20H2z"/></defs><use xlink:href="#shape" fill="#fff"/></svg>';
    const sanitized = await validateUploadedAssetBytes(
      { assetType: 'icons', extension: 'svg', mimeType: 'image/svg+xml' },
      new Blob([safeSvg], { type: 'image/svg+xml' }),
    );
    expect(sanitized?.toString('utf8')).toContain('xlink:href="#shape"');
    expect(sanitized?.toString('utf8')).not.toContain('width="240"');

    for (const unsafeSvg of [
      '<svg viewBox="0 0 24 24"><script>alert(1)</script></svg>',
      '<svg viewBox="0 0 24 24"><path onclick="alert(1)" d="M0 0h1v1z"/></svg>',
      '<svg viewBox="0 0 24 24"><use href="https://example.com/icon.svg#x"/></svg>',
      '<svg viewBox="0 0 24 24"><foreignObject><div>unsafe</div></foreignObject></svg>',
      '<svg><path d="M0 0h1v1z"/></svg>',
    ]) {
      await expect(validateUploadedAssetBytes(
        { assetType: 'icons', extension: 'svg', mimeType: 'image/svg+xml' },
        new Blob([unsafeSvg], { type: 'image/svg+xml' }),
      )).rejects.toThrow();
    }
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

  it('rejects an image whose header is valid but whose pixels cannot be decoded', async () => {
    const corrupt = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLJ4QAAAABJRU5ErkJggg==', 'base64');
    await expect(validateUploadedAssetBytes({ assetType: 'icons', extension: 'png', mimeType: 'image/png' }, new Blob([corrupt])))
      .rejects.toThrow('malformed');
  });

  it.each([
    ['woff2', 'font/woff2', Buffer.from('wOF2font-payload')],
    ['woff', 'font/woff', Buffer.from('wOFFfont-payload')],
    ['otf', 'font/otf', Buffer.from('OTTOfont-payload')],
    ['ttf', 'font/ttf', Buffer.from([0x00, 0x01, 0x00, 0x00, 0x66, 0x6f, 0x6e, 0x74])],
  ])('rejects a truncated %s font despite its valid signature', async (extension, mimeType, bytes) => {
    await expect(validateUploadedAssetBytes({
      assetType: 'fonts',
      extension,
      mimeType,
    }, new Blob([bytes], { type: mimeType }))).rejects.toThrow('malformed');
  });

  // Original minimal triangle glyphs, encoded in each supported font format.
  it.each(['woff2', 'woff', 'ttf', 'otf'])('decodes a real %s font', async (extension) => {
    const bytes = await readFile(`tests/fixtures/fonts/test.${extension}`);
    await expect(validateUploadedAssetBytes({ assetType: 'fonts', extension, mimeType: `font/${extension}` },
      new Blob([bytes]))).resolves.toBeNull();
  });

  it('rejects a mislabeled font before public registration', async () => {
    await expect(validateUploadedAssetBytes({
      assetType: 'fonts',
      extension: 'woff2',
      mimeType: 'font/woff2',
    }, new Blob([Buffer.from('OTTOfont-payload')], { type: 'font/woff2' }))).rejects.toThrow('do not match');
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
