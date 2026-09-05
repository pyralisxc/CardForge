import { resolveTemplateCardFormat } from '@/domain/card-formats';
import { normalizeSpecialtyTags, normalizeUseCaseTags } from './contentTaxonomy';
import type { PipelineProgramView } from './pipelineProgram';
import { isRepositoryTemplate } from './registryContentValidation';

/** Read-only proposals over loaded revisions; publication remains owned by Pipeline. */
export const buildPipelineContentReview = (program: PipelineProgramView | null) => ({
  mode: 'dry-run' as const,
  coverage: {
    loadedSubmissions: program?.submissions.length ?? 0,
    totalSubmissions: program?.totalSubmissionCount ?? null,
    complete: program !== null && program.submissions.length >= program.totalSubmissionCount,
  },
  publicationPolicy: 'Review classification and lineage; publish approved changes through native Pipeline revisions. Do not rewrite published payloads or installed copies.',
  entries: (program?.submissions ?? []).filter((submission) => submission.status === 'published').map((submission) => {
    const template = isRepositoryTemplate(submission.sourcePayload) ? submission.sourcePayload : null;
    const format = template ? resolveTemplateCardFormat(template) : null;
    const formatInferred = Boolean(template && (!template.formatId || !template.trimWidthMm || !template.trimHeightMm));
    const specialtyTags = normalizeSpecialtyTags(submission.specialtyTags);
    const useCaseTags = normalizeUseCaseTags(submission.useCaseTags);
    return {
      submissionId: submission.id,
      registryAssetId: submission.registryAssetId,
      lineageId: submission.lineageId ?? null,
      name: submission.name,
      kind: submission.assetType,
      revisionNumber: submission.revisionNumber,
      baseRevisionNumber: submission.baseRevisionNumber,
      updatedAt: submission.updatedAt,
      sourceUrl: submission.sourceUrl,
      previewUrl: submission.previewUrl,
      sourceNotes: submission.sourceNotes,
      destination: submission.requestedStudioDestination,
      classification: { specialtyTags, useCaseTags },
      classificationNeedsReview: !specialtyTags.length || !useCaseTags.length,
      revisionNeedsReview: submission.revisionNumber === null,
      template: template && format ? {
        id: template.id,
        fieldContracts: template.fieldContracts ?? [],
        resolvedFormat: format,
        proposedFormatMetadata: formatInferred ? {
          formatId: format.formatId,
          trimWidthMm: format.widthMm,
          trimHeightMm: format.heightMm,
        } : null,
        expectedVisualResult: 'Preserve current resolved physical size, canvas geometry, fields and artwork. Compare previews and exports before publishing.',
      } : null,
    };
  }),
});

export type PipelineContentReview = ReturnType<typeof buildPipelineContentReview>;
