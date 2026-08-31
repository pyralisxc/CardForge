import { createHash } from 'node:crypto';

import type { CardData, StoredDisplayCard } from '@/domain/cards';
import {
  extractTemplateFieldDefinitions,
  materializeTemplateFieldBindings,
  reconstructMinimalTemplateObject,
  type TCGCardTemplate,
  type TemplateFieldContract,
} from '@/domain/templates';
import { requireAccountToolCapability, type AccountToolAccess } from '@/features/account/server';
import type { ProjectDocumentV1 } from '@/features/project/server';

import { bindEmbeddedTemplateAsset } from './embeddedTemplateAssets';
import {
  createMcpArtworkOperationBudget,
  normalizeMcpArtworkSource,
} from './mcpArtworkSources';
import type {
  PatchWorkingDocumentInput,
  SparseCardPatch,
  SparseElementPatch,
  SparseFieldContractPatch,
  SparseTemplatePatch,
  TemplateArtworkAttachment,
} from './mcpWorkingDocumentSchemas';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import { getStudioDocumentRetentionHours } from './studioDocumentAccess';
import { getStudioDocument, updateStudioDocument } from './studioDocumentStore';
import {
  validateProjectDocumentStructure,
  type StructuralValidationIssue,
} from './workingDocumentValidation';

const MAX_OPERATION_RECEIPTS = 32;

export interface McpWorkingDocumentOperationReceipt {
  operationId: string;
  requestHash: string;
  revision: number;
  changedTemplateIds: string[];
  changedElementIds: string[];
  changedCardIds: string[];
  changedAssetRequirementIds: string[];
  warnings: string[];
  canonicalRenderingRecommended: boolean;
}

type ProjectDocumentWithReceipts = ProjectDocumentV1 & {
  mcpOperationReceipts?: McpWorkingDocumentOperationReceipt[];
};

export interface WorkingDocumentPatchResult {
  document: Awaited<ReturnType<typeof updateStudioDocument>>;
  committedRevision: number;
  replayed: boolean;
  changedTemplateIds: string[];
  changedElementIds: string[];
  changedCardIds: string[];
  changedAssetRequirementIds: string[];
  warnings: string[];
  canonicalRenderingRecommended: boolean;
  operationId?: string;
}

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

const requestHash = (input: Pick<PatchWorkingDocumentInput, 'templatePatches' | 'cardPatches' | 'templateArtworks'>) => (
  createHash('sha256').update(stableJson(input)).digest('hex')
);

const getTemplateFields = (template: TCGCardTemplate) => (
  extractTemplateFieldDefinitions(materializeTemplateFieldBindings(template))
    .filter((field) => !field.isStaticBaseText)
);

const requireTemplate = (templates: TCGCardTemplate[], templateId: string): TCGCardTemplate => {
  const template = templates.find((candidate) => candidate.id === templateId);
  if (!template) {
    throw new StudioDocumentStoreError(
      `Template ${templateId} is not part of the current working document. Sparse patching never creates replacement Templates.`,
      404,
    );
  }
  return template;
};

const applyElementPatches = (
  template: TCGCardTemplate,
  patches: SparseElementPatch[] | undefined,
  changedElementIds: Set<string>,
): TCGCardTemplate => {
  if (!patches?.length) return template;
  const canvas = template.freeformCanvas;
  if (!canvas) throw new StudioDocumentStoreError(`Template ${template.id} does not have a freeform canvas.`, 409);
  const duplicate = patches.find((patch, index) => patches.findIndex((candidate) => candidate.elementId === patch.elementId) !== index);
  if (duplicate) throw new StudioDocumentStoreError(`Element ${duplicate.elementId} was patched more than once in the same transaction.`, 400);
  const byId = new Map(canvas.elements.map((element) => [element.id, element]));
  for (const patch of patches) {
    const current = byId.get(patch.elementId);
    if (!current) {
      throw new StudioDocumentStoreError(
        `Element ${patch.elementId} is not part of Template ${template.id}. Sparse patching never creates replacement elements.`,
        404,
      );
    }
    const { elementId: _elementId, ...values } = patch;
    byId.set(patch.elementId, { ...current, ...values });
    changedElementIds.add(patch.elementId);
  }
  return reconstructMinimalTemplateObject({
    ...template,
    freeformCanvas: {
      ...canvas,
      elements: canvas.elements.map((element) => byId.get(element.id) ?? element),
    },
  });
};

