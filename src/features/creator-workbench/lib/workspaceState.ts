import type { TCGCardTemplate } from '@/domain/templates';

interface SplitTemplatesForWorkspaceInput {
  allTemplates: TCGCardTemplate[];
  defaultTemplates: TCGCardTemplate[];
}

export const splitTemplatesForWorkspace = ({
  allTemplates,
  defaultTemplates,
}: SplitTemplatesForWorkspaceInput) => ({
  standardDefaultTemplates: defaultTemplates.filter((template) => template.templateUsage !== 'back-preset'),
  backFacePresetTemplates: allTemplates.filter((template) => template.templateUsage === 'back-preset'),
  freeformTemplatesForGenerator: allTemplates.filter((template) => template.templateUsage !== 'back-preset'),
});
