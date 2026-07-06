import type { AppearanceStyleLibrary, TCGCardTemplate } from '@/types';
import type { CardAssetOption } from '@/lib/cardAssets';

type TemplatesPayload = { defaults?: Partial<TCGCardTemplate>[]; userTemplates?: Partial<TCGCardTemplate>[] };
type StylesPayload = Partial<AppearanceStyleLibrary>;
type AssetsPayload = {
  textures?: CardAssetOption[];
  dividers?: CardAssetOption[];
  parts?: CardAssetOption[];
  icons?: CardAssetOption[];
  imageAssets?: CardAssetOption[];
  templates?: CardAssetOption[];
  elementPresets?: CardAssetOption[];
  registry?: {
    configured: boolean;
    source: 'database';
    total: number;
  };
};

let templatesPromise: Promise<TemplatesPayload> | null = null;
let stylesPromise: Promise<StylesPayload> | null = null;
let assetsPromise: Promise<AssetsPayload> | null = null;

async function fetchJson<T>(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

const withBootstrapRetry = <T>(
  load: () => Promise<T>,
  reset: () => void,
) => load().catch((error) => {
  reset();
  throw error;
});

export function loadBootstrapTemplates() {
  templatesPromise ??= withBootstrapRetry(
    () => fetchJson<TemplatesPayload>('/api/templates'),
    () => {
      templatesPromise = null;
    },
  );
  return templatesPromise;
}

export function loadBootstrapStyles() {
  stylesPromise ??= withBootstrapRetry(
    () => fetchJson<StylesPayload>('/api/styles'),
    () => {
      stylesPromise = null;
    },
  );
  return stylesPromise;
}

export function loadBootstrapAssets() {
  assetsPromise ??= withBootstrapRetry(
    () => fetchJson<AssetsPayload>('/api/assets'),
    () => {
      assetsPromise = null;
    },
  );
  return assetsPromise;
}
