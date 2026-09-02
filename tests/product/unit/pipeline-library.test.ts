import { describe, expect, it } from 'vitest';

import { DEFAULT_PIPELINE_PROGRAM_SETTINGS } from '@/features/pipeline/lib/pipelineItems';
import {
  getPipelineImagePreviewUrl,
  isContributorPipelineReviewable,
  projectPipelineLibrary,
} from '@/features/pipeline/lib/pipelineLibrary';
import type { PipelineSubmission } from '@/features/pipeline/lib/pipelineProgram';
import type { CardForgeCatalogManifest } from '@/features/pipeline/lib/catalogManifest';
import { projectPipelineLibraryObjects } from '@/features/storage-management/hooks/useLibrarySharedProjection';

const submission = (
  id: string,
  overrides: Partial<PipelineSubmission> = {},
): PipelineSubmission => ({
  id,
  contributorId: 'contributor-other',
  contributorEmail: null,
  contributorDisplayName: 'Other Contributor',
  assetType: 'templates',
  requestedStudioDestination: 'template.front',
  specialtyTags: ['games'],
  useCaseTags: ['playing-cards'],
  sourceNotes: 'Original work cleared for CardForge review.',
  name: 'Classic Front',
  description: 'A readable playing-card face.',
  previewUrl: '/api/templates#classic-front',
  sourceUrl: null,
  sourceFileSizeBytes: 1024,
  sourceMimeType: 'application/json',
  sourceStorageBucket: null,
  sourceStoragePath: null,
  registryAssetId: null,
  status: 'submitted',
  automatedStatus: 'voting',
  ownerStatusOverride: null,
  calculatedAccessTier: 'contributor',
  automatedAccessTier: 'contributor',
  ownerAccessTierOverride: null,
  qualityScore: 72,
  tierDecisionReason: null,
  decisionReason: null,
  positiveVotes: 2,
  negativeVotes: 0,
  currentUserVote: null,
  sourcePayload: null,
  targetRegistryAssetId: 'classic-front',
  baseRevisionNumber: 0,
  revisionNumber: 1,
  publishedAt: null,
  purgeState: null,
  submittedAt: '2026-08-20T12:00:00.000Z',
  updatedAt: '2026-08-20T12:00:00.000Z',
  ...overrides,
});

const program = (submissions: PipelineSubmission[]) => ({
  submissions: submissions.filter((item) => item.contributorId === 'contributor-current'),
  votingQueue: submissions.filter((item) => item.contributorId !== 'contributor-current'),
  currentContributorIds: ['contributor-current'],
  settings: DEFAULT_PIPELINE_PROGRAM_SETTINGS,
});

