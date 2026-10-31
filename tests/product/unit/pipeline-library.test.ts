import { describe, expect, it } from 'vitest';

import { DEFAULT_PIPELINE_PROGRAM_SETTINGS } from '@/features/pipeline/lib/pipelineItems';
import {
  getPipelineImagePreviewUrl,
  isContributorPipelineReviewable,
  isContributorPipelineVoteable,
  projectPipelineLibrary,
} from '@/features/pipeline/lib/pipelineLibrary';
import type { PipelineSubmission } from '@/features/pipeline/lib/pipelineProgram';
import type { CardForgeCatalogManifest } from '@/features/pipeline/lib/catalogManifest';
import { identityCatalog, identityProgram, identitySubmission, identityTemplate } from '../fixtures/libraryTemplateIdentityData';
import { projectPublishedLibraryObjects, projectPipelineLibraryObjects } from '@/features/storage-management/hooks/useLibrarySharedProjection';

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
  semanticRole: 'template-front',
  visualFamily: 'Classic Cards',
  variantKind: 'base',
  variantLabel: null,
  compatibilityTags: ['front', 'print'],
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
  it('keeps the published revision primary while routing review to the active candidate', () => {
    const published = submission('published-r2', {
      status: 'published', revisionNumber: 2, publishedAt: '2026-08-22T12:00:00.000Z',
    });
    const candidate = submission('candidate-r3', {
      status: 'publish_candidate', revisionNumber: 3, updatedAt: '2026-08-24T12:00:00.000Z',
    });

    const projected = projectPipelineLibrary(program([candidate, published]));

    expect(projected).toHaveLength(1);
    expect(projected[0].submission.id).toBe('published-r2');
    expect(projected[0].reviewSubmission?.id).toBe('candidate-r3');
    expect(projected[0].editableSubmission).toBeNull();
    expect(projected[0].currentPublishedSubmission?.id).toBe('published-r2');
    expect(projected[0].revisions.map((item) => item.id)).toEqual(['candidate-r3', 'published-r2']);
    expect(projected[0].reviewState).toBe('available');
  });

  it('uses the registry pointer as the exact live revision when historical rows still say published', () => {
    const olderLive = submission('published-r2', {
      lineageId: 'lineage-1', status: 'published', revisionNumber: 2,
      publishedAt: '2026-08-22T12:00:00.000Z',
    });
    const newerHistorical = submission('published-r3', {
      lineageId: 'lineage-1', status: 'published', revisionNumber: 3,
      publishedAt: '2026-08-24T12:00:00.000Z',
    });

    const projected = projectPipelineLibrary(
      program([newerHistorical, olderLive]),
      new Map([['lineage-1', 'published-r2']]),
    );

    expect(projected[0].submission.id).toBe('published-r2');
    expect(projected[0].currentPublishedSubmission?.id).toBe('published-r2');
  });

  it('projects the exact owned candidate revision as editable behind a published primary', () => {
    const published = submission('published-r2', {
      status: 'published', revisionNumber: 2, publishedAt: '2026-08-22T12:00:00.000Z',
    });
    const candidate = submission('candidate-r3', {
      contributorId: 'contributor-current', status: 'publish_candidate', revisionNumber: 3, updatedAt: '2026-08-24T12:00:00.000Z',
    });

    const projected = projectPipelineLibrary(program([candidate, published]));

    expect(projected[0].submission.id).toBe('published-r2');
    expect(projected[0].reviewSubmission?.id).toBe('candidate-r3');
    expect(projected[0].editableSubmission?.id).toBe('candidate-r3');
    expect(projected[0].ownership).toBe('mine');
    expect(projected[0].reviewState).toBe('available');
  });

  it('keeps contributor lifecycle actions pinned to the exact eligible revision', () => {
    const published = submission('published-r2', {
      contributorId: 'contributor-current', status: 'published', revisionNumber: 2,
    });
    const withdrawn = submission('withdrawn-r3', {
      contributorId: 'contributor-current', status: 'archived', revisionNumber: 3,
      contributorLifecycleState: 'withdrawn',
    });
    const activeCandidate = submission('candidate-r4', {
      contributorId: 'contributor-current', status: 'publish_candidate', revisionNumber: 4,
    });

    const projected = projectPipelineLibrary(program([withdrawn, published, activeCandidate]));

    expect(projected[0].currentPublishedSubmission?.id).toBe('published-r2');
    expect(projected[0].editableSubmission?.id).toBe('candidate-r4');
    expect(projected[0].retirableSubmission?.id).toBe('published-r2');
    expect(projected[0].revisions.map((item) => item.id)).toEqual([
      'candidate-r4',
      'withdrawn-r3',
      'published-r2',
    ]);
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
    expect(projected[0].reviewSubmission?.id).toBe('candidate-r3');
    expect(projected[0].ownership).toBe('mine');
    expect(projected[0].reviewState).toBe('available');
  });

  it('does not expose a closed revision as a review target', () => {
    const published = submission('published-r2', {
      status: 'published', revisionNumber: 2, publishedAt: '2026-08-22T12:00:00.000Z',
    });

    const projected = projectPipelineLibrary(program([published]));

    expect(projected[0].submission.id).toBe('published-r2');
    expect(projected[0].reviewSubmission).toBeNull();
    expect(projected[0].reviewState).toBe('closed');
  });

  it('separates lifecycle from voteability', () => {
    expect(isContributorPipelineReviewable(submission('submitted'))).toBe(true);
    expect(isContributorPipelineReviewable(submission('live', { status: 'published' }))).toBe(false);
    expect(isContributorPipelineReviewable(submission('archived', { status: 'archived' }))).toBe(false);
    expect(isContributorPipelineVoteable(submission('submitted'))).toBe(true);
    expect(isContributorPipelineVoteable(submission('live', { status: 'published' }))).toBe(true);
    expect(isContributorPipelineVoteable(submission('history', { status: 'archived', publishedAt: '2026-08-22T12:00:00.000Z' }))).toBe(true);
    expect(isContributorPipelineVoteable(submission('rejected', { status: 'rejected' }))).toBe(true);
    expect(isContributorPipelineVoteable(submission('draft', { status: 'draft' }))).toBe(false);
    expect(isContributorPipelineVoteable(submission('trash', { status: 'archived', trashedAt: '2026-08-24T12:00:00.000Z' }))).toBe(false);
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
    } as unknown as CardForgeCatalogManifest;

    catalog.pipeline = { items: [{ id: 'ember-art', submissionId: publishedImage.id }] } as CardForgeCatalogManifest['pipeline'];
    const projected = projectPipelineLibraryObjects(program([publishedImage]), catalog);

    expect(projected[0].previewUrl).toBe('/card-assets/ember-art-preview.webp');
  });

  it('uses the canonical hydrated catalog Template for the exact live revision', () => {
    const staleSubmissionTemplate = {
      id: 'template-arcane', name: 'Arcane', aspectRatio: '63:88',
      cardBackgroundImageUrl: 'cardforge-pipeline-asset://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    };
    const hydratedCatalogTemplate = {
      ...staleSubmissionTemplate,
      cardBackgroundImageUrl: 'https://assets.example.test/template-assets/arcane.webp',
    };
    const published = submission('published-template-r2', {
      lineageId: 'arcane-lineage', status: 'published', revisionNumber: 2,
      targetRegistryAssetId: 'template-arcane', sourcePayload: staleSubmissionTemplate,
    });
    const catalog = {
      version: 'test', access: 'contributor', templates: { defaults: [hydratedCatalogTemplate], userTemplates: [] }, styles: { version: 1, styles: [] },
      assets: {
        textures: [], dividers: [], icons: [], imageAssets: [], elementPresets: [],
        templates: [{ id: 'template-arcane', name: 'Arcane', kind: 'template', url: '/api/templates#template-arcane' }],
        registry: { configured: true, source: 'database', total: 1 },
      },
      fonts: { fonts: [], registry: { configured: true, source: 'database', total: 0 } }, sets: { items: [] },
      pipeline: { items: [{
        id: 'template-arcane', submissionId: 'published-template-r2', lineageId: 'arcane-lineage', name: 'Arcane',
        assetType: 'template', previewUrl: '/api/templates#template-arcane', access: 'free', source: 'official', fileSizeBytes: 1024, updatedAt: null,
      }] },
    } as unknown as CardForgeCatalogManifest;

    const projected = projectPipelineLibraryObjects(program([published]), catalog);

    expect(projected[0].template?.cardBackgroundImageUrl).toBe('https://assets.example.test/template-assets/arcane.webp');
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

    catalog.pipeline = { items: [{ id: 'font-arcane', submissionId: publishedFont.id }] } as CardForgeCatalogManifest['pipeline'];
    const projected = projectPipelineLibraryObjects(program([publishedFont]), catalog);

    expect(projected[0].previewUrl).toBeNull();
    expect(projected[0].fontFamily).toBe('Arcane, serif');
  });

  it('does not substitute a same-name catalog object when legacy lineage ids do not match', () => {
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

    expect(projectPipelineLibraryObjects(program([publishedImage]), catalog)[0].previewUrl).toBeNull();
  });
});

