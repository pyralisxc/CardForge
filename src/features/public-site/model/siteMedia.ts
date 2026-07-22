export const SITE_MEDIA_BUCKET = 'cardforge-public-media';

export const SITE_MEDIA_SLOTS = [
  'landing.hero',
  'landing.showcase.layout',
  'landing.showcase.generator-single',
  'landing.showcase.generator-bulk',
  'founder.portrait',
] as const;

export type SiteMediaSlot = typeof SITE_MEDIA_SLOTS[number];
export type SiteMediaKind = 'hero' | 'showcase' | 'portrait';
export type SiteMediaFrame = 'natural' | 'wide' | 'portrait';
export type SiteMediaFit = 'contain' | 'cover';
export type SiteMediaSize = 'compact' | 'standard' | 'large';

export interface SiteMediaPresentation {
  frame: SiteMediaFrame;
  fit: SiteMediaFit;
  desktopSize: SiteMediaSize;
  mobileSize: SiteMediaSize;
  desktopFocalX: number;
  desktopFocalY: number;
  mobileFocalX: number;
  mobileFocalY: number;
  desktopZoom: number;
  mobileZoom: number;
  overlayStrength: number;
}

export interface SiteMediaVersion {
  storagePath: string | null;
  alt: string;
  width: number | null;
  height: number | null;
  presentation: SiteMediaPresentation;
  updatedAt: string | null;
}

export interface SiteMediaAsset {
  slot: SiteMediaSlot;
  kind: SiteMediaKind;
  label: string;
  guidance: string;
  defaultSrc: string | null;
  defaultAlt: string;
  storagePath: string | null;
  alt: string;
  width: number | null;
  height: number | null;
  presentation: SiteMediaPresentation;
  previousVersion: SiteMediaVersion | null;
  updatedAt: string | null;
}

type SiteMediaDefaults = Omit<
  SiteMediaAsset,
  'storagePath' | 'alt' | 'previousVersion' | 'updatedAt'
>;

const centeredPresentation = {
  desktopFocalX: 50,
  desktopFocalY: 50,
  mobileFocalX: 50,
  mobileFocalY: 50,
  desktopZoom: 1,
  mobileZoom: 1,
  overlayStrength: 0,
} satisfies Omit<SiteMediaPresentation, 'frame' | 'fit' | 'desktopSize' | 'mobileSize'>;

export const DEFAULT_SITE_MEDIA: SiteMediaDefaults[] = [
  {
    slot: 'landing.hero',
    kind: 'hero',
    label: 'Homepage cover',
    guidance: 'Best with a wide image at least 1600 × 900. Keep the main subject clear of the left-side headline.',
    defaultSrc: '/card-assets/showcase/cardforge-workshop-cover.webp',
    defaultAlt: 'A warm CardForge workshop with illustrated card proofs, drawing tools, and a card-layout screen spread across a dark wood desk.',
    width: 1920,
    height: 768,
    presentation: {
      ...centeredPresentation,
      frame: 'wide',
      fit: 'cover',
      desktopSize: 'standard',
      mobileSize: 'standard',
      desktopFocalX: 62,
      mobileFocalX: 62,
      overlayStrength: 100,
    },
  },
  {
    slot: 'landing.showcase.layout',
    kind: 'showcase',
    label: 'Design layouts screenshot',
    guidance: 'Use the natural frame for a full Studio screenshot. Wide and portrait frames are available for intentional crops.',
    defaultSrc: '/card-assets/showcase/studio-layout.jpg',
    defaultAlt: 'The CardForge card design workspace with its card design library, editable canvas, layers, controls, and card field inspector.',
    width: 1119,
    height: 1536,
    presentation: {
      ...centeredPresentation,
      frame: 'natural',
      fit: 'contain',
      desktopSize: 'large',
      mobileSize: 'large',
    },
  },
  {
    slot: 'landing.showcase.generator-single',
    kind: 'showcase',
    label: 'Make one card screenshot',
    guidance: 'A tall Studio screenshot works well here. Natural framing keeps the entire workflow visible and scrollable.',
    defaultSrc: '/card-assets/showcase/studio-generator-single.jpg',
    defaultAlt: 'The CardForge Make Cards area showing the card design setup and the details for one card.',
    width: 869,
    height: 1536,
    presentation: {
      ...centeredPresentation,
      frame: 'natural',
      fit: 'contain',
      desktopSize: 'standard',
      mobileSize: 'large',
    },
  },
  {
    slot: 'landing.showcase.generator-bulk',
    kind: 'showcase',
    label: 'Use a list screenshot',
    guidance: 'A tall Studio screenshot works well here. Natural framing keeps the entire workflow visible and scrollable.',
    defaultSrc: '/card-assets/showcase/studio-generator-bulk.jpg',
    defaultAlt: 'The CardForge Make Cards area showing a card list and the cards ready for review.',
    width: 904,
    height: 1536,
    presentation: {
      ...centeredPresentation,
      frame: 'natural',
      fit: 'contain',
      desktopSize: 'standard',
      mobileSize: 'large',
    },
  },
  {
    slot: 'founder.portrait',
    kind: 'portrait',
    label: 'Cameron portrait',
    guidance: 'Best with a portrait at least 800 × 1000. Reposition the focal point to keep your face framed on every screen.',
    defaultSrc: null,
    defaultAlt: 'Portrait of Cameron Locke',
    width: 1600,
    height: 2000,
    presentation: {
      ...centeredPresentation,
      frame: 'portrait',
      fit: 'cover',
      desktopSize: 'standard',
      mobileSize: 'standard',
    },
  },
];

