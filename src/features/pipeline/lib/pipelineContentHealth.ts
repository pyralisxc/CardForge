import {
  hasRequiredPipelineClassification,
  hasRequiredSemanticTaxonomy,
} from './contentTaxonomy';
import type { CardForgeCatalogManifest } from './catalogManifest';
import type { PipelineProgramView } from './pipelineProgram';
import { getPipelineStudioDestinationOptions } from './pipelineAssetTaxonomy';
import { buildPipelineContentReview, type PipelineContentReview } from './pipelineContentReview';

export type PipelineContentHealthSeverity = 'error' | 'warning';

export interface PipelineContentHealthIssue {
  code: 'missing-lineage' | 'missing-route' | 'invalid-route' | 'route-content-mismatch' | 'retired-source' | 'unsafe-vector-route' | 'missing-taxonomy' | 'missing-semantic-role' | 'missing-preview' | 'missing-source' | 'duplicate-name' | 'invalid-package' | 'inferred-format' | 'legacy-revision';
  severity: PipelineContentHealthSeverity;
  objectId: string | null;
  objectName: string;
  message: string;
  repair: string;
}

export interface PipelineEditorialReadiness {
  checkedCount: number;
  approvedCount: number;
  pendingCount: number;
  reviseCount: number;
  quarantineCount: number;
  retireCount: number;
  missingEvidenceCount: number;
  coverageComplete: boolean;
}

