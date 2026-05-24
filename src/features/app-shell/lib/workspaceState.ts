import type { TCGCardTemplate } from '@/types';

interface SplitTemplatesForWorkspaceInput {
  allTemplates: TCGCardTemplate[];
  defaultTemplates: TCGCardTemplate[];
}

export const splitTemplatesForWorkspace = ({
  allTemplates,
  defaultTemplates,
}: SplitTemplatesForWorkspaceInput) => ({
  standardDefaultTemplates: defaultTemplates.filter((template) => template.templateUsage !== 'back-preset'),
  backFacePresetTemplates: defaultTemplates.filter((template) => template.templateUsage === 'back-preset'),
  freeformTemplatesForGenerator: allTemplates.filter((template) => template.templateUsage !== 'back-preset'),
});

export const getGeneratorSelectedTemplateId = (
  freeformTemplatesForGenerator: TCGCardTemplate[],
  selectedTemplateId: string | null,
): string | null => (
  freeformTemplatesForGenerator.some((template) => template.id === selectedTemplateId)
    ? selectedTemplateId
    : (freeformTemplatesForGenerator.find((template) => template.id)?.id || null)
);
