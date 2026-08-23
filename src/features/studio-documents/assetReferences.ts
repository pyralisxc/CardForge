export const STUDIO_DOCUMENT_ASSET_BUCKET = 'cardforge-studio-document-assets';
export const STUDIO_DOCUMENT_ASSET_REFERENCE_PREFIX = 'cardforge-studio-asset://';
export const STUDIO_DOCUMENT_FONT_BUCKET = 'cardforge-studio-document-fonts';
export const STUDIO_DOCUMENT_FONT_REFERENCE_PREFIX = 'cardforge-studio-font://';
export const MAX_STUDIO_DOCUMENT_ASSETS = 256;
export const MAX_STUDIO_DOCUMENT_FONTS = 64;
export const MAX_STUDIO_DOCUMENT_ASSET_STORAGE_BYTES = 128 * 1024 * 1024;

export type StudioDocumentPrivateAssetMimeType =
  | 'image/webp'
  | 'font/woff2'
  | 'font/woff'
  | 'font/ttf'
  | 'font/otf'
  | 'application/font-woff'
  | 'application/x-font-ttf'
  | 'application/x-font-opentype';

export interface StudioDocumentAssetDownload {
  id: string;
  kind: 'image' | 'font';
  mimeType: StudioDocumentPrivateAssetMimeType;
  size: number | null;
  signedUrl: string;
}

export const isStudioDocumentAssetId = (value: string): boolean => /^[a-f0-9]{64}$/u.test(value);

export const getStudioDocumentAssetReference = (assetId: string): string => (
  `${STUDIO_DOCUMENT_ASSET_REFERENCE_PREFIX}${assetId}`
);

export const getStudioDocumentAssetIdFromReference = (value: string): string | null => {
  if (!value.startsWith(STUDIO_DOCUMENT_ASSET_REFERENCE_PREFIX)) return null;
  const assetId = value.slice(STUDIO_DOCUMENT_ASSET_REFERENCE_PREFIX.length);
  return isStudioDocumentAssetId(assetId) ? assetId : null;
};

export const getStudioDocumentFontReference = (assetId: string): string => (
  `${STUDIO_DOCUMENT_FONT_REFERENCE_PREFIX}${assetId}`
);

export const getStudioDocumentFontIdFromReference = (value: string): string | null => {
  if (!value.startsWith(STUDIO_DOCUMENT_FONT_REFERENCE_PREFIX)) return null;
  const assetId = value.slice(STUDIO_DOCUMENT_FONT_REFERENCE_PREFIX.length);
  return isStudioDocumentAssetId(assetId) ? assetId : null;
};

const collectReferenceIds = (
  value: unknown,
  readId: (value: string) => string | null,
): string[] => {
  const ids = new Set<string>();
  const visit = (entry: unknown) => {
    if (typeof entry === 'string') {
      const id = readId(entry);
      if (id) ids.add(id);
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (entry && typeof entry === 'object') Object.values(entry as Record<string, unknown>).forEach(visit);
  };
  visit(value);
  return [...ids];
};

export const collectStudioDocumentAssetIds = (value: unknown): string[] => (
  collectReferenceIds(value, getStudioDocumentAssetIdFromReference)
);

export const collectStudioDocumentFontIds = (value: unknown): string[] => (
  collectReferenceIds(value, getStudioDocumentFontIdFromReference)
);

export const replaceStudioDocumentAssetReferences = (
  value: unknown,
  replacements: ReadonlyMap<string, string>,
): unknown => {
  if (typeof value === 'string') {
    const id = getStudioDocumentAssetIdFromReference(value) ?? getStudioDocumentFontIdFromReference(value);
    return id ? replacements.get(id) ?? value : value;
  }
  if (Array.isArray(value)) return value.map((entry) => replaceStudioDocumentAssetReferences(entry, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => (
      [key, replaceStudioDocumentAssetReferences(entry, replacements)]
    )));
  }
  return value;
};
