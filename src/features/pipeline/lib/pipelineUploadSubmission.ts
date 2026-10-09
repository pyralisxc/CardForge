  });
  const stored = data?.find((entry) => entry.name === objectName);
  if (error || !stored || getStoredObjectSize(stored) !== expectedSize) {
    throw new PipelineStoreError(
      'The Forge Review source upload is incomplete or changed. Upload the file again.',
      409,
    );
  }
};

const startsWithBytes = (bytes: Uint8Array, signature: readonly number[]): boolean => (
  signature.every((value, index) => bytes[index] === value)
);

export const validateUploadedAssetBytes = async (
  descriptor: Pick<ValidatedUploadDescriptor, 'assetType' | 'extension' | 'mimeType'>,
  data: Blob,
): Promise<Buffer | null> => {
  if (descriptor.assetType === 'sets') return null;
  const buffer = Buffer.from(await data.arrayBuffer());
  if (descriptor.extension === 'svg') {
    const sanitized = sanitizePipelineSvg(buffer.toString('utf8'));
    try {
      const metadata = await sharp(sanitized, { failOn: 'error' }).metadata();
      if (metadata.format !== 'svg' || !metadata.width || !metadata.height) throw new Error('Unexpected vector metadata.');
    } catch {
      throw new PipelineStoreError('The uploaded SVG cannot be rendered safely.', 400, { kind: 'invalid' });
    }
    return sanitized;
  }
  const bytes = new Uint8Array(buffer);
  const magicMatches = descriptor.extension === 'png'
    ? startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    : descriptor.extension === 'jpg'
      ? startsWithBytes(bytes, [0xff, 0xd8, 0xff])
      : descriptor.extension === 'webp'
        ? Buffer.from(bytes.slice(0, 4)).toString('ascii') === 'RIFF' && Buffer.from(bytes.slice(8, 12)).toString('ascii') === 'WEBP'
        : descriptor.extension === 'woff2'
          ? Buffer.from(bytes.slice(0, 4)).toString('ascii') === 'wOF2'
          : descriptor.extension === 'woff'
            ? Buffer.from(bytes.slice(0, 4)).toString('ascii') === 'wOFF'
            : descriptor.extension === 'otf'
              ? Buffer.from(bytes.slice(0, 4)).toString('ascii') === 'OTTO'
              : descriptor.extension === 'ttf'
                ? startsWithBytes(bytes, [0x00, 0x01, 0x00, 0x00]) || Buffer.from(bytes.slice(0, 4)).toString('ascii') === 'true'
                : false;
  if (!magicMatches) {
    throw new PipelineStoreError('The uploaded file contents do not match its declared file type.', 400, { kind: 'invalid' });
  }
  if (descriptor.assetType === 'fonts') {
    try {
      const font = decodeFont(buffer);
      if (!('characterSet' in font) || !font.numGlyphs || !font.unitsPerEm || !font.characterSet.length) {
        throw new Error('The font has no usable characters.');
      }
      // Fontkit decodes lazily. Materialize mapped outlines as well as the header
      // so truncated glyph tables cannot enter the published library.
      for (const codePoint of font.characterSet) {
        const glyph = font.glyphForCodePoint(codePoint);
        void glyph.path.commands;
        if (!Number.isFinite(glyph.advanceWidth)) throw new Error('Invalid glyph metrics.');
      }
    } catch {
      throw new PipelineStoreError('The uploaded font is malformed or cannot be decoded safely.', 400, { kind: 'invalid' });
    }
  } else {
    try {
      const image = sharp(buffer, { failOn: 'error' });
      const metadata = await image.metadata();
      const expectedFormat = descriptor.extension === 'jpg' ? 'jpeg' : descriptor.extension;
      if (metadata.format !== expectedFormat || !metadata.width || !metadata.height) throw new Error('Unexpected image metadata.');
      await image.stats();
    } catch {
      throw new PipelineStoreError('The uploaded image is malformed or cannot be decoded safely.', 400, { kind: 'invalid' });
    }
  }
  return null;
};

const downloadUploadedObject = async (storagePath: string): Promise<Blob> => {
  const { data, error } = await requireStorage().download(storagePath);
  if (error || !data) throw new PipelineStoreError('The uploaded Forge Review source could not be read for validation.', 503);
  return data;
};

const assertUploadedSetPackage = async (data: Blob): Promise<void> => {
  try {
    const snapshot = await decodeCardForgeProjectPackage(data);
    const document = hydrateCardForgeProjectSnapshot(snapshot);
    if (document.cardSets.length !== 1) {
      throw new PipelineStoreError('Publish one Set per portable package.', 400);
    }
    const setId = document.cardSets[0]?.id;
    if (!setId || !document.storedCards.some((card) => card.setId === setId)) {
      throw new PipelineStoreError('Published Set packages must contain at least one card.', 400);
    }
  } catch (error) {
    if (error instanceof PipelineStoreError) throw error;
    throw new PipelineStoreError(
      error instanceof ProjectPackageError ? error.message : 'The uploaded file is not a valid portable CardForge Set.',
      400,
    );
  }
};

