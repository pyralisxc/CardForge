
export type FreeformElementType = 'text' | 'image' | 'icon' | 'shape';
export type FreeformShapeKind = 'rectangle' | 'ellipse' | 'diamond' | 'hexagon' | 'capsule' | 'banner' | 'notch-panel' | 'bracket-frame' | 'corner-frame' | 'line';
export type FreeformShapeRole = 'basic' | 'panel' | 'artFrame' | 'rulesBox' | 'titlePlate' | 'statGem' | 'costOrb' | 'divider';

export type AppearanceTarget = 'element' | 'text' | 'image' | 'icon' | 'shape' | 'divider' | 'template';
export type AppearanceStyleKind = 'material' | 'textFrame' | 'border' | 'divider' | 'icon' | 'theme';
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
  assetKind?: 'texture' | 'divider' | 'border' | 'frame';
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
  assetKind?: 'texture' | 'divider' | 'border' | 'frame';
  blendMode?: string;
  textureScale?: number;
  textureOpacity?: number;
  tileMode?: AppearanceTileMode;
  assetFlipX?: boolean;
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
  padding?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  minHeight?: string;
  imageObjectFit?: 'cover' | 'contain' | 'fill' | 'none';
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

export interface TCGCardTemplate {
  id: string | null; 
  name: string; 
  aspectRatio: string;
  frameStyle?: string;
  cardBackgroundImageUrl?: string;
  cardBorderImageSource?: string; // New property for border image/gradient

  baseBackgroundColor?: string;
  baseTextColor?: string;
  defaultSectionBorderColor?: string;

  cardBorderColor?: string;
  cardBorderWidth?: string;
  cardBorderStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'none' | '_default_';
  cardBorderRadius?: string;
  appearance?: FreeformAppearance;

  freeformCanvas?: FreeformCanvas;
}

export interface CardData {
  [key: string]: string | number | undefined;
}

export interface PaperSize {
  name: string;
  widthMm: number;
  heightMm: number;
}

// Represents the structure stored in localStorage for generated cards
export interface StoredDisplayCard {
  templateId: string; // Was frontTemplateId
  data: CardData;    // Was frontData
  uniqueId: string;
}

// Represents the runtime structure used in the application
export interface DisplayCard {
  template: TCGCardTemplate; // Was frontTemplate
  data: CardData;        // Was frontData
  uniqueId: string;
}

export interface ExtractedPlaceholder {
  key: string;
  defaultValue?: string;
}

