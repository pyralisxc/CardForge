import type { TCGCardTemplate } from '@/types';

export const getTemplateSourceLabel = (template?: Pick<TCGCardTemplate, 'templateSource'> | null): string => (
  template?.templateSource === 'default' ? 'Forge Library' : 'Personal Library'
);

export const getTemplateLibraryLabel = (
  template?: Pick<TCGCardTemplate, 'templateSource' | 'templateLibrarySource'> | null,
): string => {
  if (template?.templateLibrarySource === 'pipeline') return 'Pipeline';
  if (template?.templateLibrarySource === 'personal') return 'Personal';
  if (template?.templateSource === 'user') return 'Personal';
  return 'Pipeline';
};

export const getTemplateLibraryDescription = (
  template?: Pick<TCGCardTemplate, 'templateSource' | 'templateLibrarySource'> | null,
): string => {
  if (template?.templateLibrarySource === 'pipeline') return 'Pipeline template';
  if (template?.templateLibrarySource === 'personal' || template?.templateSource === 'user') return 'Personal template';
  return 'Pipeline template';
};

export const getTemplateDisplayName = (template: Pick<TCGCardTemplate, 'id' | 'name' | 'templateSource' | 'templateLibrarySource'>): string => {
  const name = template.name || template.id || 'Untitled template';
  return `${name} (${getTemplateLibraryDescription(template)})`;
};