const affectedCardsForField = (
  document: ProjectDocumentV1,
  templateId: string,
  key: string,
): string[] => document.storedCards.filter((card) => (
  (card.templateId === templateId && Object.prototype.hasOwnProperty.call(card.data, key))
  || (card.backingTemplateId === templateId && Object.prototype.hasOwnProperty.call(card.backingData ?? {}, key))
)).map((card) => card.uniqueId);

const applyFieldContractPatches = (
  document: ProjectDocumentV1,
  template: TCGCardTemplate,
  patches: SparseFieldContractPatch[] | undefined,
  warnings: string[],
): TCGCardTemplate => {
  if (!patches?.length) return template;
  const contracts = [...(template.fieldContracts ?? [])];
  const duplicate = patches.find((patch, index) => patches.findIndex((candidate) => candidate.key === patch.key) !== index);
  if (duplicate) throw new StudioDocumentStoreError(`Field contract ${duplicate.key} was patched more than once in the same transaction.`, 400);
  for (const patch of patches) {
    const index = contracts.findIndex((contract) => contract.key === patch.key);
    if (patch.action === 'remove') {
      if (index < 0) throw new StudioDocumentStoreError(`Field contract ${patch.key} does not exist on Template ${template.id}.`, 404);
      const affected = affectedCardsForField(document, template.id!, patch.key);
      if (affected.length > 0) {
        warnings.push(
          `Field contract "${patch.key}" was removed from Template ${template.id}; ${affected.length} stored card value${affected.length === 1 ? '' : 's'} remain preserved as legacy/orphaned data until explicitly unset.`,
        );
      }
      contracts.splice(index, 1);
      continue;
    }
    const { action: _action, key, ...values } = patch;
    if (values.elementId && !template.freeformCanvas?.elements.some((element) => element.id === values.elementId)) {
      throw new StudioDocumentStoreError(`Field contract ${key} refers to missing element ${values.elementId}.`, 400);
    }
    const next: TemplateFieldContract = index >= 0
      ? { ...contracts[index]!, key, ...values }
      : { key, ...values };
    if (index >= 0) contracts[index] = next;
    else contracts.push(next);
  }
  return reconstructMinimalTemplateObject({ ...template, fieldContracts: contracts });
};

const applyTemplatePatch = ({
  document,
  template,
  patch,
  changedElementIds,
  warnings,
}: {
  document: ProjectDocumentV1;
  template: TCGCardTemplate;
  patch: SparseTemplatePatch;
  changedElementIds: Set<string>;
  warnings: string[];
}): TCGCardTemplate => {
  const {
    templateId: _templateId,
    elementPatches,
    fieldContractPatches,
    description,
    formatId,
    ...metadata
  } = patch;
  let next = reconstructMinimalTemplateObject({
    ...template,
    ...metadata,
    ...(description !== undefined ? { templateDescription: description } : {}),
    ...(formatId !== undefined ? { formatId: formatId as TCGCardTemplate['formatId'] } : {}),
  });
  next = applyElementPatches(next, elementPatches, changedElementIds);
  next = applyFieldContractPatches(document, next, fieldContractPatches, warnings);
  return next;
};

const requireAllowedIncomingFields = (
  template: TCGCardTemplate,
  values: Record<string, string | number> | undefined,
  face: string,
) => {
  if (!values) return;
  const allowed = new Set(getTemplateFields(template).map((field) => field.key));
  const unknown = Object.keys(values).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new StudioDocumentStoreError(
      `${face} sparse card patch contains fields outside the current Template contract: ${unknown.slice(0, 5).join(', ')}. Existing orphaned values may be preserved or explicitly unset, but new unknown fields are refused.`,
      409,
    );
  }
};

const applyUnsets = (
  data: CardData,
  keys: string[] | undefined,
  template: TCGCardTemplate,
  face: string,
) => {
  if (!keys?.length) return;
  const allowed = new Set(getTemplateFields(template).map((field) => field.key));
  for (const key of keys) {
    if (!allowed.has(key) && !Object.prototype.hasOwnProperty.call(data, key)) {
      throw new StudioDocumentStoreError(`${face} field ${key} is neither in the current contract nor stored on this card.`, 404);
    }
    delete data[key];
  }
};

