import { renamePlaceholderKeyInText } from '@/lib/textBindings';
import { reconstructFreeformCanvas } from '@/lib/templateModel';
import { toTitleCase } from '@/lib/utils';
import type { CardFace, FreeformCanvas, FreeformCardElement, TCGCardTemplate } from '@/types';

export type FieldContract = NonNullable<TCGCardTemplate['fieldContracts']>[number];

export const normalizeTemplateVariableKey = (key: string): string => (
  key.trim().replace(/[^\w.-]/g, '')
);

export const hasScopedVariableKeyConflict = (
  fieldContracts: FieldContract[] | undefined,
  elementId: string,
  oldKey: string,
  nextKey: string,
): boolean => (
  (fieldContracts || []).some((contract) =>
    contract.elementId === elementId && contract.key === nextKey && contract.key !== oldKey
  )
);

export const upsertTemplateFieldContract = (
  template: TCGCardTemplate,
  key: string,
  updates: Partial<FieldContract>,
): TCGCardTemplate => {
  const cleanKey = key.trim();
  if (!cleanKey) return template;

  const contracts = [...(template.fieldContracts || [])];
  const scopedElementId = typeof updates.elementId === 'string' && updates.elementId.trim() !== ''
    ? updates.elementId.trim()
    : undefined;
  const index = contracts.findIndex((contract) =>
    contract.key === cleanKey && (!scopedElementId || contract.elementId === scopedElementId)
  );
  const nextContract = {
    key: cleanKey,
    ...(index >= 0 ? contracts[index] : {}),
    ...updates,
  };

  if (index >= 0) contracts[index] = nextContract;
  else contracts.push(nextContract);

  return {
    ...template,
    fieldContracts: contracts,
  };
};

export interface RenameScopedTextElementVariableInput {
  template: TCGCardTemplate;
  activeFace: CardFace;
  fallbackCanvas: FreeformCanvas;
  selectedElementId: string;
  oldKey: string;
  nextKey: string;
}

export const renameScopedTextElementVariable = ({
  template,
  activeFace,
  fallbackCanvas,
  selectedElementId,
  oldKey,
  nextKey,
}: RenameScopedTextElementVariableInput): TCGCardTemplate => {
  const nextContracts = (template.fieldContracts || []).map((contract) =>
    contract.elementId === selectedElementId && contract.key === oldKey
      ? { ...contract, key: nextKey, label: toTitleCase(nextKey) }
      : contract
  );
  const activeCanvas = (activeFace === 'back' ? template.backCanvas : template.freeformCanvas) || fallbackCanvas;
  const nextElements = (activeCanvas.elements || []).map((element) =>
    element.id === selectedElementId
      ? { ...element, content: renamePlaceholderKeyInText(element.content || '', oldKey, nextKey) }
      : element
  );

  return {
    ...template,
    fieldContracts: nextContracts,
    [activeFace === 'back' ? 'backCanvas' : 'freeformCanvas']: reconstructFreeformCanvas({
      ...activeCanvas,
      elements: nextElements,
    }),
  };
};

export const removeScopedTextElementVariableContract = (
  template: TCGCardTemplate,
  selectedElementId: string,
  key: string,
): TCGCardTemplate => ({
  ...template,
  fieldContracts: (template.fieldContracts || []).filter((contract) =>
    !(contract.key === key && contract.elementId === selectedElementId)
  ),
});

export const getNextScopedVariableKey = (
  fieldContracts: FieldContract[] | undefined,
  selectedElement: FreeformCardElement | null | undefined,
  existingKey?: string,
): string => {
  if (!selectedElement) return '';
  const elementSlug = (selectedElement.name || 'text')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20) || 'text';
  const existingContractsForElement = (fieldContracts || []).filter(
    (contract) => contract.elementId === selectedElement.id
  );
  return existingKey || `${elementSlug}_var_${existingContractsForElement.length + 1}`;
};

export interface RemapDuplicatedTextElementContractsInput {
  elements: FreeformCardElement[];
  fieldContracts?: FieldContract[];
  duplicatedElementIdMap?: Record<string, string>;
  createKey: (baseKey: string, existingKeys: Set<string>) => string;
}

export interface RemapDuplicatedTextElementContractsResult {
  elements: FreeformCardElement[];
  fieldContracts: FieldContract[];
}

const ensureUniqueKey = (
  baseKey: string,
  existingKeys: Set<string>,
  createKey: (baseKey: string, existingKeys: Set<string>) => string,
): string => {
  let candidate = createKey(baseKey, existingKeys).trim().replace(/[^\w.-]/g, '');
  if (!candidate) candidate = `${baseKey}_copy`;

  let uniqueCandidate = candidate;
  let index = 2;
  while (existingKeys.has(uniqueCandidate)) {
    uniqueCandidate = `${candidate}_${index}`;
    index += 1;
  }

  existingKeys.add(uniqueCandidate);
  return uniqueCandidate;
};

export const remapDuplicatedTextElementContracts = ({
  elements,
  fieldContracts = [],
  duplicatedElementIdMap = {},
  createKey,
}: RemapDuplicatedTextElementContractsInput): RemapDuplicatedTextElementContractsResult => {
  const existingKeys = new Set(fieldContracts.map((contract) => contract.key));
  const contentUpdates = new Map<string, Map<string, string>>();
  const copiedContracts: FieldContract[] = [];

  for (const contract of fieldContracts) {
    if (!contract.elementId) continue;
    const duplicatedElementId = duplicatedElementIdMap[contract.elementId];
    if (!duplicatedElementId) continue;
    const duplicatedElement = elements.find((element) => element.id === duplicatedElementId);
    if (duplicatedElement?.type !== 'text') continue;

    const nextKey = ensureUniqueKey(contract.key, existingKeys, createKey);
    const perElementUpdates = contentUpdates.get(duplicatedElementId) ?? new Map<string, string>();
    perElementUpdates.set(contract.key, nextKey);
    contentUpdates.set(duplicatedElementId, perElementUpdates);
    copiedContracts.push({
      ...contract,
      key: nextKey,
      elementId: duplicatedElementId,
      label: `${contract.label?.trim() || toTitleCase(contract.key)} Copy`,
    });
  }

  if (copiedContracts.length === 0) {
    return {
      elements,
      fieldContracts,
    };
  }

  return {
    elements: elements.map((element) => {
      const updates = contentUpdates.get(element.id);
      if (!updates || !element.content) return element;

      let content = element.content;
      updates.forEach((nextKey, oldKey) => {
        content = renamePlaceholderKeyInText(content, oldKey, nextKey);
      });
      return { ...element, content };
    }),
    fieldContracts: [...fieldContracts, ...copiedContracts],
  };
};
