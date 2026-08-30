import type { CardData } from '@/domain/cards';
import {
  extractTemplateFieldDefinitions,
  materializeTemplateFieldBindings,
  type TCGCardTemplate,
} from '@/domain/templates';
import type { ProjectDocumentV1 } from '@/features/project/server';
import type { AccountToolAccess } from '@/features/account/server';

import { getStudioDocumentRetentionHours } from './studioDocumentAccess';
import { getStudioDocument } from './studioDocumentStore';

export type StructuralValidationSeverity = 'error' | 'warning';

export interface StructuralValidationIssue {
  code: string;
  severity: StructuralValidationSeverity;
  message: string;
  templateId?: string;
  setId?: string;
  cardId?: string;
  elementId?: string;
  fieldKey?: string;
}

const getTemplateFields = (template: TCGCardTemplate) => (
  extractTemplateFieldDefinitions(materializeTemplateFieldBindings(template))
    .filter((field) => !field.isStaticBaseText)
);

const validateFaceData = ({
  issues,
  template,
  data,
  cardId,
  setId,
  face,
}: {
  issues: StructuralValidationIssue[];
  template: TCGCardTemplate;
  data: CardData;
  cardId: string;
  setId: string;
  face: 'front' | 'back';
}) => {
  const fields = getTemplateFields(template);
  const allowed = new Set(fields.map((field) => field.key));
  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) {
      issues.push({
        code: 'legacy_or_orphaned_card_field',
        severity: 'warning',
        message: `${face} field "${key}" is stored on card ${cardId} but is no longer in the Template contract. The value is preserved and ignored by unrelated sparse edits.`,
        templateId: template.id ?? undefined,
        setId,
        cardId,
        fieldKey: key,
      });
    }
  }
  for (const field of fields) {
    if (
      field.required
      && field.defaultValue === undefined
      && (data[field.key] === undefined || String(data[field.key]).trim() === '')
    ) {
      issues.push({
        code: 'missing_required_card_field',
        severity: 'error',
        message: `${face} required field "${field.key}" is missing on card ${cardId}.`,
        templateId: template.id ?? undefined,
        setId,
        cardId,
        fieldKey: field.key,
      });
    }
  }
};

