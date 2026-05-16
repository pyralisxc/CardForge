import type { FreeformCardElement, TCGCardTemplate } from '@/types';
import { extractPlaceholderKeysFromText } from '@/lib/utils';
import { parseTextBinding } from '@/lib/textBindings';

export type TextElementContentModel = 'plainText' | 'richText' | 'rulesBlocks';
export type FieldContract = NonNullable<TCGCardTemplate['fieldContracts']>[number];

export const getElementFieldContract = (
  template: TCGCardTemplate,
  element: FreeformCardElement,
  key?: string
): FieldContract | undefined => {
  if (!key) return undefined;
  return template.fieldContracts?.find((contract) => contract.key === key && contract.elementId === element.id)
    || template.fieldContracts?.find((contract) => contract.key === key);
};

export const getPrimaryElementContract = (
  template: TCGCardTemplate,
  element: FreeformCardElement
): FieldContract | undefined => {
  const simpleBinding = parseTextBinding(element.content).field;
  const key = simpleBinding || extractPlaceholderKeysFromText(element.content)[0];
  return getElementFieldContract(template, element, key);
};

export const inferTextElementContentModel = (
  template: TCGCardTemplate,
  element: FreeformCardElement
): TextElementContentModel => {
  const contract = getPrimaryElementContract(template, element);
  if (contract?.type === 'rules') return 'rulesBlocks';
  if (contract?.type === 'richText') return 'richText';
  if (contract?.type === 'text') return 'plainText';
  if (element.generatorFieldKind === 'rules') return 'rulesBlocks';
  if (element.generatorFieldKind === 'richText') return 'richText';
  if (element.generatorFieldKind === 'text') return 'plainText';

  const lower = `${element.name || ''} ${element.content || ''}`.toLowerCase();
  if (/(rules|effect|ability|reminder|flavor|subtitle|subtext|description)/.test(lower)) {
    return 'rulesBlocks';
  }

  return 'richText';
};

export const shouldAutoFitTextElement = (
  template: TCGCardTemplate,
  element: FreeformCardElement
): boolean => {
  const contract = getPrimaryElementContract(template, element);
  if (typeof contract?.textAutoFit === 'boolean') return contract.textAutoFit;
  if (typeof element.textAutoFit === 'boolean') return element.textAutoFit;

  const lower = `${element.name || ''} ${element.content || ''}`.toLowerCase();
  return /(rules|effect|ability|reminder|flavor|description)/.test(lower);
};
