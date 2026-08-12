import type { CardData } from '@/domain/cards';
import type { CardFormatId } from '@/domain/card-formats';

export type FreeformElementType = 'text' | 'image' | 'icon' | 'shape';
export type FreeformShapeKind = 'rectangle' | 'ellipse' | 'diamond' | 'hexagon' | 'capsule' | 'banner' | 'notch-panel' | 'bracket-frame' | 'corner-frame' | 'line';
export type FreeformShapeRole = 'basic' | 'panel' | 'artFrame' | 'rulesBox' | 'titlePlate' | 'statGem' | 'costOrb' | 'divider';
export type GeneratorFieldKind = 'text' | 'structuredRows';
export type TemplateFieldContractType = GeneratorFieldKind | 'image';
export type TemplateFieldAllowedFormatting = 'bold' | 'italic' | 'underline' | 'color' | 'highlight' | 'lists' | 'rulesMarkers';
export type TemplateSource = 'default' | 'user';
export type TemplateUsage = 'standard' | 'back-preset';

export interface CardAssetOption {
  id: string;
  name: string;
  url: string;
  kind: 'texture' | 'divider' | 'border' | 'frame' | 'part' | 'icon' | 'image' | 'template' | 'elementPreset';
  librarySource?: 'official' | 'developer' | 'local';
  accessTier?: 'free' | 'paid' | 'developer' | 'hidden';
  registryStatus?: 'draft' | 'submitted' | 'voting' | 'publish_candidate' | 'published' | 'archived' | 'rejected' | 'localOnly';
  fileSizeBytes?: number;
  packId?: string;
  packName?: string;
  tileMode: 'repeat' | 'stretch' | 'contain';
  seamless: boolean;
  allowedTargets: Array<'text' | 'shape' | 'divider' | 'template' | 'imageFrame' | 'icon' | 'image'>;
  defaultBlendMode?: string;
  defaultOpacity?: number;
  defaultScale?: number;
  partRole?: 'outerFrame' | 'frameRail' | 'corner' | 'titlePlate' | 'artWindow' | 'rulesBox' | 'statGem' | 'costOrb' | 'panel' | 'overlay' | 'ornament';
  defaultWidth?: number;
  defaultHeight?: number;
}

export type AppearanceTarget = 'element' | 'text' | 'image' | 'icon' | 'shape' | 'divider' | 'template';
export type AppearanceStyleKind = 'material' | 'border' | 'divider' | 'icon' | 'theme' | 'shapeRole' | 'frameKit';
export type AppearanceGradientType = 'linear' | 'radial' | 'none';
export type AppearanceTextureKind = 'none' | 'parchment' | 'foil' | 'etched' | 'grain' | 'hatch' | 'uploaded';
export type AppearanceBorderKind = 'none' | 'solid' | 'double' | 'etched' | 'relic' | 'foil';
export type AppearanceTileMode = 'repeat' | 'stretch' | 'contain';

export interface AppearanceGradientStop {
  id: string;
  color: string;
  position: number;
  opacity?: number;
}

export interface AppearanceGradient {
  type: AppearanceGradientType;
  angle?: number;
  stops: AppearanceGradientStop[];
}

export interface AppearanceTexture {
  kind: AppearanceTextureKind;
  intensity?: number;
  scale?: number;
  imageSource?: string;
  assetSource?: string;
  assetKind?: 'texture' | 'divider' | 'border' | 'frame' | 'part';
  blendMode?: string;
  textureScale?: number;
  textureOpacity?: number;
  tileMode?: AppearanceTileMode;
}

export interface AppearanceBorder {
  kind: AppearanceBorderKind;
  color?: string;
  secondaryColor?: string;
  width?: number;
  radius?: number;
  innerWidth?: number;
  outerWidth?: number;
}

export interface AppearanceEffects {
  shadow?: number;
  glow?: number;
  bevel?: number;
  innerHighlight?: number;
  overlayOpacity?: number;
}

export interface FreeformAppearance {
  assetSource?: string;
  assetKind?: 'texture' | 'divider' | 'border' | 'frame' | 'part';
  blendMode?: string;
  textureScale?: number;
  textureOpacity?: number;
  tileMode?: AppearanceTileMode;
  dividerAsset?: string;
  shapeRole?: FreeformShapeRole;
  material?: {
    name?: string;
    baseColor?: string;
    textColor?: string;
    fillColor?: string;
    strokeColor?: string;
    gradient?: AppearanceGradient;
    texture?: AppearanceTexture;
  };
  border?: AppearanceBorder;
  effects?: AppearanceEffects;
  rawCss?: {
    backgroundImage?: string;
    borderImageSource?: string;
  };
}