export const removePendingPipelineUpload = async ({
  contributorId,
  assetType,
  storagePath,
}: {
  contributorId: string;
  assetType: unknown;
  storagePath: unknown;
}): Promise<void> => {
  if (!isContributorUploadAssetType(assetType) || typeof storagePath !== 'string') return;
  assertOwnedStoragePath(contributorId, assetType, storagePath);
  const supabase = requireSupabase();
  const { data: submitted, error: lookupError } = await supabase
    .from('cardforge_contributor_asset_submissions')
    .select('id')
    .eq('contributor_id', contributorId)
    .eq('source_storage_bucket', PIPELINE_STORAGE_BUCKET)
    .eq('source_storage_path', storagePath)
    .maybeSingle();
  if (lookupError) {
    throw new PipelineStoreError('Unable to verify the unfinished Forge Review upload.', 503);
  }
  if (submitted) {
    throw new PipelineStoreError('A submitted Forge Review source cannot be removed as an unfinished upload.', 409);
  }
  const { error } = await supabase.storage.from(PIPELINE_STORAGE_BUCKET).remove([storagePath]);
  if (error) throw new PipelineStoreError('Unable to clean up the unfinished Forge Review upload.', 503);
};

export interface CreateUploadedPipelineSubmissionInput {
  contributorId: string;
  contributorEmail: string | null;
  maxFileSizeMb: number;
  assetType: unknown;
  studioDestination: unknown;
  specialtyTags: unknown;
  useCaseTags: unknown;
  semanticRole: unknown;
  visualFamily: unknown;
  variantOfAssetId: unknown;
  variantKind: unknown;
  compatibilityTags: unknown;
  name: unknown;
  description: unknown;
  previewUrl: unknown;
  uploadedFile: PipelineUploadedFile;
}

export const createUploadedPipelineSubmission = async ({
  contributorId,
  contributorEmail,
  maxFileSizeMb,
  assetType,
  studioDestination,
  specialtyTags,
  useCaseTags,
  semanticRole,
  visualFamily,
  variantOfAssetId,
  variantKind,
  compatibilityTags,
  name,
  description,
  previewUrl,
  uploadedFile,
}: CreateUploadedPipelineSubmissionInput): Promise<void> => {
  const descriptor = validatePipelineUploadDescriptor({
    assetType,
    studioDestination,
    fileName: uploadedFile.fileName,
    fileSizeBytes: uploadedFile.fileSizeBytes,
    mimeType: uploadedFile.mimeType,
    maxFileSizeMb,
  });
  assertOwnedStoragePath(contributorId, descriptor.assetType, uploadedFile.storagePath);
  const storage = requireStorage();

  try {
    await assertUploadedObjectComplete(uploadedFile.storagePath, descriptor.fileSizeBytes);
    const uploadedBytes = await downloadUploadedObject(uploadedFile.storagePath);
    if (uploadedBytes.size !== descriptor.fileSizeBytes) {
      throw new PipelineStoreError('The uploaded file bytes changed during validation. Upload the file again.', 409);
    }
    if (descriptor.assetType === 'sets') await assertUploadedSetPackage(uploadedBytes);
    else {
      const normalizedBytes = await validateUploadedAssetBytes(descriptor, uploadedBytes);
      if (normalizedBytes) {
        const { error: normalizationError } = await storage.update(uploadedFile.storagePath, normalizedBytes, {
          contentType: 'image/svg+xml',
          cacheControl: '31536000',
        });
        if (normalizationError) {
          throw new PipelineStoreError('The SVG was valid but CardForge could not store its safe vector form.', 503);
        }
        descriptor.fileSizeBytes = normalizedBytes.byteLength;
      }
    }
    const { data } = storage.getPublicUrl(uploadedFile.storagePath);
    await createPipelineSubmission({
      contributorId,
      contributorEmail,
      input: {
        assetType: descriptor.assetType,
        studioDestination: descriptor.studioDestination,
        specialtyTags,
        useCaseTags,
        semanticRole,
        visualFamily,
        variantOfAssetId,
        variantKind,
        compatibilityTags,
        name,
        description,
        previewUrl: typeof previewUrl === 'string' && previewUrl.trim() ? previewUrl.trim() : data.publicUrl,
        sourceUrl: data.publicUrl,
        sourceFileSizeBytes: descriptor.fileSizeBytes,
        sourceMimeType: descriptor.mimeType,
        sourceStorageBucket: PIPELINE_STORAGE_BUCKET,
        sourceStoragePath: uploadedFile.storagePath,
      },
    });
  } catch (error) {
    const { error: cleanupError } = await storage.remove([uploadedFile.storagePath]);
    if (cleanupError) console.error('Failed to compensate Pipeline upload:', cleanupError);
    throw error;
  }
};