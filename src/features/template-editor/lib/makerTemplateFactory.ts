import {
  getCardFormat,
  resolveTemplateCardFormat,
  type CardFormatId,
  type TemplateCardFormatSource,
} from '@/domain/card-formats';
import type { TCGCardTemplate, TemplateUsage } from '@/domain/templates';
import { createDefaultFreeformCanvas, reconstructMinimalTemplate } from '@/domain/templates';

export type NewTemplateStartingPoint = 'blank' | 'starter' | 'clone' | 'branded-back';

export interface NewCardDesignInput {
  name: string;
  formatId: CardFormatId;
  startingPoint: NewTemplateStartingPoint;
}

export interface MakeNewFreeformTemplateInput {
  name?: string;
  templateUsage?: TemplateUsage;
  formatId?: CardFormatId;
  formatSource?: TemplateCardFormatSource;
  startingPoint?: Exclude<NewTemplateStartingPoint, 'clone'>;
}

export const makeNewFreeformTemplate = (
  input: MakeNewFreeformTemplateInput = {},
): TCGCardTemplate => {
  const {
    name = 'Untitled card design',
    templateUsage = 'standard',
    formatId = 'poker',
    formatSource = {},
    startingPoint = 'blank',
  } = input;
  const standardFormat = getCardFormat(formatId);
  const resolvedFormat = standardFormat
    ? {
        formatId: standardFormat.id,
        widthMm: standardFormat.widthMm,
        heightMm: standardFormat.heightMm,
        canvasWidthPx: standardFormat.canvasWidthPx,
        canvasHeightPx: standardFormat.canvasHeightPx,
      }
    : resolveTemplateCardFormat({ ...formatSource, formatId: 'custom' });
  const isBrandedBack = templateUsage === 'back-preset' && startingPoint === 'branded-back';
  const elements = startingPoint === 'starter' ? undefined : [];
  const backgroundImage = isBrandedBack
    ? resolvedFormat.widthMm > resolvedFormat.heightMm
      ? '/card-assets/textures/arcane-forge/back-cardforge-studio-landscape.webp'
      : '/card-assets/textures/arcane-forge/back-cardforge-studio-portrait.webp'
    : undefined;

  return reconstructMinimalTemplate({
    id: null,
    name,
    templateSource: 'user',
    templateUsage,
    templateCategory: templateUsage === 'back-preset' ? 'Card back' : 'Card front',
    formatId: resolvedFormat.formatId,
    trimWidthMm: resolvedFormat.widthMm,
    trimHeightMm: resolvedFormat.heightMm,
    aspectRatio: `${resolvedFormat.widthMm}:${resolvedFormat.heightMm}`,
    frameStyle: 'custom',
    baseBackgroundColor: isBrandedBack ? '#09070d' : '#f7ead0',
    baseTextColor: isBrandedBack ? '#f7d783' : '#21180d',
    cardBackgroundImageUrl: backgroundImage,
    cardBorderColor: '#c89f42',
    cardBorderWidth: isBrandedBack ? '0px' : '4px',
    cardBorderStyle: 'solid',
    cardBorderRadius: '0.75rem',
    freeformCanvas: createDefaultFreeformCanvas({
      width: resolvedFormat.canvasWidthPx,
      height: resolvedFormat.canvasHeightPx,
      ...(elements ? { elements } : {}),
    }),
  });
};
