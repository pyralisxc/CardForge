import { summarizeProjectProductionAssets } from '@/features/project/server';
import type { createDeveloperTemplateDraft } from './developerTemplateDrafts';

type DeveloperTemplateDraft = Awaited<ReturnType<typeof createDeveloperTemplateDraft>>;

export const omitEmbeddedMediaForMcp = (value: unknown): unknown => {
  if (typeof value === 'string') {
    if (value.startsWith('data:')) {
      return '[embedded media retained by CardForge; use attach_template_artwork to replace it]';
    }
    return value.length > 4000 ? `${value.slice(0, 4000)}…` : value;
  }
  if (Array.isArray(value)) return value.map(omitEmbeddedMediaForMcp);
  if (!value || typeof value !== 'object') return value;

  const record = value as Record<string, unknown>;
  const embeddedAssetId = typeof record.embeddedAssetId === 'string'
    ? record.embeddedAssetId
    : null;
  const sanitized = Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => key !== 'binding' && key !== 'embeddedAssetId')
      .map(([key, entry]) => [key, omitEmbeddedMediaForMcp(entry)]),
  );
  if (embeddedAssetId && typeof sanitized.assetUrl !== 'string') {
    sanitized.assetUrl = `embedded://${embeddedAssetId}`;
  }
  return sanitized;
};

export const editableTemplateSummaryForMcp = (
  document: DeveloperTemplateDraft,
  openInStudioUrl: string,
) => {
  const productionPlan = document.document.productionPlan;
  const editableImageFieldKeys = document.document.userTemplates[0]?.fieldContracts
    ?.filter((field) => field.type === 'image')
    .map((field) => field.key) ?? [];
  return {
    document: {
      id: document.id,
      title: document.title,
      creationSource: document.creationSource,
      revision: document.revision,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    },
    productionPlan: productionPlan ? {
      decisionMode: productionPlan.decisionMode,
      planningLocked: true,
      outputSize: productionPlan.outputSize,
      editableFieldCount: productionPlan.editableFieldKeys.length,
      editableImageFieldKeys,
      assetSummary: summarizeProjectProductionAssets(productionPlan),
    } : null,
    openInStudioUrl,
  };
};
