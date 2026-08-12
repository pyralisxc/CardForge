import type { TCGCardTemplate } from '@/domain/templates';

export const getTemplateSourceLabel = (template?: Pick<TCGCardTemplate, 'templateSource'> | null): string => (
  template?.templateSource === 'default' ? 'CardForge Library' : 'Personal Library'
);

export const getTemplateLibraryLabel = (
  template?: Pick<TCGCardTemplate, 'templateSource' | 'templateLibrarySource'> | null,
): string => {
  if (template?.templateLibrarySource === 'pipeline') return 'CardForge Library';
  if (template?.templateLibrarySource === 'personal') return 'Personal';
  if (template?.templateSource === 'user') return 'Personal';
  return 'CardForge Library';
};

export const getTemplateLibraryDescription = (
  template?: Pick<TCGCardTemplate, 'templateSource' | 'templateLibrarySource'> | null,
): string => {
  if (template?.templateLibrarySource === 'pipeline') return 'CardForge Library template';
  if (template?.templateLibrarySource === 'personal' || template?.templateSource === 'user') return 'Personal template';
  return 'CardForge Library template';
};

export const getTemplateDisplayName = (template: Pick<TCGCardTemplate, 'id' | 'name' | 'templateSource' | 'templateLibrarySource'>): string => {
  const name = template.name || template.id || 'Untitled template';
  return `${name} (${getTemplateLibraryDescription(template)})`;
};
