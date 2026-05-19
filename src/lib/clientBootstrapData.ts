import type { AppearanceStyleLibrary, TCGCardTemplate } from '@/types';
import type { CardAssetOption } from '@/lib/cardAssets';

type TemplatesPayload = { defaults?: Partial<TCGCardTemplate>[]; userTemplates?: Partial<TCGCardTemplate>[] };
type StylesPayload = Partial<AppearanceStyleLibrary>;
type AssetsPayload = { textures?: CardAssetOption[]; dividers?: CardAssetOption[] };

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

export function loadBootstrapTemplates() {
  templatesPromise ??= fetchJson<TemplatesPayload>('/api/templates');
  return templatesPromise;
}

export function loadBootstrapStyles() {
  stylesPromise ??= fetchJson<StylesPayload>('/api/styles');
  return stylesPromise;
}

export function loadBootstrapAssets() {
  assetsPromise ??= fetchJson<AssetsPayload>('/api/assets');
  return assetsPromise;
}