export interface PipelineContentHealth {
  checkedCount: number;
  errors: number;
  warnings: number;
  issues: PipelineContentHealthIssue[];
  editorial: PipelineEditorialReadiness;
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
  const activePublishedSubmissionIds = new Set(published.flatMap((item) => item.submissionId ? [item.submissionId] : []));
  const hasExactPublishedPointers = activePublishedSubmissionIds.size > 0;
  const names = new Map<string, typeof published>();
  published.forEach((item) => {
    const key = `${item.assetType}:${item.name.trim().toLocaleLowerCase()}`;
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
  const activePublishedSubmissions = (program?.submissions ?? []).filter((submission) => (
    submission.status === 'published'
    && (!hasExactPublishedPointers || activePublishedSubmissionIds.has(submission.id))
  ));
  const editorialMissingEvidence = activePublishedSubmissions.filter((submission) => (
    !submission.sourceNotes.trim()
    || !submission.previewUrl.trim()
    || !hasRequiredPipelineClassification(submission.assetType, submission.specialtyTags, submission.useCaseTags)
    || !hasRequiredSemanticTaxonomy({
      assetType: submission.assetType,
      semanticRole: submission.semanticRole,
      variantOfAssetId: submission.variantOfAssetId,
      variantKind: submission.variantKind,
    })
  ));
  const editorial: PipelineEditorialReadiness = {
    checkedCount: activePublishedSubmissions.length,
    approvedCount: activePublishedSubmissions.filter((submission) => submission.editorialReviewStatus === 'approved').length,
    pendingCount: activePublishedSubmissions.filter((submission) => (submission.editorialReviewStatus ?? 'pending') === 'pending').length,
    reviseCount: activePublishedSubmissions.filter((submission) => submission.editorialReviewStatus === 'revise').length,
    quarantineCount: activePublishedSubmissions.filter((submission) => submission.editorialReviewStatus === 'quarantine').length,
    retireCount: activePublishedSubmissions.filter((submission) => submission.editorialReviewStatus === 'retire').length,
    missingEvidenceCount: editorialMissingEvidence.length,
    coverageComplete: review.coverage.complete,
  };
  activePublishedSubmissions.forEach((submission) => {
    const objectId = submission.lineageId ?? submission.id;
    const destinations = getPipelineStudioDestinationOptions(submission.assetType);
    if (destinations.length && !submission.requestedStudioDestination) issues.push({ code: 'missing-route', severity: 'error', objectId, objectName: submission.name, message: 'Published revision has no destination route.', repair: 'Choose its native Library/Design destination.' });
    if (submission.requestedStudioDestination && !destinations.includes(submission.requestedStudioDestination)) issues.push({ code: 'invalid-route', severity: 'error', objectId, objectName: submission.name, message: 'Published revision has a destination incompatible with its kind.', repair: 'Review routing through the native Pipeline owner; Sets use package installation without a Studio destination.' });
    const payloadText = submission.sourcePayload == null ? '' : JSON.stringify(submission.sourcePayload);
    const usesRetiredSource = (submission.sourceUrl ?? '').includes('cardforge-developer-assets')
      || payloadText.includes('cardforge-developer-assets')
      || payloadText.includes('bootstrap-media://')
      || payloadText.includes('site-fallback://')
      || payloadText.includes('/card-assets/');
    if (usesRetiredSource) issues.push({ code: 'retired-source', severity: 'error', objectId, objectName: submission.name, message: 'Published content still depends on a retired or repository-local asset source.', repair: 'Migrate every referenced object into current Pipeline storage and publish the corrected revision.' });
    if (submission.assetType === 'templates' && submission.sourcePayload && typeof submission.sourcePayload === 'object') {
      const templateUsage = (submission.sourcePayload as { templateUsage?: unknown }).templateUsage;
      const expectedRoute = templateUsage === 'back-preset' ? 'template.back' : 'template.front';
      if (submission.requestedStudioDestination && submission.requestedStudioDestination !== expectedRoute) {
        issues.push({ code: 'route-content-mismatch', severity: 'error', objectId, objectName: submission.name, message: `Template content belongs in ${expectedRoute}, but its published route says ${submission.requestedStudioDestination}.`, repair: 'Align the immutable revision metadata, current registry route, and Studio destination.' });
      }
    }
    const isSvg = submission.sourceMimeType === 'image/svg+xml' || /\.svg(?:$|[?#])/iu.test(submission.sourceUrl ?? '');
    const isSafeVectorRoute = submission.assetType === 'icons'
      || submission.assetType === 'dividers'
      || (submission.assetType === 'imageAssets' && Boolean(submission.requestedStudioDestination?.startsWith('image.border.')));
    if (isSvg && !isSafeVectorRoute) issues.push({ code: 'unsafe-vector-route', severity: 'error', objectId, objectName: submission.name, message: 'Published SVG is routed outside the reviewed Icon, Divider, or Border Overlay lanes.', repair: 'Archive it or publish a sanitized raster replacement in the matching Studio lane.' });
    if (!hasRequiredPipelineClassification(submission.assetType, submission.specialtyTags, submission.useCaseTags)) issues.push({ code: 'missing-taxonomy', severity: 'warning', objectId, objectName: submission.name, message: 'Published revision is missing controlled specialty/use-case taxonomy.', repair: 'Choose this published item in Content Health and save its specialty and use-case tags.' });
    if (!hasRequiredSemanticTaxonomy({
      assetType: submission.assetType,
      semanticRole: submission.semanticRole,
      variantOfAssetId: submission.variantOfAssetId,
      variantKind: submission.variantKind,
    })) issues.push({
      code: 'missing-semantic-role',
      severity: 'warning',
      objectId,
      objectName: submission.name,
      message: 'Published revision has no valid semantic role or has an incomplete variant relationship.',
      repair: 'Use Owner Pipeline Manage to set what this exact revision is, then re-review editorial readiness without changing its stable asset identity.',
    });
    if (!submission.sourceUrl && !submission.sourcePayload) issues.push({ code: 'missing-source', severity: 'error', objectId, objectName: submission.name, message: 'Published revision has no readable source.', repair: 'Archive it or publish a verified replacement revision.' });
  });
  review.entries.filter((entry) => (
    !hasExactPublishedPointers || activePublishedSubmissionIds.has(entry.submissionId)
  )).forEach((entry) => {
    const objectId = entry.lineageId ?? entry.submissionId;
    if (entry.template?.proposedFormatMetadata) issues.push({ code: 'inferred-format', severity: 'warning', objectId, objectName: entry.name, message: 'Template physical size currently relies on legacy inference.', repair: 'Review the proposed explicit format in the content review download and compare rendered output before publishing a revision.' });
    if (entry.revisionNeedsReview) issues.push({ code: 'legacy-revision', severity: 'warning', objectId, objectName: entry.name, message: 'Published submission has no explicit revision number; legacy readers remain supported.', repair: 'Inspect its immutable lineage before creating the next revision. Do not assign a guessed revision number.' });
  });
  return {
    checkedCount: published.length,
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    issues,
    editorial,
    review,
  };
};