export interface AppearanceStylePreset {
  id: string;
  name: string;
  kind: AppearanceStyleKind;
  targets: AppearanceTarget[];
  appearance: FreeformAppearance;
  updates?: Partial<FreeformCardElement>;
  templateUpdates?: Partial<TCGCardTemplate>;
  librarySource?: 'official' | 'developer' | 'local';
  accessTier?: 'free' | 'paid' | 'developer' | 'hidden';
  registryStatus?: 'draft' | 'submitted' | 'voting' | 'publish_candidate' | 'published' | 'archived' | 'rejected' | 'localOnly';
  contributorName?: string;
}

export interface AppearanceStyleLibrary {
  version: number;
  styles: AppearanceStylePreset[];
}

export interface FreeformCardElement {
  id: string;
  type: FreeformElementType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  opacity?: number;
  zIndex: number;
  locked?: boolean;
  parentId?: string;
  visible?: boolean;
  content?: string;
  imageSource?: string;
  iconImageSource?: string;
  iconName?: string;
  shapeKind?: FreeformShapeKind;
  shapeRole?: FreeformShapeRole;
  textColor?: string;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  fontFamily?: string;
  fontSize?: 'text-xs' | 'text-sm' | 'text-base' | 'text-lg' | 'text-xl' | 'text-2xl';
  fontSizePx?: number;
  fontWeight?: 'font-normal' | 'font-medium' | 'font-semibold' | 'font-bold';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  fontStyle?: 'normal' | 'italic';
  writingMode?: 'horizontal-tb' | 'vertical-rl' | 'vertical-lr';
  letterSpacing?: string;
  lineHeight?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textDecoration?: 'none' | 'underline' | 'line-through';
  generatorFieldKind?: GeneratorFieldKind;
  generatorFieldRequired?: boolean;
  textAutoFit?: boolean;
  textMinFontSizePx?: number;
  padding?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  minHeight?: string;
  imageObjectFit?: 'cover' | 'contain' | 'fill' | 'none';
  imageObjectPositionX?: string;
  imageObjectPositionY?: string;
  imageScale?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
  imageRotation?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  appearance?: FreeformAppearance;
}

export interface FreeformCanvas {
  width: number;
  height: number;
  gridSize?: number;
  elements: FreeformCardElement[];
}

export interface TemplateFieldContract {
  key: string;
  elementId?: string;
  label?: string;
  type?: TemplateFieldContractType;
  required?: boolean;
  multiline?: boolean;
  defaultValue?: string;
  description?: string;
  example?: string;
  maxLength?: number;
  allowedFormatting?: TemplateFieldAllowedFormatting[];
  textAutoFit?: boolean;
  minFontSizePx?: number;
  textColor?: string;
  fontFamily?: FreeformCardElement['fontFamily'];
  fontSizePx?: number;
  fontWeight?: FreeformCardElement['fontWeight'];
  fontStyle?: FreeformCardElement['fontStyle'];
  textDecoration?: FreeformCardElement['textDecoration'];
  textAlign?: FreeformCardElement['textAlign'];
  writingMode?: FreeformCardElement['writingMode'];
  lineHeight?: string;
  letterSpacing?: string;
}

export interface TCGCardTemplate {
  id: string | null;
  name: string;
  aspectRatio: string;
  formatId?: CardFormatId;
  trimWidthMm?: number;
  trimHeightMm?: number;
  templateSource?: TemplateSource;
  templateLibrarySource?: 'base' | 'pipeline' | 'personal';
  templateAccessTier?: 'free' | 'paid' | 'developer' | 'hidden';
  templateRegistryStatus?: 'draft' | 'submitted' | 'voting' | 'publish_candidate' | 'published' | 'archived' | 'rejected' | 'localOnly';
  templateContributorName?: string;
  templateRevision?: number;
  templateRevisionId?: string;
  templateUsage?: TemplateUsage;
  templateCategory?: string;
  templateDescription?: string;
  templateOrder?: number;
  templatePreviewData?: CardData;
  frameStyle?: string;
  cardBackgroundImageUrl?: string;
  cardBorderImageSource?: string;
  baseBackgroundColor?: string;
  baseTextColor?: string;
  defaultElementBorderColor?: string;
  cardBorderColor?: string;
  cardBorderWidth?: string;
  cardBorderStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'none' | '_default_';
  cardBorderRadius?: string;
  appearance?: FreeformAppearance;
  fieldContracts?: TemplateFieldContract[];
  freeformCanvas?: FreeformCanvas;
}