export const validateProjectDocumentStructure = (document: ProjectDocumentV1): StructuralValidationIssue[] => {
  const issues: StructuralValidationIssue[] = [];
  const templateIds = new Set<string>();
  const templatesById = new Map<string, TCGCardTemplate>();
  for (const template of document.userTemplates) {
    const templateId = template.id?.trim();
    if (!templateId) {
      issues.push({ code: 'missing_template_id', severity: 'error', message: 'A Template is missing its stable id.' });
      continue;
    }
    if (templateIds.has(templateId)) {
      issues.push({ code: 'duplicate_template_id', severity: 'error', message: `Template id "${templateId}" is duplicated.`, templateId });
    }
    templateIds.add(templateId);
    templatesById.set(templateId, template);

    const elementIds = new Set<string>();
    for (const element of template.freeformCanvas?.elements ?? []) {
      if (elementIds.has(element.id)) {
        issues.push({
          code: 'duplicate_element_id',
          severity: 'error',
          message: `Element id "${element.id}" is duplicated in Template ${templateId}.`,
          templateId,
          elementId: element.id,
        });
      }
      elementIds.add(element.id);
      if (element.parentId && !template.freeformCanvas?.elements.some((candidate) => candidate.id === element.parentId)) {
        issues.push({
          code: 'missing_parent_element',
          severity: 'error',
          message: `Element ${element.id} refers to missing parent ${element.parentId}.`,
          templateId,
          elementId: element.id,
        });
      }
    }

    const fieldKeys = new Set<string>();
    for (const contract of template.fieldContracts ?? []) {
      if (fieldKeys.has(contract.key)) {
        issues.push({
          code: 'duplicate_field_contract',
          severity: 'error',
          message: `Field contract "${contract.key}" is duplicated in Template ${templateId}.`,
          templateId,
          fieldKey: contract.key,
        });
      }
      fieldKeys.add(contract.key);
      if (contract.elementId && !elementIds.has(contract.elementId)) {
        issues.push({
          code: 'missing_field_element',
          severity: 'error',
          message: `Field contract "${contract.key}" refers to missing element ${contract.elementId}.`,
          templateId,
          elementId: contract.elementId,
          fieldKey: contract.key,
        });
      }
    }
  }

  const setIds = new Set<string>();
  const setsById = new Map(document.cardSets.map((set) => [set.id, set]));
  for (const set of document.cardSets) {
    if (setIds.has(set.id)) {
      issues.push({ code: 'duplicate_set_id', severity: 'error', message: `Set id "${set.id}" is duplicated.`, setId: set.id });
    }
    setIds.add(set.id);
    if (!set.frontTemplateId || !templatesById.has(set.frontTemplateId)) {
      issues.push({ code: 'missing_set_front_template', severity: 'error', message: `Set ${set.id} does not resolve to a current front Template.`, setId: set.id });
    }
    if (set.backingTemplateId && !templatesById.has(set.backingTemplateId)) {
      issues.push({ code: 'missing_set_back_template', severity: 'error', message: `Set ${set.id} refers to missing back Template ${set.backingTemplateId}.`, setId: set.id });
    }
  }

  const cardIds = new Set<string>();
  for (const card of document.storedCards) {
    if (cardIds.has(card.uniqueId)) {
      issues.push({ code: 'duplicate_card_id', severity: 'error', message: `Card id "${card.uniqueId}" is duplicated.`, cardId: card.uniqueId });
    }
    cardIds.add(card.uniqueId);
    const cardSetId = card.setId?.trim();
    if (!cardSetId) {
      issues.push({ code: 'missing_card_set', severity: 'error', message: `Card ${card.uniqueId} does not have a stable Set id.`, cardId: card.uniqueId });
      continue;
    }
    const set = setsById.get(cardSetId);
    if (!set) {
      issues.push({ code: 'missing_card_set', severity: 'error', message: `Card ${card.uniqueId} refers to missing Set ${cardSetId}.`, cardId: card.uniqueId, setId: cardSetId });
      continue;
    }
    const front = templatesById.get(card.templateId) ?? (set.frontTemplateId ? templatesById.get(set.frontTemplateId) : undefined);
    if (!front) {
      issues.push({ code: 'missing_card_template', severity: 'error', message: `Card ${card.uniqueId} cannot resolve its front Template.`, cardId: card.uniqueId, setId: set.id });
      continue;
    }
    validateFaceData({ issues, template: front, data: card.data, cardId: card.uniqueId, setId: set.id, face: 'front' });
    const backId = card.backingTemplateId ?? set.backingTemplateId;
    if (backId) {
      const back = templatesById.get(backId);
      if (!back) {
        issues.push({ code: 'missing_card_back_template', severity: 'error', message: `Card ${card.uniqueId} cannot resolve back Template ${backId}.`, cardId: card.uniqueId, setId: set.id });
      } else {
        validateFaceData({ issues, template: back, data: card.backingData ?? {}, cardId: card.uniqueId, setId: set.id, face: 'back' });
      }
    }
  }

  const allElementIds = new Set(document.userTemplates.flatMap((template) => (
    template.freeformCanvas?.elements.map((element) => element.id) ?? []
  )));
  for (const asset of document.productionPlan?.assets ?? []) {
    if (asset.binding?.startsWith('element.') && (asset.targetElementIds?.length ?? 0) === 0) {
      issues.push({
        code: 'missing_asset_binding_target',
        severity: 'warning',
        message: `Production asset ${asset.id} uses ${asset.binding} without a target element id.`,
      });
    }
    for (const targetId of asset.targetElementIds ?? []) {
      if (!allElementIds.has(targetId)) {
        issues.push({
          code: 'missing_asset_target_element',
          severity: 'error',
          message: `Production asset ${asset.id} refers to missing element ${targetId}.`,
          elementId: targetId,
        });
      }
    }
    if (asset.status === 'selected' && !asset.embeddedAssetId && !asset.assetUrl && !asset.assetId) {
      issues.push({
        code: 'selected_asset_without_reference',
        severity: 'warning',
        message: `Production asset ${asset.id} is selected but has no stored or external asset reference.`,
      });
    }
  }

  return issues;
};

export const getWorkingDocumentStructuralValidation = async ({
  access,
  documentId,
}: {
  access: AccountToolAccess;
  documentId: string;
}) => {
  const document = await getStudioDocument(
    access.user.id,
    documentId,
    await getStudioDocumentRetentionHours(access.entitlement),
  );
  const issues = validateProjectDocumentStructure(document.document);
  return {
    document,
    issues,
    valid: !issues.some((issue) => issue.severity === 'error'),
    canonicalRenderingRecommended: true,
  };
};
