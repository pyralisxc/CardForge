import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { buildCardForgeProjectSnapshot, createCardForgeProjectPackageBlob } from '@/features/project/lib/projectPackageCodec';
import { createProjectDocumentFromState } from '@/features/project/model/projectDocument';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { buildPipelineSubmissionRecord, createPipelineSubmission, updatePipelineSubmissionDetails } from '@/features/pipeline/lib/pipelineStore';
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
  it('never copies a caller-supplied digest into normalized submission fields', () => {
    const input = { assetType:'imageAssets', studioDestination:'image.picture',
      specialtyTags:['games'], useCaseTags:['tcg'], name:'Raster', description:'',
      sourceUrl:'https://example.invalid/image.png', previewUrl:'https://example.invalid/image.png',
      sourceFileSizeBytes:100, sourceMimeType:'image/png', sourceContentSha256:'a'.repeat(64) };
    const record=buildPipelineSubmissionRecord({contributorId:'author',contributorEmail:null,input});
    expect(record).not.toHaveProperty('source_content_sha256');
  });

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

const SOURCE_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = '22222222-2222-4222-8222-222222222222';
const ownedPath = (extension = 'png') => `pipeline-owned-v1/${SOURCE_ID}/source.${extension}`;

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
  let state = submittedUpload ? 'owned' : 'pending';
  const rpc = vi.fn().mockImplementation(async (command: string, args: Record<string, unknown>) => {
    if (command === 'cardforge_reserve_pipeline_upload') return { data: { storagePath: ownedPath((args.p_descriptor as { transportExtension: string }).transportExtension) }, error: null };
    if (command === 'cardforge_prepare_pipeline_upload_submission') {
      if (state === 'owned') return { data: { state }, error: null };
      if (state !== 'pending') return { data: null, error: { message: state === 'submitting' ? 'pipeline_upload_submission_uncertain' : 'pipeline_upload_cleanup_committed' } };
      if (args.p_claim) state = 'submitting';
      return { data: { state, token: args.p_claim ? TOKEN : undefined }, error: null };
    }
    if (command === 'cardforge_claim_pipeline_upload_cleanup') {
      if (state !== 'pending') return { data: null, error: { message: 'pipeline_upload_cleanup_blocked' } };
      state = 'cleanup_committed'; return { data: TOKEN, error: null };
    }
    if (command === 'cardforge_finalize_pipeline_upload_cleanup') { state = 'cleanup_completed'; return { data: true, error: null }; }
    throw new Error(`Unexpected native command: ${command}`);
  });
  mockedGetSupabaseServerClient.mockReturnValue({ storage: { from }, from: databaseFrom, rpc } as never);
  return { createSignedUploadUrl, list, remove, download, update, rpc, setOwned: () => { state = 'owned'; }, state: () => state };
};