const validateRequiredFields = (template: TCGCardTemplate, data: CardData, face: string, cardId: string) => {
  const missing = getTemplateFields(template).filter((field) => (
    field.required
    && field.defaultValue === undefined
    && (data[field.key] === undefined || String(data[field.key]).trim() === '')
  ));
  if (missing.length > 0) {
    throw new StudioDocumentStoreError(
      `${face} sparse patch would leave card ${cardId} without required fields: ${missing.map((field) => field.key).join(', ')}.`,
      409,
    );
  }
};

const warnLegacyFields = (
  template: TCGCardTemplate,
  data: CardData,
  cardId: string,
  face: string,
  warnings: string[],
) => {
  const allowed = new Set(getTemplateFields(template).map((field) => field.key));
  const orphaned = Object.keys(data).filter((key) => !allowed.has(key));
  if (orphaned.length > 0) {
    warnings.push(`${face} card ${cardId} preserves legacy/orphaned fields not in the current Template contract: ${orphaned.join(', ')}.`);
  }
};

const applyCardPatches = ({
  document,
  templates,
  patches,
  changedCardIds,
  warnings,
}: {
  document: ProjectDocumentV1;
  templates: TCGCardTemplate[];
  patches: SparseCardPatch[] | undefined;
  changedCardIds: Set<string>;
  warnings: string[];
}): StoredDisplayCard[] => {
  if (!patches?.length) return document.storedCards;
  const duplicate = patches.find((patch, index) => patches.findIndex((candidate) => candidate.cardId === patch.cardId) !== index);
  if (duplicate) throw new StudioDocumentStoreError(`Card ${duplicate.cardId} was patched more than once in the same transaction.`, 400);
  const byId = new Map(document.storedCards.map((card) => [card.uniqueId, card]));
  for (const patch of patches) {
    const set = document.cardSets.find((candidate) => candidate.id === patch.setId);
    if (!set) throw new StudioDocumentStoreError(`Set ${patch.setId} is not part of the current working document.`, 404);
    const card = byId.get(patch.cardId);
    if (!card || card.setId !== set.id) {
      throw new StudioDocumentStoreError(
        `Card ${patch.cardId} does not exist in Set ${set.id}. Sparse card patching cannot create duplicates or replacement cards.`,
        404,
      );
    }
    const front = requireTemplate(templates, card.templateId);
    const backId = card.backingTemplateId;
    const back = backId ? requireTemplate(templates, backId) : null;
    if ((patch.backingFields || patch.unsetBackingFields?.length) && !back) {
      throw new StudioDocumentStoreError(`Card ${patch.cardId} does not have a back Template.`, 409);
    }
    requireAllowedIncomingFields(front, patch.fields, 'Front');
    if (back) requireAllowedIncomingFields(back, patch.backingFields, 'Back');
    const data: CardData = { ...card.data, ...(patch.fields ?? {}) };
    const backingData: CardData | undefined = back
      ? { ...(card.backingData ?? {}), ...(patch.backingFields ?? {}) }
      : undefined;
    applyUnsets(data, patch.unsetFields, front, 'Front');
    if (back && backingData) applyUnsets(backingData, patch.unsetBackingFields, back, 'Back');
    validateRequiredFields(front, data, 'Front', patch.cardId);
    if (back) validateRequiredFields(back, backingData ?? {}, 'Back', patch.cardId);
    warnLegacyFields(front, data, patch.cardId, 'Front', warnings);
    if (back) warnLegacyFields(back, backingData ?? {}, patch.cardId, 'Back', warnings);
    byId.set(card.uniqueId, { ...card, data, backingData });
    changedCardIds.add(card.uniqueId);
  }
  return document.storedCards.map((card) => byId.get(card.uniqueId) ?? card);
};

const errorSignature = (issue: StructuralValidationIssue): string => (
  [issue.code, issue.templateId, issue.setId, issue.cardId, issue.elementId, issue.fieldKey].filter(Boolean).join(':')
);

const assertNoNewStructuralErrors = (before: ProjectDocumentV1, after: ProjectDocumentV1) => {
  const baseline = new Set(
    validateProjectDocumentStructure(before)
      .filter((issue) => issue.severity === 'error')
      .map(errorSignature),
  );
  const introduced = validateProjectDocumentStructure(after)
    .filter((issue) => issue.severity === 'error' && !baseline.has(errorSignature(issue)));
  if (introduced.length > 0) {
    throw new StudioDocumentStoreError(
      `Compound patch would introduce structural errors: ${introduced.slice(0, 5).map((issue) => issue.message).join(' ')}`,
      409,
    );
  }
};

