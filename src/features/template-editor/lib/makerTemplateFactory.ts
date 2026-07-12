import type { TCGCardTemplate, TemplateUsage } from '@/types';
import { TCG_ASPECT_RATIO } from '@/lib/constants';
import { createDefaultFreeformCanvas, reconstructMinimalTemplate } from '@/lib/templateModel';

export const makeNewFreeformTemplate = (
  name = 'New Card Template',
  templateUsage: TemplateUsage = 'standard',
): TCGCardTemplate => reconstructMinimalTemplate({
  id: null,
  name,
  templateSource: 'user',
  templateUsage,
  templateCategory: templateUsage === 'back-preset' ? 'Card back' : 'Card front',
  aspectRatio: TCG_ASPECT_RATIO,
  frameStyle: 'custom',
  baseBackgroundColor: '#f7ead0',
  baseTextColor: '#21180d',
  cardBorderColor: '#c89f42',
  cardBorderWidth: '4px',
  cardBorderStyle: 'solid',
  cardBorderRadius: '0.75rem',
  freeformCanvas: createDefaultFreeformCanvas({ elements: [] }),
});
