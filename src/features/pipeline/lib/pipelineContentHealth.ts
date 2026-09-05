import { hasRequiredPipelineClassification } from './contentTaxonomy';
import type { CardForgeCatalogManifest } from './catalogManifest';
import type { PipelineProgramView } from './pipelineProgram';
import { getPipelineStudioDestinationOptions } from './pipelineAssetTaxonomy';
import { buildPipelineContentReview, type PipelineContentReview } from './pipelineContentReview';

export type PipelineContentHealthSeverity = 'error' | 'warning';

export interface PipelineContentHealthIssue {
  code: 'missing-lineage' | 'missing-route' | 'invalid-route' | 'missing-taxonomy' | 'missing-preview' | 'missing-source' | 'duplicate-name' | 'invalid-package' | 'inferred-format' | 'legacy-revision';
  severity: PipelineContentHealthSeverity;
  objectId: string | null;
  objectName: string;
  message: string;
  repair: string;
}

export interface PipelineContentHealth {
  checkedCount: number;
  errors: number;
  warnings: number;
  issues: PipelineContentHealthIssue[];
  review: PipelineContentReview;
}

export const buildPipelineContentHealth = ({
  catalog,
  program,
}: {
  catalog: CardForgeCatalogManifest | null;
  program: PipelineProgramView | null;
}): PipelineContentHealth => {
  const issues: PipelineContentHealthIssue[] = [];
  const review = buildPipelineContentReview(program);
  const published = catalog?.pipeline?.items ?? [];
  const names = new Map<string, typeof published>();
  published.forEach((item) => {
    const key = item.name.trim().toLocaleLowerCase();
    names.set(key, [...(names.get(key) ?? []), item]);
    if (!item.lineageId) issues.push({ code: 'missing-lineage', severity: 'error', objectId: item.id, objectName: item.name, message: 'Published object has no lineage identity.', repair: 'Create a revision-safe lineage link before the next publication.' });
    if (!item.previewUrl) issues.push({ code: 'missing-preview', severity: 'warning', objectId: item.lineageId ?? item.id, objectName: item.name, message: 'Published object has no visual preview.', repair: 'Add a validated preview on the next revision.' });
  });
  names.forEach((items) => {
    if (items.length < 2) return;
    items.forEach((item) => issues.push({ code: 'duplicate-name', severity: 'warning', objectId: item.lineageId ?? item.id, objectName: item.name, message: `${items.length} published objects use this display name.`, repair: 'Clarify the next revision name without changing historical revisions.' }));
  });
  (catalog?.sets.items ?? []).forEach((set) => {
    let validPackage = false;
    try { validPackage = new URL(set.packageUrl).protocol === 'https:'; } catch { validPackage = false; }
    if (!validPackage) issues.push({ code: 'invalid-package', severity: 'error', objectId: set.id, objectName: set.name, message: 'Published Set does not have a valid HTTPS package source.', repair: 'Publish a verified portable Set package revision.' });
    if (!hasRequiredPipelineClassification('sets', set.specialtyTags, set.useCaseTags)) issues.push({ code: 'missing-taxonomy', severity: 'warning', objectId: set.id, objectName: set.name, message: 'Published Set classification is incomplete.', repair: 'Choose this published Set in Content Health and save its specialty and use-case tags.' });
  });
  (program?.submissions ?? []).filter((submission) => submission.status === 'published').forEach((submission) => {
    const objectId = submission.lineageId ?? submission.id;
    const destinations = getPipelineStudioDestinationOptions(submission.assetType);
    if (destinations.length && !submission.requestedStudioDestination) issues.push({ code: 'missing-route', severity: 'error', objectId, objectName: submission.name, message: 'Published revision has no destination route.', repair: 'Choose its native Library/Design destination.' });
    if (submission.requestedStudioDestination && !destinations.includes(submission.requestedStudioDestination)) issues.push({ code: 'invalid-route', severity: 'error', objectId, objectName: submission.name, message: 'Published revision has a destination incompatible with its kind.', repair: 'Review routing through the native Pipeline owner; Sets use package installation without a Studio destination.' });
    if (!hasRequiredPipelineClassification(submission.assetType, submission.specialtyTags, submission.useCaseTags)) issues.push({ code: 'missing-taxonomy', severity: 'warning', objectId, objectName: submission.name, message: 'Published revision is missing controlled taxonomy.', repair: 'Choose this published item in Content Health and save its specialty and use-case tags.' });
    if (!submission.sourceUrl && !submission.sourcePayload) issues.push({ code: 'missing-source', severity: 'error', objectId, objectName: submission.name, message: 'Published revision has no readable source.', repair: 'Archive it or publish a verified replacement revision.' });
  });
  review.entries.forEach((entry) => {
    const objectId = entry.lineageId ?? entry.submissionId;
    if (entry.template?.proposedFormatMetadata) issues.push({ code: 'inferred-format', severity: 'warning', objectId, objectName: entry.name, message: 'Template physical size currently relies on legacy inference.', repair: 'Review the proposed explicit format in the content review download and compare rendered output before publishing a revision.' });
    if (entry.revisionNeedsReview) issues.push({ code: 'legacy-revision', severity: 'warning', objectId, objectName: entry.name, message: 'Published submission has no explicit revision number; legacy readers remain supported.', repair: 'Inspect its immutable lineage before creating the next revision. Do not assign a guessed revision number.' });
  });
  return {
    checkedCount: published.length,
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    issues,
    review,
  };
};
