import { renamePlaceholderKeyInText } from '@/lib/textBindings';
import { toTitleCase } from '@/lib/utils';
import type { FreeformCardElement, TCGCardTemplate } from '@/types';

type FieldContract = NonNullable<TCGCardTemplate['fieldContracts']>[number];

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
