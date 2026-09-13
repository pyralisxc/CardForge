import type { StoredDisplayCard } from '@/domain/cards';
import { extractTemplateFieldDefinitions, type TCGCardTemplate } from '@/domain/templates';

export interface TemplateSaveImpact {
  templateId: string | null;
  frontArtifactIds: string[];
  backArtifactIds: string[];
  removedFieldKeys: string[];
  addedRequiredFieldKeys: string[];
  requiresReview: boolean;
}

type ContractField = { key: string; required: boolean };

/**
 * Save impact follows the Template contract, not only the fields currently
 * discoverable from rendered canvas bindings. Older Templates can infer fields
 * from placeholders while newer authored Templates may already carry an
 * explicit contract before a canvas element is bound. The union keeps both
 * representations safe while letting resolved field definitions override the
 * raw contract when both exist.
 */
const contractFields = (template: TCGCardTemplate | null | undefined): ContractField[] => {
  if (!template) return [];
  const fields = new Map<string, ContractField>();
  for (const contract of template.fieldContracts ?? []) {
    const key = contract.key?.trim();
    if (!key) continue;
    fields.set(key, { key, required: contract.required === true });
  }
  for (const field of extractTemplateFieldDefinitions(template)) {
    if (field.isStaticBaseText) continue;
    fields.set(field.key, { key: field.key, required: field.required });
  }
  return [...fields.values()];
};

export const buildTemplateSaveImpact = ({
  previous,
  next,
  cards,
}: {
  previous: TCGCardTemplate | null | undefined;
  next: TCGCardTemplate;
  cards: readonly StoredDisplayCard[];
}): TemplateSaveImpact => {
  const templateId = previous?.id ?? next.id;
  const previousFields = new Map(contractFields(previous).map((field) => [field.key, field]));
  const nextFields = new Map(contractFields(next).map((field) => [field.key, field]));
  const removedFieldKeys = [...previousFields.keys()].filter((key) => !nextFields.has(key)).sort();
  const addedRequiredFieldKeys = [...nextFields.values()]
    .filter((field) => field.required && !previousFields.has(field.key))
    .map((field) => field.key)
    .sort();
  const frontArtifactIds = templateId
    ? cards.filter((card) => card.templateId === templateId).map((card) => card.uniqueId)
    : [];
  const backArtifactIds = templateId
    ? cards.filter((card) => card.backingTemplateId === templateId).map((card) => card.uniqueId)
    : [];
  return {
    templateId,
    frontArtifactIds,
    backArtifactIds,
    removedFieldKeys,
    addedRequiredFieldKeys,
    requiresReview: removedFieldKeys.length > 0 || addedRequiredFieldKeys.length > 0,
  };
};

export const applyTemplateFieldRemoval = ({
  cards,
  templateId,
  removedFieldKeys,
  scopeIds,
}: {
  cards: readonly StoredDisplayCard[];
  templateId: string;
  removedFieldKeys: readonly string[];
  scopeIds?: readonly string[];
}): StoredDisplayCard[] => {
  if (!removedFieldKeys.length) return [...cards];
  const scope = scopeIds ? new Set(scopeIds) : null;
  const removeKeys = (data: StoredDisplayCard['data'] | undefined) => {
    if (!data) return data;
    const next = { ...data };
    removedFieldKeys.forEach((key) => { delete next[key]; });
    return next;
  };
  return cards.map((card) => {
    if (scope && !scope.has(card.uniqueId)) return card;
    const front = card.templateId === templateId;
    const back = card.backingTemplateId === templateId;
    if (!front && !back) return card;
    return {
      ...card,
      ...(front ? { data: removeKeys(card.data) ?? {} } : {}),
      ...(back ? { backingData: removeKeys(card.backingData) } : {}),
      updatedAt: new Date().toISOString(),
    };
  });
};
