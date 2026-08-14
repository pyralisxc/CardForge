export const SITE_MEDIA_BUCKET = 'cardforge-public-media';

export const SITE_MEDIA_SLOTS = [
  'brand.mark',
  'brand.favicon',
  'brand.watermark',
  'brand.social',
  'landing.hero',
  'landing.showcase.layout',
  'landing.showcase.generator-single',
  'landing.showcase.generator-bulk',
  'landing.showcase.art.playing.ace',
  'landing.showcase.art.playing.king',
  'landing.showcase.art.playing.queen',
  'landing.showcase.art.playing.jack',
  'landing.showcase.art.creature.emberclaw',
  'landing.showcase.art.creature.mossback',
  'landing.showcase.art.creature.moonveil',
  'landing.showcase.art.creature.stormglass',
  'founder.portrait',
] as const;

export type SiteMediaSlot = typeof SITE_MEDIA_SLOTS[number];
export type SiteMediaKind = 'brand' | 'favicon' | 'watermark' | 'social' | 'hero' | 'showcase' | 'showcase-art' | 'portrait';
export type SiteMediaGroup = 'brand' | 'landing' | 'showcase' | 'founder';
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
  group: SiteMediaGroup;
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

const showcaseArtwork = [
  { slot: 'landing.showcase.art.playing.ace', label: 'Arcane Court — Ace artwork', defaultSrc: '/card-assets/showcase/playing-cards/ace-of-spades.webp', defaultAlt: 'Night Sentinel artwork for the Arcane Court ace of spades', width: 720, height: 1186 },
  { slot: 'landing.showcase.art.playing.king', label: 'Arcane Court — King artwork', defaultSrc: '/card-assets/showcase/playing-cards/king-of-hearts.webp', defaultAlt: 'Rosebound King artwork for the Arcane Court king of hearts', width: 720, height: 1080 },
  { slot: 'landing.showcase.art.playing.queen', label: 'Arcane Court — Queen artwork', defaultSrc: '/card-assets/showcase/playing-cards/queen-of-diamonds.webp', defaultAlt: 'Prism Sovereign artwork for the Arcane Court queen of diamonds', width: 720, height: 1080 },
  { slot: 'landing.showcase.art.playing.jack', label: 'Arcane Court — Jack artwork', defaultSrc: '/card-assets/showcase/playing-cards/jack-of-clubs.webp', defaultAlt: 'Greenwood Tinker artwork for the Arcane Court jack of clubs', width: 720, height: 1080 },
  { slot: 'landing.showcase.art.creature.emberclaw', label: 'Bestiary — Emberclaw artwork', defaultSrc: '/card-assets/showcase/creatures/emberclaw-whelp.webp', defaultAlt: 'Emberclaw Whelp artwork for the Arcane Creature Bestiary', width: 960, height: 640 },
  { slot: 'landing.showcase.art.creature.mossback', label: 'Bestiary — Mossback artwork', defaultSrc: '/card-assets/showcase/creatures/mossback-guardian.webp', defaultAlt: 'Mossback Guardian artwork for the Arcane Creature Bestiary', width: 960, height: 640 },
  { slot: 'landing.showcase.art.creature.moonveil', label: 'Bestiary — Moonveil artwork', defaultSrc: '/card-assets/showcase/creatures/moonveil-stag.webp', defaultAlt: 'Moonveil Stag artwork for the Arcane Creature Bestiary', width: 960, height: 640 },
  { slot: 'landing.showcase.art.creature.stormglass', label: 'Bestiary — Stormglass artwork', defaultSrc: '/card-assets/showcase/creatures/stormglass-siren.webp', defaultAlt: 'Stormglass Siren artwork for the Arcane Creature Bestiary', width: 960, height: 640 },
] as const satisfies ReadonlyArray<{
  slot: SiteMediaSlot;
  label: string;
  defaultSrc: string;
  defaultAlt: string;
  width: number;
  height: number;
}>;

