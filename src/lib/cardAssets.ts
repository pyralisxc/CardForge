export interface CardAssetOption {
  id: string;
  name: string;
  url: string;
  kind: 'texture' | 'divider' | 'border' | 'frame';
  tileMode: 'repeat' | 'stretch' | 'contain';
  seamless: boolean;
  allowedTargets: Array<'text' | 'shape' | 'divider' | 'template' | 'imageFrame'>;
  defaultBlendMode?: string;
  defaultOpacity?: number;
  defaultScale?: number;
}

export const CARD_TEXTURE_ASSETS: CardAssetOption[] = [
  { id: 'parchment-grain', name: 'Parchment Grain', url: '/card-assets/textures/parchment-grain.svg', kind: 'texture', tileMode: 'repeat', seamless: true, allowedTargets: ['text', 'shape', 'template'], defaultBlendMode: 'multiply', defaultOpacity: 42, defaultScale: 160 },
  { id: 'dark-leather', name: 'Dark Leather', url: '/card-assets/textures/dark-leather.svg', kind: 'texture', tileMode: 'repeat', seamless: true, allowedTargets: ['text', 'shape', 'template'], defaultBlendMode: 'overlay', defaultOpacity: 46, defaultScale: 180 },
  { id: 'hammered-metal', name: 'Hammered Metal Surface', url: '/card-assets/textures/hammered-metal.svg', kind: 'texture', tileMode: 'contain', seamless: false, allowedTargets: ['shape', 'template'], defaultBlendMode: 'overlay', defaultOpacity: 40, defaultScale: 150 },
  { id: 'purple-foil', name: 'Purple Foil Surface', url: '/card-assets/textures/purple-foil.svg', kind: 'texture', tileMode: 'contain', seamless: false, allowedTargets: ['shape', 'template'], defaultBlendMode: 'screen', defaultOpacity: 44, defaultScale: 190 },
  { id: 'arcane-hatch', name: 'Arcane Hatch', url: '/card-assets/textures/arcane-hatch.svg', kind: 'texture', tileMode: 'repeat', seamless: true, allowedTargets: ['text', 'shape', 'template'], defaultBlendMode: 'soft-light', defaultOpacity: 54, defaultScale: 140 },
  { id: 'ink-wash', name: 'Ink Wash Surface', url: '/card-assets/textures/ink-wash.svg', kind: 'texture', tileMode: 'contain', seamless: false, allowedTargets: ['shape', 'template'], defaultBlendMode: 'multiply', defaultOpacity: 34, defaultScale: 170 },
  { id: 'stone-grain', name: 'Stone Grain', url: '/card-assets/textures/stone-grain.svg', kind: 'texture', tileMode: 'repeat', seamless: true, allowedTargets: ['text', 'shape', 'template'], defaultBlendMode: 'overlay', defaultOpacity: 42, defaultScale: 160 },
  { id: 'worn-paper', name: 'Worn Paper', url: '/card-assets/textures/worn-paper.svg', kind: 'texture', tileMode: 'repeat', seamless: true, allowedTargets: ['text', 'shape', 'template'], defaultBlendMode: 'multiply', defaultOpacity: 38, defaultScale: 170 },
];

export const CARD_DIVIDER_ASSETS: CardAssetOption[] = [
  { id: 'gilded-filigree', name: 'Gilded Filigree', url: '/card-assets/dividers/gilded-filigree.svg', kind: 'divider', tileMode: 'stretch', seamless: false, allowedTargets: ['divider'], defaultBlendMode: 'normal', defaultOpacity: 100, defaultScale: 100 },
  { id: 'gem-center', name: 'Gem Center', url: '/card-assets/dividers/gem-center.svg', kind: 'divider', tileMode: 'stretch', seamless: false, allowedTargets: ['divider'], defaultBlendMode: 'normal', defaultOpacity: 100, defaultScale: 100 },
  { id: 'runic-thread', name: 'Runic Thread', url: '/card-assets/dividers/runic-thread.svg', kind: 'divider', tileMode: 'stretch', seamless: false, allowedTargets: ['divider'], defaultBlendMode: 'normal', defaultOpacity: 100, defaultScale: 100 },
  { id: 'double-rule', name: 'Double Rule', url: '/card-assets/dividers/double-rule.svg', kind: 'divider', tileMode: 'stretch', seamless: false, allowedTargets: ['divider'], defaultBlendMode: 'normal', defaultOpacity: 100, defaultScale: 100 },
  { id: 'vine-rule', name: 'Vine Rule', url: '/card-assets/dividers/vine-rule.svg', kind: 'divider', tileMode: 'stretch', seamless: false, allowedTargets: ['divider'], defaultBlendMode: 'normal', defaultOpacity: 100, defaultScale: 100 },
  { id: 'arcane-chevron', name: 'Arcane Chevron', url: '/card-assets/dividers/arcane-chevron.svg', kind: 'divider', tileMode: 'stretch', seamless: false, allowedTargets: ['divider'], defaultBlendMode: 'normal', defaultOpacity: 100, defaultScale: 100 },
];

export const SEAMLESS_TEXTURE_ASSETS = CARD_TEXTURE_ASSETS.filter(asset =>
  asset.kind === 'texture' && asset.seamless && asset.tileMode === 'repeat',
);

export const findCardAsset = (idOrUrl?: string): CardAssetOption | undefined =>
  [...CARD_TEXTURE_ASSETS, ...CARD_DIVIDER_ASSETS].find(asset => asset.id === idOrUrl || asset.url === idOrUrl);