const normalizeArtworkBatch = async (artworks: TemplateArtworkAttachment[] | undefined) => {
  if (!artworks?.length) return [];
  const budget = createMcpArtworkOperationBudget(artworks);
  return Promise.all(artworks.map(async (artwork) => ({
    artwork,
    normalized: await normalizeMcpArtworkSource(artwork, budget),
  })));
};

const applyArtworkBatch = ({
  document,
  templates,
  normalizedArtworks,
  changedTemplateIds,
  changedElementIds,
  changedAssetRequirementIds,
}: {
  document: ProjectDocumentV1;
  templates: TCGCardTemplate[];
  normalizedArtworks: Awaited<ReturnType<typeof normalizeArtworkBatch>>;
  changedTemplateIds: Set<string>;
  changedElementIds: Set<string>;
  changedAssetRequirementIds: Set<string>;
}) => {
  let nextTemplates = templates;
  let productionPlan = document.productionPlan;
  for (const { artwork, normalized } of normalizedArtworks) {
    const template = requireTemplate(nextTemplates, artwork.templateId);
    const targetElementIds = artwork.targetElementIds ?? [];
    const nextTemplate = bindEmbeddedTemplateAsset({
      template,
      binding: artwork.binding,
      targetElementIds,
      dataUri: normalized.dataUri,
    });
    nextTemplates = nextTemplates.map((candidate) => candidate.id === template.id ? nextTemplate : candidate);
    changedTemplateIds.add(artwork.templateId);
    targetElementIds.forEach((id) => changedElementIds.add(id));

    if (artwork.requirementId) {
      if (!productionPlan) throw new StudioDocumentStoreError('This working document does not have a production plan.', 409);
      const index = productionPlan.assets.findIndex((asset) => asset.id === artwork.requirementId);
      const requirement = productionPlan.assets[index];
      if (!requirement) {
        throw new StudioDocumentStoreError(`Production-plan asset ${artwork.requirementId} does not exist. Batch artwork binding never creates replacement requirements.`, 404);
      }
      if (!['custom-generated', 'user-provided', 'cardforge-output'].includes(requirement.source)) {
        throw new StudioDocumentStoreError(
          `Production-plan asset ${artwork.requirementId} is not an attachable generated/user-provided/CardForge-output requirement.`,
          400,
        );
      }
      const assets = [...productionPlan.assets];
      assets[index] = {
        ...requirement,
        status: 'selected',
        binding: artwork.binding,
        targetElementIds,
        embeddedAssetId: requirement.id,
        assetUrl: undefined,
        width: normalized.width,
        height: normalized.height,
      };
      productionPlan = { ...productionPlan, assets };
      changedAssetRequirementIds.add(requirement.id);
    }
  }
  return { templates: nextTemplates, productionPlan };
};

