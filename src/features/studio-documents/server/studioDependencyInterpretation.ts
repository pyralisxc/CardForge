import { z } from 'zod';
import { getImageFieldKeyForElement } from '@/domain/rendering';
import { normalizeStudioDocumentPayload } from '../model';
import { projectProductionPlanSchema, templateDraftSchema, templateDraftAppearanceSchema } from '../templateDraftSchema';
import { getStudioDocumentAssetIdFromReference, getStudioDocumentFontIdFromReference } from '../assetReferences';
import { isSourceContainedCssImage } from '@/domain/templates/sourceContainedCss';

export const STUDIO_DEPENDENCY_CONTRACT_VERSION = 1;
const scalarData = z.record(z.string(), z.union([z.string(), z.number().finite()]));
// Extend the existing authoring schema only for persisted provenance and preview fields.
const persistedTemplate = templateDraftSchema.extend({
  templateSource: z.string().optional(), templateLibrarySource: z.string().optional(), templateAccessTier: z.string().optional(),
  templateRegistryStatus: z.string().optional(), templateContributorName: z.string().optional(), templateOrder: z.number().optional(),
  templateLineageId: z.string().optional(), templateRevisionId: z.string().optional(), templateParentRevisionId: z.string().optional(),
  templateOriginLineageId: z.string().optional(), templateOriginRevisionId: z.string().optional(), templateRevision: z.number().optional(),
  templatePreviewData: scalarData.optional(),
  templatePipelineContext: z.object({
    schemaVersion: z.literal(1),
    expectedBase: z.object({ assetId: z.string(), parentSubmissionId: z.string(), lineageId: z.string(),
      baseRevisionNumber: z.number().int().positive(), revisionHighWater: z.number().int().positive(),
      parentContentVersion: z.string(), registryContentVersion: z.string() }).strict(),
    attempt: z.object({ key: z.string(), requestFingerprint: z.string() }).strict().optional(),
  }).strict().optional(),
  freeformCanvas: templateDraftSchema.shape.freeformCanvas.extend({ hierarchyVersion: z.number().optional() }),
});
const style = z.object({
  id: z.string().trim().min(1), name: z.string().trim().min(1), kind: z.enum(['material','border','divider','icon','theme','shapeRole','frameKit','textFrame']), targets: z.array(z.enum(['element','text','image','icon','shape','divider','template'])),
  appearance: templateDraftAppearanceSchema, updates: z.record(z.string(), z.unknown()).optional(), templateUpdates: z.record(z.string(), z.unknown()).optional(),
  librarySource: z.string().optional(), accessTier: z.string().optional(), registryStatus: z.string().optional(), contributorName: z.string().optional(),
  studioDestinations: z.array(z.string()).optional(), studioOrder: z.number().optional(), studioFeatured: z.boolean().optional(), studioRoutingMode: z.string().optional(),
}).strict();
const storedCard = z.object({ templateId: z.string(), backingTemplateId: z.string().nullable().optional(), data: scalarData, backingData: scalarData.optional(),
  uniqueId: z.string(), setId: z.string().optional(), setName: z.string().optional(), tagIds: z.array(z.string()).optional(), updatedAt: z.string().optional() }).strict();
const set = z.object({ id: z.string(), name: z.string(), templateIds: z.array(z.string()).optional(),
  organization: z.object({ spatialVersion: z.literal(2).optional(), gridSizeMm: z.number().optional(), arrangement: z.string(), groupBy: z.string(),
    groupField: z.string().optional(), groupTagId: z.string().optional(), sort: z.string(), sortField: z.string().optional(),
    tags: z.array(z.object({id:z.string(),label:z.string()}).strict()), positions: z.record(z.string(),z.object({x:z.number(),y:z.number()}).strict()) }).strict().optional(),
  metadata: z.object({ workflow: z.literal('card-set'), type:z.string().optional(), tags:z.array(z.string()) }).strict().optional() }).strict();