const uploadedFile = {
  storagePath: ownedPath(),
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

    expect(plan.storagePath).toMatch(/^pipeline-owned-v1\/.+\/source\.cfsvg$/u);
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
    const upload = { storagePath: ownedPath('cardforge'), fileName: 'test.cardforge', fileSizeBytes: bytes.size, mimeType: 'application/vnd.cardforge.project+zip' };
    const result = createUploadedPipelineSubmission({ contributorId: 'contributor-1', contributorEmail: 'contributor@example.com',
      maxFileSizeMb: 25, assetType: 'sets', studioDestination: null, ...taxonomy, name: 'Test Set', description: '', sourceNotes: 'Rights and sources: Original authored cards | AI assistance: None', previewUrl: '', uploadedFile: upload });
    if (hasCards) {
      await expect(result).resolves.toBeUndefined();
      expect(mockedCreatePipelineSubmission).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ assetType: 'sets', sourceMimeType: upload.mimeType, sourceNotes: 'Rights and sources: Original authored cards | AI assistance: None' }) }));
      expect(storage.remove).not.toHaveBeenCalled();
    } else {
      await expect(result).rejects.toThrow('at least one card');
      expect(mockedCreatePipelineSubmission).not.toHaveBeenCalled();
      expect(storage.remove).not.toHaveBeenCalled();
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
    expect(plan.storagePath).toMatch(/^pipeline-owned-v1\//u);
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
      semanticRole: 'ornament',
      visualFamily: 'Gilded Court',
      variantKind: 'treatment',
      variantLabel: 'Gold',
      compatibilityTags: ['print', 'transparent'],
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
        semanticRole: 'ornament',
        visualFamily: 'Gilded Court',
        variantKind: 'treatment',
        variantLabel: 'Gold',
        compatibilityTags: ['print', 'transparent'],
        sourceUrl: 'https://cdn.example/gold-divider.png',
        sourceStorageBucket: 'cardforge-contributor-assets',
        sourceStoragePath: uploadedFile.storagePath,
      }),
    }));
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('pins a fresh accepted PNG digest in the native upload request and normal submission input', async () => {
    const storage = setupStorage();
    mockedCreatePipelineSubmission.mockResolvedValue();
    const digest = createHash('sha256').update(VALID_PNG_BYTES).digest('hex');
    await createUploadedPipelineSubmission({
      contributorId:'contributor-1',contributorEmail:'contributor@example.com',
      maxFileSizeMb:25,assetType:'imageAssets',studioDestination:'image.picture',
      ...taxonomy,name:'Source raster',description:'',previewUrl:'',
      uploadedFile:{storagePath:ownedPath(),fileName:'source.png',
        mimeType:'image/png',fileSizeBytes:VALID_PNG_BYTES.byteLength},
    });
    const prepared=storage.rpc.mock.calls.filter(([name])=>name==='cardforge_prepare_pipeline_upload_submission');
    expect(prepared).toHaveLength(2);
    expect(prepared[0][1].p_request).not.toHaveProperty('source_content_sha256');
    expect(prepared[1][1].p_request).toMatchObject({source_content_sha256:digest});
    expect(mockedCreatePipelineSubmission).toHaveBeenCalledWith(expect.objectContaining({
      sourceContentSha256:digest,
    }));
    expect(storage.update).not.toHaveBeenCalled();
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
        storagePath: ownedPath('cfsvg'), fileName: 'safe-vector.svg',
        fileSizeBytes: sourceBlob.size, mimeType: 'image/svg+xml',
      },
    });

    expect(storage.update).toHaveBeenCalledWith(
      ownedPath('cfsvg'),
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

  it('retains the uploaded object when submission persistence is uncertain', async () => {
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

    expect(storage.remove).not.toHaveBeenCalled();
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
    })).rejects.toThrow('cannot be reused or removed as unfinished');
    expect(submittedStorage.remove).not.toHaveBeenCalled();
  });

  const submissionInput = () => ({
    contributorId: 'contributor-1', contributorEmail: 'contributor@example.com', maxFileSizeMb: 25,
    assetType: 'dividers', studioDestination: 'element.divider', ...taxonomy,
    name: 'Gold Divider', description: '', previewUrl: '', uploadedFile,
  });
  const cleanupInput = () => ({ contributorId: 'contributor-1', assetType: 'dividers', storagePath: uploadedFile.storagePath });

  it('preserves committed bytes after lost insert response and confirms retry without another transfer', async () => {
    const storage = setupStorage();
    mockedCreatePipelineSubmission.mockImplementation(async () => { storage.setOwned(); throw new Error('response lost after commit'); });
    await expect(createUploadedPipelineSubmission(submissionInput())).rejects.toThrow('response lost');
    await expect(removePendingPipelineUpload(cleanupInput())).rejects.toMatchObject({ status: 409 });
    await expect(createUploadedPipelineSubmission(submissionInput())).resolves.toBeUndefined();
    expect(storage.remove).not.toHaveBeenCalled();
    expect(storage.download).toHaveBeenCalledOnce();
    expect(mockedCreatePipelineSubmission).toHaveBeenCalledOnce();
  });

  it('cleanup wins during read-only validation; submission cannot obtain later authority', async () => {
    const storage = setupStorage();
    let release!: (value: { data: Blob; error: null }) => void;
    storage.download.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const pending = createUploadedPipelineSubmission(submissionInput());
    await vi.waitFor(() => expect(storage.download).toHaveBeenCalledOnce());
    await removePendingPipelineUpload(cleanupInput());
    release({ data: validPng(), error: null });
    await expect(pending).rejects.toMatchObject({ status: 409 });
    expect(storage.remove).toHaveBeenCalledOnce();
    expect(mockedCreatePipelineSubmission).not.toHaveBeenCalled();
    expect(storage.update).not.toHaveBeenCalled();
  });

  it('submission commitment excludes cleanup and duplicate work while persistence is pending', async () => {
    const storage = setupStorage();
    let release!: () => void;
    mockedCreatePipelineSubmission.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    const pending = createUploadedPipelineSubmission(submissionInput());
    await vi.waitFor(() => expect(mockedCreatePipelineSubmission).toHaveBeenCalledOnce());
    await expect(removePendingPipelineUpload(cleanupInput())).rejects.toMatchObject({ status: 409 });
    await expect(createUploadedPipelineSubmission(submissionInput())).rejects.toMatchObject({ status: 503 });
    expect(storage.download).toHaveBeenCalledOnce();
    expect(storage.remove).not.toHaveBeenCalled();
    release(); await pending;
  });

  it('holds exclusive submission authority through delayed SVG normalization', async () => {
    const bytes = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>']);
    const storage = setupStorage(bytes.size);
    storage.download.mockResolvedValue({ data: bytes, error: null });
    let release!: (value: { error: null }) => void;
    storage.update.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const input = { ...submissionInput(), assetType: 'icons', studioDestination: 'element.icon',
      uploadedFile: { storagePath: ownedPath('cfsvg'), fileName: 'proof.svg', mimeType: 'image/svg+xml', fileSizeBytes: bytes.size } };
    const pending = createUploadedPipelineSubmission(input);
    await vi.waitFor(() => expect(storage.update).toHaveBeenCalledOnce());
    await expect(removePendingPipelineUpload({ ...cleanupInput(), storagePath: input.uploadedFile.storagePath })).rejects.toMatchObject({ status: 409 });
    await expect(createUploadedPipelineSubmission(input)).rejects.toMatchObject({ status: 503 });
    expect(storage.remove).not.toHaveBeenCalled();
    release({ error: null }); await pending;
    expect(storage.update).toHaveBeenCalledOnce();
  });

  it('does not delete on an unreadable cleanup claim receipt', async () => {
    const storage = setupStorage();
    storage.rpc.mockResolvedValue({ data: null, error: null });
    await expect(removePendingPipelineUpload(cleanupInput())).rejects.toMatchObject({ status: 503 });
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it.each(['storage', 'finalizer'])('never reissues cleanup authority after uncertain %s outcome', async (failure) => {
    const storage = setupStorage();
    if (failure === 'storage') storage.remove.mockRejectedValue(new Error('response lost'));
    else {
      const native = storage.rpc.getMockImplementation()!;
      storage.rpc.mockImplementation((command, args) => command === 'cardforge_finalize_pipeline_upload_cleanup'
        ? Promise.reject(new Error('finalization unavailable')) : native(command, args));
    }
    await expect(removePendingPipelineUpload(cleanupInput())).rejects.toMatchObject({ status: 503 });
    expect(storage.state()).toBe('cleanup_committed');
    await expect(removePendingPipelineUpload(cleanupInput())).rejects.toMatchObject({ status: 409 });
    await expect(createUploadedPipelineSubmission(submissionInput())).rejects.toMatchObject({ status: 409 });
    expect(storage.remove).toHaveBeenCalledOnce();
  });

  it('rejects old unverified paths without deletion, even when bytes survive and no submission is found', async () => {
    const storage = setupStorage();
    await expect(removePendingPipelineUpload({ ...cleanupInput(), storagePath: 'contributor-1/dividers/legacy.png' })).rejects.toMatchObject({ status: 409 });
    expect(storage.remove).not.toHaveBeenCalled();
    expect(storage.rpc).not.toHaveBeenCalled();
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