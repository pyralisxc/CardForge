import type { TCGCardTemplate } from '@/domain/templates';
import type { PipelineSubmission } from '@/features/pipeline/lib/pipelineProgram';
import type { CardForgeCatalogManifest } from '@/features/pipeline/lib/catalogManifest';
import { DEFAULT_PIPELINE_PROGRAM_SETTINGS } from '@/features/pipeline/lib/pipelineItems';
export const identitySubmission = (
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

export const identityTemplate = (id: string, color: string): TCGCardTemplate => ({
  id, name: 'Same name', aspectRatio: '63:88', baseBackgroundColor: color,
  freeformCanvas: { width: 630, height: 880, elements: [] },
} as TCGCardTemplate);
export function identityCatalog() {
  return {
    templates: { defaults: [identityTemplate('A', '#ff0000'), identityTemplate('B', '#0000ff')], userTemplates: [] },
    styles: { styles: [] }, fonts: { fonts: [] }, sets: { items: [] },
    assets: { templates: ['A', 'B', 'missing'].map(id => ({ id, kind: 'template', name: 'Same name', url: '/api/templates#'+id })),
      textures: [], dividers: [], icons: [], imageAssets: [], elementPresets: [] },
    pipeline: { items: [{ id: 'A', lineageId: 'lineage-A', submissionId: 'A2', updatedAt: 'epoch' },
      { id: 'B', lineageId: 'lineage-B', submissionId: 'B1', updatedAt: 'epoch' }] },
  } as unknown as CardForgeCatalogManifest;
}
export const identityProgram = (rows: PipelineSubmission[], viewer = 'C') => ({
  submissions: rows, votingQueue: [], currentContributorIds: [viewer], settings: DEFAULT_PIPELINE_PROGRAM_SETTINGS,
});
export const mixedAuthorRows = () => [
  identitySubmission('A2', { contributorId: 'A', contributorDisplayName: 'Author A', lineageId: 'lineage-A', targetRegistryAssetId: 'A',
    name: 'Same name', status: 'published', revisionNumber: 1, sourcePayload: identityTemplate('A', '#ff0000') }),
  identitySubmission('candidate-B', { contributorId: 'B', contributorDisplayName: 'Author B', lineageId: 'lineage-A', targetRegistryAssetId: 'A',
    name: 'Same name', status: 'voting', revisionNumber: 2, sourcePayload: identityTemplate('A', '#00ff00') }),
];