const defaultsBySlot = new Map(DEFAULT_SITE_MEDIA.map((asset) => [asset.slot, asset]));
const presentationKeys = new Set<keyof SiteMediaPresentation>([
  'frame',
  'fit',
  'desktopSize',
  'mobileSize',
  'desktopFocalX',
  'desktopFocalY',
  'mobileFocalX',
  'mobileFocalY',
  'desktopZoom',
  'mobileZoom',
  'overlayStrength',
]);
const frames = new Set<SiteMediaFrame>(['natural', 'wide', 'portrait']);
const fits = new Set<SiteMediaFit>(['contain', 'cover']);
const sizes = new Set<SiteMediaSize>(['compact', 'standard', 'large']);

export const isSiteMediaSlot = (value: unknown): value is SiteMediaSlot => (
  typeof value === 'string' && SITE_MEDIA_SLOTS.includes(value as SiteMediaSlot)
);

export const getDefaultSiteMedia = (slot: SiteMediaSlot): SiteMediaAsset => {
  const asset = defaultsBySlot.get(slot);
  if (!asset) throw new Error(`Unknown site media slot: ${slot}`);
  return {
    ...asset,
    presentation: { ...asset.presentation },
    storagePath: null,
    alt: asset.defaultAlt,
    previousVersion: null,
    updatedAt: null,
  };
};

export type SiteMediaPresentationResult =
  | { ok: true; value: SiteMediaPresentation }
  | { ok: false; message: string };

export const normalizeSiteMediaPresentation = (
  slot: SiteMediaSlot,
  value: unknown,
): SiteMediaPresentationResult => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, message: 'Image presentation settings are required.' };
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !presentationKeys.has(key as keyof SiteMediaPresentation))) {
    return { ok: false, message: 'Image presentation contains an unknown setting.' };
  }

  const presentation = {
    ...getDefaultSiteMedia(slot).presentation,
    ...record,
  } as SiteMediaPresentation;
  if (!frames.has(presentation.frame) || !fits.has(presentation.fit)) {
    return { ok: false, message: 'Choose a supported image frame and fit.' };
  }
  if (!sizes.has(presentation.desktopSize) || !sizes.has(presentation.mobileSize)) {
    return { ok: false, message: 'Choose a supported responsive image size.' };
  }
  if (slot === 'landing.hero' && (presentation.frame !== 'wide' || presentation.fit !== 'cover')) {
    return { ok: false, message: 'The homepage cover must fill its wide frame.' };
  }
  if (slot === 'founder.portrait' && (presentation.frame !== 'portrait' || presentation.fit !== 'cover')) {
    return { ok: false, message: 'The founder portrait must fill its portrait frame.' };
  }
  if (slot.includes('showcase') && presentation.frame === 'natural' && presentation.fit !== 'contain') {
    return { ok: false, message: 'Natural screenshots must show the full image.' };
  }

  const percentages = [
    presentation.desktopFocalX,
    presentation.desktopFocalY,
    presentation.mobileFocalX,
    presentation.mobileFocalY,
    presentation.overlayStrength,
  ];
  if (percentages.some((number) => typeof number !== 'number' || !Number.isFinite(number) || number < 0 || number > 100)) {
    return { ok: false, message: 'Image positions and overlay strength must be between 0 and 100.' };
  }
  const zooms = [presentation.desktopZoom, presentation.mobileZoom];
  if (zooms.some((number) => typeof number !== 'number' || !Number.isFinite(number) || number < 1 || number > 2)) {
    return { ok: false, message: 'Image zoom must be between 1× and 2×.' };
  }

  return { ok: true, value: presentation };
};

export const getSiteMediaStoragePath = (slot: SiteMediaSlot, version: string): string => {
  if (slot === 'founder.portrait') return `founder/portrait/${version}.webp`;
  return `landing/${slot.replace('landing.', '')}/${version}.webp`;
};

export const getSiteMediaDisplaySrc = (asset: SiteMediaAsset): string | null => {
  if (!asset.storagePath) return asset.defaultSrc;
  const version = asset.updatedAt ?? asset.storagePath;
  return `/api/public/site-media/${asset.slot}?v=${encodeURIComponent(version)}`;
};

export const normalizeSiteMediaAlt = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const alt = value.trim();
  return alt && alt.length <= 300 ? alt : null;
};