export const patchWorkingDocument = async ({
  access,
  input,
}: {
  access: AccountToolAccess;
  input: PatchWorkingDocumentInput;
}): Promise<WorkingDocumentPatchResult> => {
  requireAccountToolCapability(access, 'studio.ai.create');
  const retentionHours = await getStudioDocumentRetentionHours(access.entitlement);
  const current = await getStudioDocument(access.user.id, input.documentId, retentionHours);
  const currentDocument = current.document as ProjectDocumentWithReceipts;
  const hash = requestHash(input);
  if (input.operationId) {
    const receipt = currentDocument.mcpOperationReceipts?.find((candidate) => candidate.operationId === input.operationId);
    if (receipt) {
      if (receipt.requestHash !== hash) {
        throw new StudioDocumentStoreError('That operationId already committed with a different patch payload. Use a new operationId for a different mutation.', 409);
      }
      return {
        document: current,
        committedRevision: receipt.revision,
        replayed: true,
        changedTemplateIds: receipt.changedTemplateIds,
        changedElementIds: receipt.changedElementIds,
        changedCardIds: receipt.changedCardIds,
        changedAssetRequirementIds: receipt.changedAssetRequirementIds,
        warnings: receipt.warnings,
        canonicalRenderingRecommended: receipt.canonicalRenderingRecommended,
        operationId: input.operationId,
      };
    }
  }
  if (current.revision !== input.expectedRevision) {
    throw new StudioDocumentStoreError(
      `The Studio document changed from expected revision ${input.expectedRevision} to ${current.revision}. Reload once, keep the same stable ids, and retry the whole atomic patch.`,
      409,
    );
  }

  const normalizedArtworks = await normalizeArtworkBatch(input.templateArtworks);
  const changedTemplateIds = new Set<string>();
  const changedElementIds = new Set<string>();
  const changedCardIds = new Set<string>();
  const changedAssetRequirementIds = new Set<string>();
  const warnings: string[] = [];
  const duplicateTemplatePatch = input.templatePatches?.find((patch, index) => (
    input.templatePatches!.findIndex((candidate) => candidate.templateId === patch.templateId) !== index
  ));
  if (duplicateTemplatePatch) throw new StudioDocumentStoreError(`Template ${duplicateTemplatePatch.templateId} was patched more than once in the same transaction.`, 400);

  let templates = current.document.userTemplates;
  for (const patch of input.templatePatches ?? []) {
    const template = requireTemplate(templates, patch.templateId);
    const nextTemplate = applyTemplatePatch({
      document: current.document,
      template,
      patch,
      changedElementIds,
      warnings,
    });
    templates = templates.map((candidate) => candidate.id === template.id ? nextTemplate : candidate);
    changedTemplateIds.add(patch.templateId);
  }

  const artworkApplied = applyArtworkBatch({
    document: current.document,
    templates,
    normalizedArtworks,
    changedTemplateIds,
    changedElementIds,
    changedAssetRequirementIds,
  });
  templates = artworkApplied.templates;
  const storedCards = applyCardPatches({
    document: current.document,
    templates,
    patches: input.cardPatches,
    changedCardIds,
    warnings,
  });

  const canonicalRenderingRecommended = changedTemplateIds.size > 0
    || changedElementIds.size > 0
    || changedCardIds.size > 0
    || normalizedArtworks.length > 0;
  const committedRevision = input.expectedRevision + 1;
  const receipt: McpWorkingDocumentOperationReceipt | undefined = input.operationId ? {
    operationId: input.operationId,
    requestHash: hash,
    revision: committedRevision,
    changedTemplateIds: [...changedTemplateIds],
    changedElementIds: [...changedElementIds],
    changedCardIds: [...changedCardIds],
    changedAssetRequirementIds: [...changedAssetRequirementIds],
    warnings: [...new Set(warnings)],
    canonicalRenderingRecommended,
  } : undefined;
  const nextDocument: ProjectDocumentWithReceipts = {
    ...current.document,
    userTemplates: templates,
    storedCards,
    productionPlan: artworkApplied.productionPlan,
    ...(receipt ? {
      mcpOperationReceipts: [
        ...(currentDocument.mcpOperationReceipts ?? []).filter((candidate) => candidate.operationId !== receipt.operationId),
        receipt,
      ].slice(-MAX_OPERATION_RECEIPTS),
    } : {}),
  };
  assertNoNewStructuralErrors(current.document, nextDocument);
  const document = await updateStudioDocument({
    ownerUserId: access.user.id,
    documentId: input.documentId,
    expectedRevision: input.expectedRevision,
    title: current.title,
    document: nextDocument,
    retentionHours,
  });
  return {
    document,
    committedRevision: document.revision,
    replayed: false,
    changedTemplateIds: [...changedTemplateIds],
    changedElementIds: [...changedElementIds],
    changedCardIds: [...changedCardIds],
    changedAssetRequirementIds: [...changedAssetRequirementIds],
    warnings: [...new Set(warnings)],
    canonicalRenderingRecommended,
    operationId: input.operationId,
  };
};

export const getWorkingDocumentOperationStatus = async ({
  access,
  documentId,
  operationId,
}: {
  access: AccountToolAccess;
  documentId: string;
  operationId: string;
}) => {
  requireAccountToolCapability(access, 'studio.ai.create');
  const current = await getStudioDocument(
    access.user.id,
    documentId,
    await getStudioDocumentRetentionHours(access.entitlement),
  );
  const receipt = (current.document as ProjectDocumentWithReceipts).mcpOperationReceipts
    ?.find((candidate) => candidate.operationId === operationId);
  return {
    document: current,
    status: receipt ? 'committed' as const : 'unknown' as const,
    receipt: receipt ?? null,
  };
};
