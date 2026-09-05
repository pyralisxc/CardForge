import { describe, expect, it } from 'vitest';

import { buildPipelineContentHealth } from '@/features/pipeline/lib/pipelineContentHealth';
import { buildPipelineContentReview } from '@/features/pipeline/lib/pipelineContentReview';
import { resolveTemplateCardFormat } from '@/domain/card-formats';
import type { PipelineProgramView, PipelineSubmission } from '@/features/pipeline/lib/pipelineProgram';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PipelineContentHealthPanel } from '@/features/pipeline/components/PipelineContentHealthPanel';

const programWith = (overrides: Partial<PipelineSubmission> = {}): PipelineProgramView => ({
  submissions: [{
    id: 'revision-id', lineageId: 'lineage-id', registryAssetId: 'registry-id',
    name: 'Published object', status: 'published', assetType: 'sets',
    requestedStudioDestination: null, specialtyTags: ['games'], useCaseTags: ['playing-cards'],
    sourceUrl: 'https://example.com/set.cardforge', sourcePayload: null,
    sourceNotes: 'Original artwork', previewUrl: 'https://example.com/preview.webp',
    revisionNumber: 1, baseRevisionNumber: null, updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  }],
  totalSubmissionCount: 1,
} as PipelineProgramView);

describe('Pipeline content health', () => {
  it.each(['textures', 'dividers', 'icons', 'imageAssets', 'elementPresets', 'fonts', 'templates', 'sets'] as const)('uses the same General resource policy in health and review for %s', (assetType) => {
    const program = programWith({ assetType, specialtyTags: ['general'], useCaseTags: [] });
    const requiresUseCase = assetType === 'templates' || assetType === 'sets';
    expect(buildPipelineContentHealth({ catalog: null, program }).issues.some((issue) => issue.code === 'missing-taxonomy')).toBe(requiresUseCase);
    expect(buildPipelineContentReview(program).entries[0]?.classificationNeedsReview).toBe(requiresUseCase);
  });
  it('accepts destination-free Sets but checks routes for routed asset kinds', () => {
    expect(buildPipelineContentHealth({ catalog: null, program: programWith() }).errors).toBe(0);
    expect(buildPipelineContentHealth({ catalog: null, program: programWith({ assetType: 'templates' }) }).issues)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'missing-route' })]));
    expect(buildPipelineContentHealth({ catalog: null, program: programWith({ assetType: 'templates', requestedStudioDestination: 'typography.font' }) }).issues)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'invalid-route' })]));
  });

  it.each([
    ['3:4', 'event-badge', 75, 100],
    ['35:20', 'us-business', 88.9, 50.8],
  ])('proposes explicit metadata without changing the native legacy format %s', (aspectRatio, formatId, width, height) => {
    const sourcePayload = { id: 'old-theme', name: 'Original theme', aspectRatio, fieldContracts: [] };
    const program = programWith({ assetType: 'templates', requestedStudioDestination: 'template.front', sourcePayload, revisionNumber: null });
    const before = JSON.stringify(program);
    const review = buildPipelineContentReview(program);
    const entry = review.entries[0]!;
    expect(entry.template?.proposedFormatMetadata).toEqual({ formatId, trimWidthMm: width, trimHeightMm: height });
    expect(resolveTemplateCardFormat({ ...sourcePayload, ...entry.template!.proposedFormatMetadata }))
      .toEqual(resolveTemplateCardFormat(sourcePayload));
    expect(entry.revisionNumber).toBeNull();
    expect(entry.revisionNeedsReview).toBe(true);
    expect(entry.submissionId).toBe('revision-id');
    expect(entry.lineageId).toBe('lineage-id');
    expect(JSON.stringify(program)).toBe(before);
  });

  it('does not guess classifications or claim full coverage of paged revisions', () => {
    const program = programWith({ specialtyTags: [], useCaseTags: [] });
    program.totalSubmissionCount = 80;
    const review = buildPipelineContentReview(program);
    expect(review.coverage.complete).toBe(false);
    expect(review.entries[0]?.classification).toEqual({ specialtyTags: [], useCaseTags: [] });
    expect(review.entries[0]?.classificationNeedsReview).toBe(true);
    expect(buildPipelineContentReview(null).coverage.complete).toBe(false);
  });

  it('renders findings beyond the former 30-item cutoff without requiring repairs', () => {
    const health = buildPipelineContentHealth({ catalog: null, program: null });
    health.issues = Array.from({ length: 80 }, (_, index) => ({
      code: 'missing-taxonomy', severity: 'warning', objectId: `object-${index}`, objectName: `Object ${index}`,
      message: 'Classification missing', repair: 'Review classification',
    }));
    const markup = renderToStaticMarkup(createElement(PipelineContentHealthPanel, { health, canRepair: true, onOpenObject: () => undefined }));
    expect(markup).toContain('Object 79');
    expect(markup.match(/<article/g)).toHaveLength(80);
    expect(markup).toContain('Download content review (no changes)');
  });

  it('projects repairable lineage, preview, duplicate-name, and Set package issues', () => {
    const health = buildPipelineContentHealth({
      catalog: {
        version: 'test', access: 'free',
        templates: { defaults: [], userTemplates: [] },
        styles: { version: 1, styles: [] },
        assets: { templates: [], textures: [], dividers: [], icons: [], imageAssets: [], elementPresets: [], registry: { configured: true, source: 'database', total: 0 } },
        fonts: { fonts: [], registry: { configured: true, source: 'database', total: 0 } },
        sets: { items: [{ id: 'starter', name: 'Starter', packageUrl: 'http://unsafe.test/set.cardforge', previewUrl: null, access: 'free', source: 'official', fileSizeBytes: 20, revision: 1, description: 'Starter', specialtyTags: [], useCaseTags: [] }] },
        pipeline: { items: [
          { id: 'one', lineageId: null, name: 'Duplicate', assetType: 'image', previewUrl: null, access: 'free', source: 'official', fileSizeBytes: 1, updatedAt: null },
          { id: 'two', lineageId: 'lineage-two', name: 'Duplicate', assetType: 'image', previewUrl: '/preview.png', access: 'free', source: 'official', fileSizeBytes: 1, updatedAt: null },
        ] },
      },
      program: null,
    });

    expect(health.checkedCount).toBe(2);
    expect(health.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['missing-lineage', 'missing-preview', 'duplicate-name', 'invalid-package', 'missing-taxonomy']));
    expect(health.errors).toBeGreaterThan(0);
  });
});
