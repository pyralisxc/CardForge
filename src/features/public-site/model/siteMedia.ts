export const SITE_MEDIA_BUCKET = 'cardforge-public-media';

export const SITE_MEDIA_SLOTS = [
  'landing.hero',
  'landing.showcase.layout',
  'landing.showcase.generator-single',
  'landing.showcase.generator-bulk',
] as const;

export type SiteMediaSlot = typeof SITE_MEDIA_SLOTS[number];

export interface SiteMediaAsset {
  slot: SiteMediaSlot;
  label: string;
  defaultSrc: string;
  defaultAlt: string;
  storagePath: string | null;
  alt: string;
  updatedAt: string | null;
}

type SiteMediaDefaults = Omit<SiteMediaAsset, 'storagePath' | 'alt' | 'updatedAt'>;

export const DEFAULT_SITE_MEDIA: SiteMediaDefaults[] = [
  {
    slot: 'landing.hero',
    label: 'Homepage cover',
    defaultSrc: '/card-assets/showcase/cardforge-workshop-cover.webp',
    defaultAlt: 'A warm CardForge workshop with illustrated card proofs, drawing tools, and a card-layout screen spread across a dark wood desk.',
  },
  {
    slot: 'landing.showcase.layout',
    label: 'Design layouts screenshot',
    defaultSrc: '/card-assets/showcase/studio-layout.jpg',
    defaultAlt: 'The CardForge card design workspace with its card design library, editable canvas, layers, controls, and card field inspector.',
  },
  {
    slot: 'landing.showcase.generator-single',
    label: 'Make one card screenshot',
    defaultSrc: '/card-assets/showcase/studio-generator-single.jpg',
    defaultAlt: 'The CardForge Make Cards area showing the card design setup and the details for one card.',
  },
  {
    slot: 'landing.showcase.generator-bulk',
    label: 'Use a list screenshot',
    defaultSrc: '/card-assets/showcase/studio-generator-bulk.jpg',
    defaultAlt: 'The CardForge Make Cards area showing a card list and the cards ready for review.',
  },
];

const defaultsBySlot = new Map(DEFAULT_SITE_MEDIA.map((asset) => [asset.slot, asset]));

export const isSiteMediaSlot = (value: unknown): value is SiteMediaSlot => (
  typeof value === 'string' && SITE_MEDIA_SLOTS.includes(value as SiteMediaSlot)
);

export const getDefaultSiteMedia = (slot: SiteMediaSlot): SiteMediaAsset => {
  const asset = defaultsBySlot.get(slot);
  if (!asset) throw new Error(`Unknown site media slot: ${slot}`);
  return { ...asset, storagePath: null, alt: asset.defaultAlt, updatedAt: null };
};

export const getSiteMediaStoragePath = (slot: SiteMediaSlot, version: string): string => (
  `landing/${slot.replace('landing.', '')}/${version}.webp`
);

export const getSiteMediaDisplaySrc = (asset: SiteMediaAsset): string => {
  if (!asset.storagePath) return asset.defaultSrc;
  const version = asset.updatedAt ?? asset.storagePath;
  return `/api/public/site-media/${asset.slot}?v=${encodeURIComponent(version)}`;
};

export const normalizeSiteMediaAlt = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const alt = value.trim();
  return alt && alt.length <= 300 ? alt : null;
};