describe('Library visual identity across Styles and files', () => {
  const style = { id: 'style-gilded', name: 'Gilded Filigree', kind: 'material', targets: ['shape'], appearance: { material: { baseColor: '#ffd700' } } };
  const catalog = {
    templates: { defaults: [], userTemplates: [] }, styles: { version: 1, styles: [style] },
    assets: { templates: [], imageAssets: [], textures: [], icons: [],
      dividers: [{ id: 'svg-gilded', name: style.name, kind: 'divider', url: '/divider.svg' }],
      elementPresets: [{ id: style.id, name: style.name, kind: 'elementPreset', url: '/api/styles#style-gilded' }] },
    fonts: { fonts: [] }, sets: { items: [] },
    pipeline: { items: [{ id: 'svg-gilded', submissionId: 'divider-r2' }, { id: style.id, submissionId: 'style-r1' }] },
  } as unknown as CardForgeCatalogManifest;
  it('hydrates an exact Style binding without attaching it to same-name files', () => {
    const rows = [submission('divider-r2', { assetType: 'dividers', name: style.name, status: 'published', targetRegistryAssetId: 'svg-gilded', previewUrl: '' }),
      submission('style-r1', { assetType: 'elementPresets', name: style.name, status: 'published', targetRegistryAssetId: style.id, previewUrl: '' })];
    const projected = projectPipelineLibraryObjects(program(rows), catalog);
    expect(projected.find(item => item.submission.id === 'divider-r2')).toMatchObject({ style: null, previewUrl: '/divider.svg' });
    expect(projected.find(item => item.submission.id === 'style-r1')?.style).toEqual(style);
    const published = projectPublishedLibraryObjects(catalog);
    expect(published.find(item => item.kind === 'divider')?.style).toBeNull();
    expect(published.find(item => item.kind === 'elementPreset')?.style).toEqual(style);
  });
  it('keeps historical source and missing source distinct from the current catalog visual', () => {
    for (const previewUrl of ['/historical.svg', '']) {
      const historical = submission('divider-r1', { assetType: 'dividers', name: style.name, status: 'archived', targetRegistryAssetId: 'svg-gilded', previewUrl });
      expect(projectPipelineLibraryObjects(program([historical]), catalog)[0]).toMatchObject({ style: null, previewUrl: previewUrl || null });
    }
    const authoredStyle = { ...style, appearance: { material: { baseColor: '#123456' } } };
    const historicalStyle = submission('style-r0', { assetType: 'elementPresets', name: style.name, status: 'archived', targetRegistryAssetId: style.id, sourcePayload: authoredStyle });
    expect(projectPipelineLibraryObjects(program([historicalStyle]), catalog)[0].style).toEqual(authoredStyle);
  });
  it.each(['image', 'texture', 'divider', 'icon'] as const)('does not attach Style data to a %s even with an embedded namesake style', kind => {
    const key = { image: 'imageAssets', texture: 'textures', divider: 'dividers', icon: 'icons' }[kind];
    const value = { ...catalog, assets: { ...catalog.assets, [key]: [{ id: `file-${kind}`, kind, name: style.name, style, url: '/own.svg' }] } } as CardForgeCatalogManifest;
    expect(projectPublishedLibraryObjects(value).find(item => item.id === `published:${kind}:file-${kind}`)?.style).toBeNull();
  });
});