describe('Pipeline Library projection', () => {
  it('shows one object per lineage and keeps the current published revision primary', () => {
    const published = submission('published-r2', {
      status: 'published', revisionNumber: 2, publishedAt: '2026-08-22T12:00:00.000Z',
    });
    const candidate = submission('candidate-r3', {
      status: 'publish_candidate', revisionNumber: 3, updatedAt: '2026-08-24T12:00:00.000Z',
    });

    const projected = projectPipelineLibrary(program([candidate, published]));

    expect(projected).toHaveLength(1);
    expect(projected[0].submission.id).toBe('published-r2');
    expect(projected[0].currentPublishedSubmission?.id).toBe('published-r2');
    expect(projected[0].revisions.map((item) => item.id)).toEqual(['candidate-r3', 'published-r2']);
    expect(projected[0].reviewState).toBe('closed');
  });

  it('uses the strongest active candidate when a lineage has no published revision', () => {
    const newerDraft = submission('draft-r4', {
      contributorId: 'contributor-current', status: 'draft', revisionNumber: 4,
    });
    const candidate = submission('candidate-r3', {
      contributorId: 'contributor-current', status: 'publish_candidate', revisionNumber: 3,
    });

    const projected = projectPipelineLibrary(program([newerDraft, candidate]));

    expect(projected[0].submission.id).toBe('candidate-r3');
    expect(projected[0].ownership).toBe('mine');
    expect(projected[0].reviewState).toBe('available');
  });

  it('separates lifecycle from voteability', () => {
    expect(isContributorPipelineReviewable(submission('submitted'))).toBe(true);
    expect(isContributorPipelineReviewable(submission('live', { status: 'published' }))).toBe(false);
    expect(isContributorPipelineReviewable(submission('archived', { status: 'archived' }))).toBe(false);
  });

  it('admits only real image previews and rejects packages, fonts, and structured endpoints', () => {
    expect(getPipelineImagePreviewUrl(submission('image', {
      previewUrl: 'https://storage.example.test/preview.webp',
      sourceMimeType: 'application/vnd.cardforge.project+zip',
    }))).toBe('https://storage.example.test/preview.webp');
    expect(getPipelineImagePreviewUrl(submission('package', {
      previewUrl: 'https://storage.example.test/deck.cardforge',
      sourceMimeType: 'application/vnd.cardforge.project+zip',
    }))).toBeNull();
    expect(getPipelineImagePreviewUrl(submission('template', {
      previewUrl: '/api/templates#classic-front',
      sourceMimeType: 'application/json',
    }))).toBeNull();
  });

  it('reuses the published catalog visual for a published Pipeline lineage', () => {
    const publishedImage = submission('published-image', {
      assetType: 'imageAssets',
      status: 'published',
      targetRegistryAssetId: 'ember-art',
      previewUrl: 'https://storage.example.test/ember-art.cardforge',
      sourceMimeType: 'application/vnd.cardforge.project+zip',
    });
    const catalog = {
      version: 'test',
      access: 'contributor',
      templates: { defaults: [], userTemplates: [] },
      styles: { version: 1, styles: [] },
      assets: {
        textures: [], dividers: [], icons: [], templates: [], elementPresets: [],
        imageAssets: [{
          id: 'ember-art', name: 'Ember Art', kind: 'image', url: '/card-assets/ember-art.png', previewUrl: '/card-assets/ember-art-preview.webp',
          tileMode: 'contain', seamless: false, allowedTargets: ['image'],
        }],
        registry: { configured: true, source: 'database', total: 1 },
      },
      fonts: { fonts: [], registry: { configured: true, source: 'database', total: 0 } },
      sets: { items: [] },
    } as CardForgeCatalogManifest;

    const projected = projectPipelineLibraryObjects(program([publishedImage]), catalog);

    expect(projected[0].previewUrl).toBe('/card-assets/ember-art-preview.webp');
  });

  it('reuses the published font family for a Pipeline font sample', () => {
    const publishedFont = submission('published-font', {
      assetType: 'fonts',
      status: 'published',
      targetRegistryAssetId: 'font-arcane',
      previewUrl: 'https://storage.example.test/font-arcane.woff2',
      sourceMimeType: 'font/woff2',
    });
    const catalog = {
      version: 'test',
      access: 'contributor',
      templates: { defaults: [], userTemplates: [] },
      styles: { version: 1, styles: [] },
      assets: {
        textures: [], dividers: [], icons: [], templates: [], elementPresets: [], imageAssets: [],
        registry: { configured: true, source: 'database', total: 0 },
      },
      fonts: {
        fonts: [{ name: 'Arcane', value: 'font-arcane', category: 'Fantasy', cssFamily: 'Arcane, serif' }],
        registry: { configured: true, source: 'database', total: 1 },
      },
      sets: { items: [] },
    } as CardForgeCatalogManifest;

    const projected = projectPipelineLibraryObjects(program([publishedFont]), catalog);

    expect(projected[0].previewUrl).toBeNull();
    expect(projected[0].fontFamily).toBe('Arcane, serif');
  });

  it('falls back to the canonical catalog name when legacy lineage ids do not match', () => {
    const publishedImage = submission('published-image-legacy', {
      assetType: 'imageAssets',
      status: 'published',
      name: 'Ember Art',
      targetRegistryAssetId: 'legacy-ember-lineage',
      registryAssetId: null,
      previewUrl: '',
      sourceMimeType: 'application/octet-stream',
    });
    const catalog = {
      version: 'test', access: 'contributor', templates: { defaults: [], userTemplates: [] }, styles: { version: 1, styles: [] },
      assets: {
        textures: [], dividers: [], icons: [], templates: [], elementPresets: [],
        imageAssets: [{
          id: 'current-ember-art', name: 'Ember Art', kind: 'image', url: '/card-assets/ember-art.png',
          tileMode: 'contain', seamless: false, allowedTargets: ['image'],
        }],
        registry: { configured: true, source: 'database', total: 1 },
      },
      fonts: { fonts: [], registry: { configured: true, source: 'database', total: 0 } }, sets: { items: [] },
    } as CardForgeCatalogManifest;

    expect(projectPipelineLibraryObjects(program([publishedImage]), catalog)[0].previewUrl).toBe('/card-assets/ember-art.png');
  });
});
