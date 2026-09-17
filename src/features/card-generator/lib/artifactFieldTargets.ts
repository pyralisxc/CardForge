import { getGeneratorImageFieldKeyForElement } from '@/domain/rendering';
import {
  extractTemplateFieldDefinitions,
  type FreeformCardElement,
  type TCGCardTemplate,
  type TemplateFieldDefinition,
} from '@/domain/templates';

export interface ArtifactFieldTarget {
  element: FreeformCardElement;
  fields: TemplateFieldDefinition[];
  kind: 'artifact-field' | 'template-element';
  label: string;
}

export interface ArtifactFieldTargetMap {
  fields: TemplateFieldDefinition[];
  targets: ArtifactFieldTarget[];
}

const visibleElements = (template: TCGCardTemplate): FreeformCardElement[] => {
  const elements = template.freeformCanvas?.elements ?? [];
  const elementById = new Map(elements.map((element) => [element.id, element]));
  return elements.filter((element) => {
    if (element.visible === false) return false;
    let parentId = element.parentId;
    while (parentId) {
      const parent = elementById.get(parentId);
      if (!parent) break;
      if (parent.visible === false) return false;
      parentId = parent.parentId;
    }
    return true;
  });
};

export const buildArtifactFieldTargetMap = (template: TCGCardTemplate): ArtifactFieldTargetMap => {
  const fields = extractTemplateFieldDefinitions(template).filter((field) => !field.isStaticBaseText);
  const fieldsByElementId = fields.reduce<Map<string, TemplateFieldDefinition[]>>((groups, field) => {
    if (!field.sourceElementId) return groups;
    const group = groups.get(field.sourceElementId) ?? [];
    group.push(field);
    groups.set(field.sourceElementId, group);
    return groups;
  }, new Map());

  const targets = visibleElements(template)
    .map((element): ArtifactFieldTarget => {
      const elementFields = [...(fieldsByElementId.get(element.id) ?? [])];
      if (element.type === 'image') {
        const imageFieldKey = getGeneratorImageFieldKeyForElement(template, element);
        const imageField = imageFieldKey ? fields.find((field) => field.key === imageFieldKey) : undefined;
        if (imageField && !elementFields.some((field) => field.key === imageField.key)) elementFields.push(imageField);
      }
      const editable = elementFields.length > 0;
      return {
        element,
        fields: elementFields,
        kind: editable ? 'artifact-field' : 'template-element',
        label: editable
          ? elementFields.length === 1 ? elementFields[0]!.label : `${element.name || 'Field group'} · ${elementFields.length} fields`
          : `${element.name || 'Design element'} · Template`,
      };
    })
    .sort((left, right) => left.element.zIndex - right.element.zIndex);

  return { fields, targets };
};