describe('exact Template Library identity', () => {
  it('never borrows a same-name default when an asset ID is missing or mismatched', () => {
    const catalog = identityCatalog();
    expect(projectPublishedLibraryObjects(catalog).map(item => [item.id, item.template?.id ?? null])).toEqual([
      ['published:template:A', 'A'], ['published:template:B', 'B'], ['published:template:missing', null],
    ]);
    catalog.templates.defaults = [identityTemplate('wrong-id', '#0000ff')];
    expect(projectPublishedLibraryObjects(catalog).every(item => item.template === null)).toBe(true);
  });
  it.each(['missing-source', 'history', 'wrong-lineage', 'wrong-submission', 'missing-identity'])('keeps exact source or unavailable for %s', mode => {
    const catalog = identityCatalog();
    const row = identitySubmission(mode === 'wrong-lineage' ? 'A2' : 'A1', { name: 'Same name', status: 'published',
      lineageId: mode === 'wrong-lineage' ? 'wrong-lineage' : 'lineage-A', targetRegistryAssetId: mode === 'missing-identity' ? null : 'A',
      sourcePayload: mode === 'history' ? identityTemplate('original-A', '#00ff00') : null });
    const [item] = projectPipelineLibraryObjects(identityProgram([row]), catalog);
    expect(item.template).toEqual(mode === 'history' ? row.sourcePayload : null);
    expect(item.previewUrl).toBeNull();
  });
});


describe('current publication outside a revision page', () => {
  it('does not call a displayed historical publication live or retirable', () => {
    const old = identitySubmission('A1', { lineageId: 'lineage-A', targetRegistryAssetId: 'A',
      registryAssetId: 'A', status: 'published', publishedAt: '2026-01-01T00:00:00Z', revisionNumber: 1,
      sourcePayload: identityTemplate('original-A', '#00ff00') });
    const [item] = projectPipelineLibraryObjects(identityProgram([old], old.contributorId), identityCatalog());
    expect(item.submission.id).toBe('A1');
    expect(item.currentPublishedSubmission).toBeNull();
    expect(item.retirableSubmission).toBeNull();
    expect(item.template).toEqual(old.sourcePayload);
  });
});
