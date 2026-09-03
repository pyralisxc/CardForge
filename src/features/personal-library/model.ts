export const PERSONAL_LIBRARY_PROVIDERS = ['google-drive'] as const;
export type PersonalLibraryProvider = typeof PERSONAL_LIBRARY_PROVIDERS[number];

export const PERSONAL_LIBRARY_ROLES = [
  'artwork',
  'frame',
  'texture',
  'divider',
  'icon',
  'font',
  'reference',
] as const;
export type PersonalLibraryRole = typeof PERSONAL_LIBRARY_ROLES[number];

export const PERSONAL_LIBRARY_IMAGE_MIME_TYPES = [
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
] as const;
export type PersonalLibraryImageMimeType = typeof PERSONAL_LIBRARY_IMAGE_MIME_TYPES[number];

export const PERSONAL_LIBRARY_FONT_MIME_TYPES = [
  'font/woff2',
  'font/woff',
  'font/ttf',
  'font/otf',
  'application/font-woff',
  'application/x-font-ttf',
  'application/x-font-opentype',
] as const;
export type PersonalLibraryFontMimeType = typeof PERSONAL_LIBRARY_FONT_MIME_TYPES[number];

export const MAX_PERSONAL_LIBRARY_ITEM_BYTES = 32 * 1024 * 1024;
export const MAX_PERSONAL_LIBRARY_ITEMS_PER_ACCOUNT = 2_000;
export const MAX_PERSONAL_LIBRARY_REGISTER_BATCH = 100;

export interface PersonalLibraryItem {
  id: string;
  provider: PersonalLibraryProvider;
  providerFileId: string;
  providerRevision: string;
  displayName: string;
  mimeType: string;
  role: PersonalLibraryRole;
  byteSize: number;
  providerModifiedAt: string;
  providerWebViewLink: string | null;
  contentHash: string | null;
  lastVerifiedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalLibraryListResult {
  items: PersonalLibraryItem[];
  count: number;
  limit: number;
}

export interface PersonalLibraryRegisterResult {
  items: PersonalLibraryItem[];
  registeredCount: number;
}

export interface PersonalLibraryMaterializedAsset {
  item: PersonalLibraryItem;
  bytes: Uint8Array;
  mimeType: string;
}

export const isPersonalLibraryProvider = (value: unknown): value is PersonalLibraryProvider => (
  typeof value === 'string' && (PERSONAL_LIBRARY_PROVIDERS as readonly string[]).includes(value)
);

export const isPersonalLibraryRole = (value: unknown): value is PersonalLibraryRole => (
  typeof value === 'string' && (PERSONAL_LIBRARY_ROLES as readonly string[]).includes(value)
);

export const isPersonalLibraryImageMimeType = (value: string): value is PersonalLibraryImageMimeType => (
  (PERSONAL_LIBRARY_IMAGE_MIME_TYPES as readonly string[]).includes(value.toLowerCase())
);

export const isPersonalLibraryFontMimeType = (value: string): value is PersonalLibraryFontMimeType => (
  (PERSONAL_LIBRARY_FONT_MIME_TYPES as readonly string[]).includes(value.toLowerCase())
);

export const isPersonalLibraryMimeTypeAllowedForRole = (
  role: PersonalLibraryRole,
  mimeType: string,
): boolean => {
  if (role === 'font') return isPersonalLibraryFontMimeType(mimeType);
  if (role === 'reference') return isPersonalLibraryImageMimeType(mimeType) || isPersonalLibraryFontMimeType(mimeType);
  return isPersonalLibraryImageMimeType(mimeType);
};

export const isPersonalLibraryVisualPickerItem = (
  item: Pick<PersonalLibraryItem, 'mimeType' | 'role'>,
  acceptedRoles: readonly PersonalLibraryRole[],
): boolean => acceptedRoles.includes(item.role) && isPersonalLibraryImageMimeType(item.mimeType);

export const getPersonalLibraryRoleLabel = (role: PersonalLibraryRole): string => {
  switch (role) {
    case 'artwork': return 'Artwork';
    case 'frame': return 'Frames';
    case 'texture': return 'Textures';
    case 'divider': return 'Dividers';
    case 'icon': return 'Icons';
    case 'font': return 'Fonts';
    case 'reference': return 'Reference';
  }
};