export const DEFAULT_SITE_MEDIA: SiteMediaDefaults[] = [
  {
    slot: 'brand.mark',
    group: 'brand',
    kind: 'brand',
    label: 'Brand mark',
    guidance: 'Used in public and Studio navigation plus structured search data. A transparent square or portrait image works best.',
    defaultSrc: '/brand/cardforge-studio/brand-mark.svg',
    defaultAlt: 'CardForge Studio brand mark',
    width: 320,
    height: 420,
    presentation: {
      ...centeredPresentation,
      frame: 'natural',
      fit: 'contain',
      desktopSize: 'standard',
      mobileSize: 'standard',
    },
  },
  {
    slot: 'brand.favicon',
    group: 'brand',
    kind: 'favicon',
    label: 'Browser and app icon',
    guidance: 'Used as the favicon, shortcut icon, and mobile app icon. Choose a simple square image that remains clear at very small sizes.',
    defaultSrc: '/brand/cardforge-studio/favicon.svg',
    defaultAlt: 'CardForge Studio browser icon',
    width: 128,
    height: 128,
    presentation: {
      ...centeredPresentation,
      frame: 'natural',
      fit: 'contain',
      desktopSize: 'standard',
      mobileSize: 'standard',
    },
  },
  {
    slot: 'brand.watermark',
    group: 'brand',
    kind: 'watermark',
    label: 'Card watermark',
    guidance: 'Shown on free card previews and social images. Use a wide transparent image with high-contrast lettering or a recognizable mark.',
    defaultSrc: '/brand/cardforge-studio/watermark.svg',
    defaultAlt: 'CardForge Studio watermark',
    width: 1000,
    height: 260,
    presentation: {
      ...centeredPresentation,
      frame: 'natural',
      fit: 'contain',
      desktopSize: 'standard',
      mobileSize: 'standard',
    },
  },
  {
    slot: 'brand.social',
    group: 'brand',
    kind: 'social',
    label: 'Default social share image',
    guidance: 'Used when a public page does not provide its own share image. A 1600 × 900 landscape image is recommended.',
    defaultSrc: '/card-assets/landing/cardforge-hero-workbench.png',
    defaultAlt: 'CardForge Studio card-system workspace and finished card designs',
    width: 1600,
    height: 900,
    presentation: {
      ...centeredPresentation,
      frame: 'wide',
      fit: 'cover',
      desktopSize: 'standard',
      mobileSize: 'standard',
    },
  },
  {
    slot: 'landing.hero',
    group: 'landing',
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
    group: 'landing',
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
    group: 'landing',
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
    group: 'landing',
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
  ...showcaseArtwork.map((artwork): SiteMediaDefaults => ({
    ...artwork,
    group: 'showcase',
    kind: 'showcase-art',
    guidance: 'Used inside a rendered homepage example card. Replace the source artwork here; the Pipeline template still owns its crop and frame.',
    presentation: {
      ...centeredPresentation,
      frame: 'natural',
      fit: 'contain',
      desktopSize: 'standard',
      mobileSize: 'standard',
    },
  })),
  {
    slot: 'founder.portrait',
    group: 'founder',
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
  if ((slot === 'brand.mark' || slot === 'brand.favicon' || slot === 'brand.watermark')
    && (presentation.frame !== 'natural' || presentation.fit !== 'contain')) {
    return { ok: false, message: 'Brand marks, icons, and watermarks must keep their natural transparent frame.' };
  }
  if (slot.startsWith('landing.showcase.art.')
    && (presentation.frame !== 'natural' || presentation.fit !== 'contain')) {
    return { ok: false, message: 'Showcase artwork keeps its natural source frame; the Pipeline template owns its card crop.' };
  }
  if (slot === 'brand.social' && (presentation.frame !== 'wide' || presentation.fit !== 'cover')) {
    return { ok: false, message: 'The default social image must fill its wide frame.' };
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
  if (slot === 'brand.social') return `brand/social/${version}.webp`;
  if (slot.startsWith('brand.')) return `brand/${slot.replace('brand.', '')}/${version}.png`;
  return `landing/${slot.replace('landing.', '')}/${version}.webp`;
};

export const getSiteMediaContentType = (slot: SiteMediaSlot): 'image/png' | 'image/webp' => (
  slot.startsWith('brand.') && slot !== 'brand.social' ? 'image/png' : 'image/webp'
);

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
