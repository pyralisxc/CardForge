import { describe, expect, it } from 'vitest';

import { buildPipelineContentHealth } from '@/features/pipeline/lib/pipelineContentHealth';
import { buildPipelineContentReview } from '@/features/pipeline/lib/pipelineContentReview';
import { resolveTemplateCardFormat } from '@/domain/card-formats';
import type { PipelineProgramView, PipelineSubmission } from '@/features/pipeline/lib/pipelineProgram';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PipelineContentHealthPanel } from '@/features/pipeline/components/PipelineContentHealthPanel';
import type { CardForgeCatalogManifest } from '@/features/pipeline/lib/catalogManifest';

const programWith = (overrides: Partial<PipelineSubmission> = {}): PipelineProgramView => ({
  submissions: [{
    id: 'revision-id', lineageId: 'lineage-id', registryAssetId: 'registry-id',
    name: 'Published object', status: 'published', assetType: 'sets',
    requestedStudioDestination: null, specialtyTags: ['games'], useCaseTags: ['playing-cards'],
    semanticRole: 'set', visualFamily: null, variantOfAssetId: null, variantKind: null, compatibilityTags: [],
    sourceUrl: 'https://example.com/set.cardforge', sourcePayload: null,
    sourceNotes: 'Original artwork', previewUrl: 'https://example.com/preview.webp',
    editorialReviewStatus: 'pending', editorialReviewNote: '', editorialReviewedBy: null, editorialReviewedAt: null,
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
  it('reports legacy published content as semantic curation debt without guessing a role', () => {
    const program = programWith({ semanticRole: null });
    const health = buildPipelineContentHealth({ catalog: null, program });
    const review = buildPipelineContentReview(program);

    expect(health.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing-semantic-role', severity: 'warning' }),
    ]));
    expect(health.editorial.missingEvidenceCount).toBe(1);
    expect(review.entries[0]?.semanticTaxonomy).toMatchObject({
      semanticRole: null,
      visualFamily: null,
      variantOfAssetId: null,
      variantKind: null,
      compatibilityTags: [],
    });
    expect(review.entries[0]?.semanticTaxonomyNeedsReview).toBe(true);
  });

  it('keeps technical health distinct from exact-revision editorial readiness', () => {
    const health = buildPipelineContentHealth({
      catalog: null,
      program: programWith({ editorialReviewStatus: 'pending' }),
    });

    expect(health.errors).toBe(0);
    expect(health.warnings).toBe(0);
    expect(health.editorial).toMatchObject({
      checkedCount: 1,
      approvedCount: 0,
      pendingCount: 1,
      missingEvidenceCount: 0,
    });

    const markup = renderToStaticMarkup(createElement(PipelineContentHealthPanel, {
      health,
      canRepair: true,
      onOpenObject: () => undefined,
    }));
    expect(markup).toContain('Technical health');
    expect(markup).toContain('Editorial readiness');
    expect(markup).toContain('0 errors · 0 warnings');
    expect(markup).toContain('0 approved · 1 pending');
  });

  it('recognizes approved live revisions without hiding technical findings', () => {
    const health = buildPipelineContentHealth({
      catalog: null,
      program: programWith({
        editorialReviewStatus: 'approved',
        editorialReviewNote: 'Original first-party set reviewed at intended size.',
        editorialReviewedBy: 'owner-1',
        editorialReviewedAt: '2026-10-08T00:00:00Z',
      }),
    });

    expect(health.editorial.approvedCount).toBe(1);
    expect(health.editorial.pendingCount).toBe(0);
  });

  it('accepts destination-free Sets but checks routes for routed asset kinds', () => {
    expect(buildPipelineContentHealth({ catalog: null, program: programWith() }).errors).toBe(0);
    expect(buildPipelineContentHealth({ catalog: null, program: programWith({ assetType: 'templates' }) }).issues)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'missing-route' })]));
    expect(buildPipelineContentHealth({ catalog: null, program: programWith({ assetType: 'templates', requestedStudioDestination: 'typography.font' }) }).issues)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'invalid-route' })]));
  });

  it('flags legacy SVG sources outside the reviewed vector lanes', () => {
    const unsafe = buildPipelineContentHealth({
      catalog: null,
      program: programWith({
        assetType: 'imageAssets',
        requestedStudioDestination: 'image.picture',
        sourceMimeType: 'image/svg+xml',
        sourceUrl: 'https://example.com/picture.svg',
      }),
    });
    const safe = buildPipelineContentHealth({
      catalog: null,
      program: programWith({
        assetType: 'icons',
        requestedStudioDestination: 'element.icon',
        sourceMimeType: 'image/svg+xml',
        sourceUrl: 'https://example.com/icon.svg',
      }),
    });
    expect(unsafe.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'unsafe-vector-route', severity: 'error' })]));
    expect(safe.issues.some((issue) => issue.code === 'unsafe-vector-route')).toBe(false);
  });

  it('rejects retired storage references and Template face-route drift', () => {
    const health = buildPipelineContentHealth({
      catalog: null,
      program: programWith({
        assetType: 'templates',
        requestedStudioDestination: 'template.front',
        sourceUrl: null,
        sourcePayload: {
          id: 'back-template',
          name: 'Back Template',
          templateUsage: 'back-preset',
          cardBackgroundImageUrl: 'https://example.supabase.co/storage/v1/object/public/cardforge-developer-assets/back.webp',
        },
      }),
    });

    expect(health.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'retired-source', severity: 'error' }),
      expect.objectContaining({ code: 'route-content-mismatch', severity: 'error' }),
    ]));
  });

  it('audits only the registry-pointed live revision when immutable history still says published', () => {
    const active = programWith({ id: 'active-r2', revisionNumber: 2 });
    active.submissions.push({
      ...active.submissions[0]!,
      id: 'historical-r1',
      revisionNumber: 1,
      sourceUrl: 'https://example.supabase.co/storage/v1/object/public/cardforge-developer-assets/retired.webp',
    });
    const catalog = {
      version: 'test', access: 'free',
      templates: { defaults: [], userTemplates: [] },
      styles: { version: 1, styles: [] },
      assets: { templates: [], textures: [], dividers: [], icons: [], imageAssets: [], elementPresets: [], registry: { configured: true, source: 'database', total: 1 } },
      fonts: { fonts: [], registry: { configured: true, source: 'database', total: 0 } },
      sets: { items: [] },
      pipeline: { items: [{
        id: 'registry-id', submissionId: 'active-r2', lineageId: 'lineage-id', name: 'Published object',
        assetType: 'set', previewUrl: 'https://example.com/preview.webp', access: 'free', source: 'official',
        fileSizeBytes: 1024, updatedAt: '2026-09-01T00:00:00Z',
      }] },
    } as unknown as CardForgeCatalogManifest;

    const health = buildPipelineContentHealth({ catalog, program: active });

    expect(health.issues.some((issue) => issue.code === 'retired-source')).toBe(false);
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

  it('allows the same display name in different asset lanes', () => {
    const health = buildPipelineContentHealth({
      catalog: {
        version: 'test', access: 'free',
        templates: { defaults: [], userTemplates: [] },
        styles: { version: 1, styles: [] },
        assets: { templates: [], textures: [], dividers: [], icons: [], imageAssets: [], elementPresets: [], registry: { configured: true, source: 'database', total: 0 } },
        fonts: { fonts: [], registry: { configured: true, source: 'database', total: 0 } },
        sets: { items: [] },
        pipeline: { items: [
          { id: 'style', lineageId: 'style-lineage', name: 'Gem Center', assetType: 'elementPreset', previewUrl: '/style.png', access: 'free', source: 'official', fileSizeBytes: 1, updatedAt: null },
          { id: 'divider', lineageId: 'divider-lineage', name: 'Gem Center', assetType: 'divider', previewUrl: '/divider.png', access: 'free', source: 'official', fileSizeBytes: 1, updatedAt: null },
        ] },
      },
      program: null,
    });

    expect(health.issues.some((issue) => issue.code === 'duplicate-name')).toBe(false);
  });
});