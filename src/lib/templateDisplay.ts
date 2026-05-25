import type { TCGCardTemplate } from '@/types';

export const getTemplateSourceLabel = (template?: Pick<TCGCardTemplate, 'templateSource'> | null): string => (
  template?.templateSource === 'default' ? 'Default' : 'User'
);

export const getTemplateDisplayName = (template: Pick<TCGCardTemplate, 'id' | 'name' | 'templateSource'>): string => {
  const name = template.name || template.id || 'Untitled template';
  return `${name} (${getTemplateSourceLabel(template)})`;
};
