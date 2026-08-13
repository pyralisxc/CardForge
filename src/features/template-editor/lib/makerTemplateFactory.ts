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
  brandedBackTemplate?: TCGCardTemplate;
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
    brandedBackTemplate,
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
  const brandedBackCanvas = isBrandedBack ? brandedBackTemplate?.freeformCanvas : undefined;
  return reconstructMinimalTemplate({
    ...(isBrandedBack && brandedBackTemplate ? brandedBackTemplate : {}),
    id: null,
    name,
    templateSource: 'user',
    templateLibrarySource: 'personal',
    templateAccessTier: undefined,
    templateRegistryStatus: undefined,
    templateContributorName: undefined,
    templateUsage,
    templateCategory: templateUsage === 'back-preset' ? 'Card back' : 'Card front',
    formatId: resolvedFormat.formatId,
    trimWidthMm: resolvedFormat.widthMm,
    trimHeightMm: resolvedFormat.heightMm,
    aspectRatio: `${resolvedFormat.widthMm}:${resolvedFormat.heightMm}`,
    frameStyle: 'custom',
    baseBackgroundColor: isBrandedBack
      ? brandedBackTemplate?.baseBackgroundColor || '#09070d'
      : '#f7ead0',
    baseTextColor: isBrandedBack
      ? brandedBackTemplate?.baseTextColor || '#f7d783'
      : '#21180d',
    cardBackgroundImageUrl: isBrandedBack ? brandedBackTemplate?.cardBackgroundImageUrl : undefined,
    cardBorderColor: isBrandedBack
      ? brandedBackTemplate?.cardBorderColor || '#c89f42'
      : '#c89f42',
    cardBorderWidth: isBrandedBack
      ? brandedBackTemplate?.cardBorderWidth || '0px'
      : '4px',
    cardBorderStyle: isBrandedBack
      ? brandedBackTemplate?.cardBorderStyle || 'solid'
      : 'solid',
    cardBorderRadius: isBrandedBack
      ? brandedBackTemplate?.cardBorderRadius || '0.75rem'
      : '0.75rem',
    freeformCanvas: brandedBackCanvas || createDefaultFreeformCanvas({
      width: resolvedFormat.canvasWidthPx,
      height: resolvedFormat.canvasHeightPx,
      ...(elements ? { elements } : {}),
    }),
  });
};