const roots = new Set(['version','userTemplates','appearanceStyles','storedCards','cardSets','activeCardSetId','exportSettings','customAssets','customFonts','productionPlan','mcpOperationReceipts']);
const sourceFields = new Set(['assetSource','dividerAsset','imageSource','iconImageSource','cardBackgroundImageUrl','cardBorderImageSource','backgroundImageUrl','url','previewUrl','assetUrl','dataUrl']);
const identityFields = new Set(['assetId','registryAssetId','templateId','backingTemplateId','templateIds','templateLineageId','templateRevisionId','templateOriginLineageId','templateOriginRevisionId','styleId','presetId','lineageId','parentSubmissionId']);
const cssFields = new Set(['backgroundImage','backgroundImageUrl','cardBackgroundImageUrl','cardBorderImageSource']);

/** Trusted source interpretation; never resolves against mutable discovery/catalog views. */
export function interpretStudioDependencies(payload: unknown) {
  const identities = new Set<string>(); const sources = new Set<string>(); const opaque = new Set<string>();
  const raw = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string,unknown> : null;
  const normalized = normalizeStudioDocumentPayload(payload);
  if (!raw || !normalized) opaque.add('invalid_project_document');
  if (raw && Object.keys(raw).some(key => !roots.has(key))) opaque.add('unsupported_project_field');
  const visit = (value: unknown, key = '', parentType = '', container = '') => {
    if (typeof value === 'string') {
      if (identityFields.has(key) || (key === 'id' && ['userTemplates','appearanceStyles'].includes(container))) identities.add(value);
      if (sourceFields.has(key) || key === 'backgroundImage' || key === 'borderImageSource'
        || (['content','defaultValue','example'].includes(key) && parentType === 'image')) {
        sources.add(value);
        // Native sources can be exact managed identities as well as URLs.
        identities.add(value);
      }
      if (value.includes('{{')) opaque.add('dynamic_binding');
      // Structured gradient colors are interpolated into background-image.
      if (key === 'color' && !isSourceContainedCssImage(`linear-gradient(${value}, transparent)`)) opaque.add('unsupported_css_color');
      if (/\\|%[0-9a-f]{2}|<|var\s*\(|env\s*\(/i.test(value)) opaque.add('encoded_or_dynamic_source');
      if (sourceFields.has(key) || key === 'backgroundImage' || key === 'borderImageSource' || (['content','defaultValue','example'].includes(key) && parentType === 'image')) {
        if (!value) return;
        if (cssFields.has(key) && (key === 'backgroundImage' || value.trim() !== 'none') && isSourceContainedCssImage(value)) return;
        if (getStudioDocumentAssetIdFromReference(value) || getStudioDocumentFontIdFromReference(value)) return;
        opaque.add('external_or_unbound_source');
      } else if (/url\s*\(|(?:https?:|data:|blob:|cardforge-pipeline-asset:)/i.test(value)) opaque.add('external_or_unbound_source');
    } else if (Array.isArray(value)) value.forEach(entry => visit(entry,key,parentType,container));
    else if (value && typeof value === 'object') for (const [child,entry] of Object.entries(value)) visit(entry,child,String((value as Record<string, unknown>).type ?? ''),key);
  };
  visit(payload); visit(normalized); // Normalization may introduce defaults: they are part of the dependency surface.
  // Validate the persisted shapes before normalization can discard unknown fields.
  if (raw) {
    const collections = [ ['userTemplates', persistedTemplate], ['appearanceStyles', style],
      ['storedCards', storedCard], ['cardSets', set] ] as const;
    for (const [key, schema] of collections) {
      const entries = raw[key];
      if (entries !== undefined && (!Array.isArray(entries) || entries.some(entry => !schema.safeParse(entry).success))) {
        opaque.add(`unsupported_raw_${key}`);
      }
    }
    const assets = raw.customAssets;
    if (assets !== undefined && (!assets || typeof assets !== 'object' || Array.isArray(assets)
      || Object.entries(assets).some(([key, items]) => !['cardforge-maker-custom-textures','cardforge-maker-custom-dividers','cardforge-maker-custom-icons','cardforge-maker-custom-images'].includes(key)
        || !Array.isArray(items) || items.length > 0))) opaque.add('custom_asset_or_font_inventory');
    if (raw.customFonts !== undefined && (!Array.isArray(raw.customFonts) || raw.customFonts.length > 0)) opaque.add('custom_asset_or_font_inventory');
    if (raw.mcpOperationReceipts !== undefined && (!Array.isArray(raw.mcpOperationReceipts) || raw.mcpOperationReceipts.length > 0)) opaque.add('unsupported_operation_receipts');
    if (raw.exportSettings !== undefined && (!raw.exportSettings || typeof raw.exportSettings !== 'object' || Array.isArray(raw.exportSettings))) opaque.add('unsupported_export_settings');
    if (raw.productionPlan !== undefined && !projectProductionPlanSchema.safeParse(raw.productionPlan).success) opaque.add('unsupported_raw_production_plan');
  }
  if (normalized) {
    for (const template of normalized.userTemplates) {
      const parsed = persistedTemplate.safeParse(template);
      if (!parsed.success) {
        opaque.add('unsupported_template_shape');
        for (const issue of parsed.error.issues) opaque.add(`template_shape:${issue.path.join('.')}:${issue.code}`);
      }
    }
    for (const preset of normalized.appearanceStyles) {
      if (!style.safeParse(preset).success || Object.keys(preset.updates ?? {}).length || Object.keys(preset.templateUpdates ?? {}).length) opaque.add('unsupported_style_shape');
    }
    for (const card of normalized.storedCards) if (!storedCard.safeParse(card).success) opaque.add('unsupported_card_shape');
    for (const cardSet of normalized.cardSets) if (!set.safeParse(cardSet).success) opaque.add('unsupported_set_shape');
    // CardPreview's image owner consults derived per-image keys before authored
    // imageSource, then uses a literal authored source as a data key. Account
    // for both faces and preview data without resolving catalog/discovery state.
    for (const template of normalized.userTemplates) {
      const dataRows = [template.templatePreviewData ?? {}, ...normalized.storedCards.flatMap(card => [
        ...(card.templateId === template.id ? [card.data] : []),
        ...(card.backingTemplateId === template.id ? [card.backingData ?? {}] : []),
      ])];
      for (const element of template.freeformCanvas?.elements ?? []) {
        if (element.type !== 'image') continue;
        for (const data of dataRows) {
          visit(data[getImageFieldKeyForElement(element)], 'imageSource');
          const authoredKey = element.imageSource || element.content;
          if (authoredKey) visit(data[authoredKey], 'imageSource');
        }
      }
    }
    const localTemplates = new Set(normalized.userTemplates.map(template => template.id));
    const templateRefs = [...normalized.storedCards.flatMap(card => [card.templateId,card.backingTemplateId]), ...normalized.cardSets.flatMap(cardSet => cardSet.templateIds ?? [])];
    if (templateRefs.some(id => id && !localTemplates.has(id))) opaque.add('mutable_catalog_template_resolution');
    if (Object.values(normalized.customAssets).some(items => items.length) || normalized.customFonts?.length) opaque.add('custom_asset_or_font_inventory');
    if (normalized.productionPlan && !projectProductionPlanSchema.safeParse(normalized.productionPlan).success) opaque.add('unsupported_production_plan');
    // These metadata values do not render references. Unknown fields remain opaque.
    const exportKeys = ['selectedPaperSize','pdfMarginMm','pdfCardSpacingMm','pdfIncludeCutLines','pdfDuplexLayout','exportMode','exportDpi'];
    if (Object.keys(normalized.exportSettings).some(key => !exportKeys.includes(key))) opaque.add('unsupported_export_settings');
  }
  return { contractVersion: STUDIO_DEPENDENCY_CONTRACT_VERSION, complete: opaque.size === 0,
    references: { identities: [...identities].sort(), sources: [...sources].sort() }, opaqueReasons: [...opaque].sort() };
}
