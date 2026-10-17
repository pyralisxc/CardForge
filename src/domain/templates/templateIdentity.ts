import { nanoid } from 'nanoid';

import type { TCGCardTemplate, TemplatePipelineContext } from './types';

export const normalizeTemplatePipelineContext = (value: unknown): TemplatePipelineContext | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const context = value as Partial<TemplatePipelineContext>;
  const base = context.expectedBase;
  if (context.schemaVersion !== 1 || !base || !Number.isInteger(base.baseRevisionNumber) || base.baseRevisionNumber < 1
    || !Number.isInteger(base.revisionHighWater) || base.revisionHighWater < base.baseRevisionNumber
    || ['assetId', 'parentSubmissionId', 'lineageId', 'parentContentVersion', 'registryContentVersion']
      .some((key) => typeof base[key as keyof typeof base] !== 'string' || !String(base[key as keyof typeof base]).trim())) return undefined;
  const attempt = context.attempt;
  return {
    schemaVersion: 1,
    expectedBase: { assetId: base.assetId, parentSubmissionId: base.parentSubmissionId, lineageId: base.lineageId,
      baseRevisionNumber: base.baseRevisionNumber, revisionHighWater: base.revisionHighWater,
      parentContentVersion: base.parentContentVersion, registryContentVersion: base.registryContentVersion },
    ...(attempt && /^[A-Za-z0-9_-]{16,160}$/u.test(attempt.key) && /^[a-f0-9]{64}$/u.test(attempt.requestFingerprint)
      ? { attempt: { key: attempt.key, requestFingerprint: attempt.requestFingerprint } } : {}),
  };
};

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
    templatePipelineContext: undefined,
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
  templatePipelineContext: undefined,
  templateOriginLineageId: getTemplateLineageId(source) ?? undefined,
  templateOriginRevisionId: getTemplateRevisionId(source) ?? undefined,
});

/** Exclude working-copy leases and retry bookkeeping from authored content. */
export const getAuthoredTemplatePayload = (template: TCGCardTemplate): Omit<TCGCardTemplate, 'templatePipelineContext'> => {
  const { templatePipelineContext: _context, ...authored } = template;
  void _context;
  return authored;
};
