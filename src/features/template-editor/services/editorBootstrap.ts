import type { CardFontOption } from '@/domain/rendering';
import type { CardAssetOption } from '@/domain/templates';

type AssetsPayload = {
  textures?: CardAssetOption[];
  dividers?: CardAssetOption[];
  parts?: CardAssetOption[];
  icons?: CardAssetOption[];
  imageAssets?: CardAssetOption[];
  templates?: CardAssetOption[];
  elementPresets?: CardAssetOption[];
};

type FontsPayload = { fonts?: CardFontOption[] };

let assetsPromise: Promise<AssetsPayload> | null = null;
let fontsPromise: Promise<FontsPayload> | null = null;

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return response.json() as Promise<T>;
};

export const loadEditorAssets = () => {
  assetsPromise ??= fetchJson<AssetsPayload>('/api/assets').catch((error) => {
    assetsPromise = null;
    throw error;
  });
  return assetsPromise;
};

export const loadEditorFonts = () => {
  fontsPromise ??= fetchJson<FontsPayload>('/api/fonts').catch((error) => {
    fontsPromise = null;
    throw error;
  });
  return fontsPromise;
};
