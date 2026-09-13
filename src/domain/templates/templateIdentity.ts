import { nanoid } from 'nanoid';

import type { TCGCardTemplate } from './types';

export const getTemplateLineageId = (template: Pick<TCGCardTemplate, 'id' | 'templateLineageId'>): string | null => (
  template.templateLineageId?.trim() || template.id?.trim() || null
);

export const getTemplateRevisionId = (template: Pick<TCGCardTemplate, 'id' | 'templateRevisionId'>): string | null => (
  template.templateRevisionId?.trim() || null
);

export const createPersonalTemplateRevision = (
  template: TCGCardTemplate,
  previous?: TCGCardTemplate | null,
  createId: () => string = nanoid,
): TCGCardTemplate => {
  const lineageId = previous
    ? getTemplateLineageId(previous) ?? previous.id ?? `template-lineage-${createId()}`
    : getTemplateLineageId(template) ?? template.id ?? `template-lineage-${createId()}`;
  const revision = previous
    ? Math.max(1, Number(previous.templateRevision ?? 1)) + 1
    : Math.max(1, Number(template.templateRevision ?? 1));
  return {
    ...template,
    templateSource: 'user',
    templateLibrarySource: 'personal',
    templateRegistryStatus: 'localOnly',
    templateLineageId: lineageId,
    templateRevision: revision,
    templateParentRevisionId: previous?.templateRevisionId ?? template.templateParentRevisionId,
    templateRevisionId: `template-revision-${createId()}`,
  };
};

export const createPersonalTemplateFork = (
  source: TCGCardTemplate,
  overrides: Partial<TCGCardTemplate> = {},
  createId: () => string = nanoid,
): TCGCardTemplate => {
  const id = overrides.id?.trim() || `template-${createId()}`;
  const originLineageId = getTemplateLineageId(source) ?? undefined;
  const originRevisionId = getTemplateRevisionId(source) ?? undefined;
  return {
    ...source,
    ...overrides,
    id,
    templateSource: 'user',
    templateLibrarySource: 'personal',
    templateAccessTier: undefined,
    templateRegistryStatus: 'localOnly',
    templateContributorName: undefined,
    templateLineageId: id,
    templateRevision: 1,
    templateRevisionId: `template-revision-${createId()}`,
    templateParentRevisionId: undefined,
    templateOriginLineageId: originLineageId,
    templateOriginRevisionId: originRevisionId,
  };
};

export const withIndependentTemplateIdentity = (
  template: TCGCardTemplate,
  source: TCGCardTemplate,
  createId: () => string = nanoid,
): TCGCardTemplate => ({
  ...template,
  templateLineageId: template.id ?? `template-lineage-${createId()}`,
  templateRevision: 1,
  templateRevisionId: `template-revision-${createId()}`,
  templateParentRevisionId: undefined,
  templateOriginLineageId: getTemplateLineageId(source) ?? undefined,
  templateOriginRevisionId: getTemplateRevisionId(source) ?? undefined,
});
