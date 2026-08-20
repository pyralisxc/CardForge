import {
  buildTextBinding,
  extractPlaceholderKeysFromText,
  isScopedFieldDataKey,
  isStaticSegmentFieldKey,
} from '@/domain/rendering';

import type { TCGCardTemplate, TemplateFieldContract } from './types';

const DIRECT_FIELD_KEY_PATTERN = /^[A-Za-z_][\w.-]*$/u;

const isDirectWholeElementContract = (contract: TemplateFieldContract, elementId: string): boolean => (
  contract.elementId === elementId
  && contract.type !== 'image'
  && contract.type !== 'structuredRows'
  && DIRECT_FIELD_KEY_PATTERN.test(contract.key)
  && !isStaticSegmentFieldKey(contract.key)
  && !isScopedFieldDataKey(contract.key)
);

/**
 * Makes an explicit element-bound text field contract renderable by the same
 * native placeholder path used by Studio and bulk generation.
 *
 * Agent-authored Templates can legitimately describe a whole text element with
 * one fieldContract while leaving its preview copy as literal text (for example
 * `ROCK`). In that shape the contract is real, but older rendering/generation
 * inference sees only the literal copy. Materializing the single direct contract
 * into `{{field:"fallback"}}` keeps the contract authoritative without adding a
 * second storage model or changing Templates that already use native bindings.
 */
export const materializeTemplateFieldBindings = (template: TCGCardTemplate): TCGCardTemplate => {
  const canvas = template.freeformCanvas;
  if (!canvas || !template.fieldContracts?.length) return template;

  let changed = false;
  const elements = canvas.elements.map((element) => {
    if (element.type !== 'text') return element;
    if (extractPlaceholderKeysFromText(element.content).length > 0) return element;

    const directContracts = template.fieldContracts!.filter((contract) => (
      isDirectWholeElementContract(contract, element.id)
    ));
    if (directContracts.length !== 1) return element;

    const contract = directContracts[0];
    const fallback = contract.defaultValue ?? element.content ?? contract.example ?? '';
    const content = buildTextBinding(contract.key, fallback);
    if (!content || content === element.content) return element;

    changed = true;
    return {
      ...element,
      content,
      generatorFieldKind: 'text' as const,
      generatorFieldRequired: typeof contract.required === 'boolean'
        ? contract.required
        : element.generatorFieldRequired,
    };
  });

  if (!changed) return template;
  return {
    ...template,
    freeformCanvas: {
      ...canvas,
      elements,
    },
  };
};
