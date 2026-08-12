import { resolveTemplateCardFormat } from './registry';
import type { TemplateCardFormatSource } from './types';

const FORMAT_TOLERANCE_MM = 0.1;

export const areTemplateFormatsCompatible = (
  front: TemplateCardFormatSource,
  back: TemplateCardFormatSource,
): boolean => {
  const frontFormat = resolveTemplateCardFormat(front);
  const backFormat = resolveTemplateCardFormat(back);
  return (
    Math.abs(frontFormat.widthMm - backFormat.widthMm) <= FORMAT_TOLERANCE_MM
    && Math.abs(frontFormat.heightMm - backFormat.heightMm) <= FORMAT_TOLERANCE_MM
  );
};

export const getCompatibleCardBacks = <T extends TemplateCardFormatSource & { templateUsage?: string }>(
  front: TemplateCardFormatSource,
  templates: readonly T[],
): T[] => templates.filter((template) => (
  template.templateUsage === 'back-preset' && areTemplateFormatsCompatible(front, template)
));
