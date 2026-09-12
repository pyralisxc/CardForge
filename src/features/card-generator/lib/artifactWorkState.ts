import type { DisplayCard } from '@/domain/rendering';
import { extractTemplateFieldDefinitions } from '@/domain/templates';

export interface ArtifactWorkState {
  needsWork: boolean;
  missingFrontFields: string[];
  missingBackFields: string[];
}

const missingRequired = (template: DisplayCard['template'] | DisplayCard['backingTemplate'], data: DisplayCard['data'] | DisplayCard['backingData']) => {
  if (!template) return [];
  return extractTemplateFieldDefinitions(template)
    .filter((field) => !field.isStaticBaseText && field.required && field.defaultValue === undefined)
    .filter((field) => data?.[field.key] === undefined || String(data?.[field.key] ?? '').trim() === '')
    .map((field) => field.label || field.key);
};

/** Derived creator attention state. It is never persisted as a second owner. */
export const getArtifactWorkState = (card: DisplayCard): ArtifactWorkState => {
  const missingFrontFields = missingRequired(card.template, card.data);
  const missingBackFields = missingRequired(card.backingTemplate, card.backingData);
  return {
    needsWork: missingFrontFields.length > 0 || missingBackFields.length > 0,
    missingFrontFields,
    missingBackFields,
  };
};
