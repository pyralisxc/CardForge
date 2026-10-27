import { EnvironmentShell } from '@/features/app-shell/environment/components/EnvironmentShell';
import { ENVIRONMENT_ZONES } from '@/features/app-shell/environment/model';
import { createLibraryReviewAction } from '@/features/storage-management/components/LibraryObjectPresentation';
import { createRoot } from 'react-dom/client';
import { useRef, useState } from 'react';
import { OwnerContributorProgramPanel } from '@/features/pipeline/components/OwnerContributorProgramPanel';
import { LibraryRevisionEntry } from '@/features/storage-management/components/LibraryRevisionEntry';
import { EnvironmentToolLayer } from '@/features/app-shell/environment/components/EnvironmentToolLayer';
import { DEFAULT_PIPELINE_PROGRAM_SETTINGS, PIPELINE_TYPES, PIPELINE_STATUSES } from '@/features/pipeline/lib/pipelineItems';
import { createPipelineReviewTarget } from '@/features/pipeline/lib/pipelineReviewTarget';
import type { PipelineSubmission, PipelineProgramView } from '@/features/pipeline/lib/pipelineProgram';
const params = new URLSearchParams(location.search);
const row = { id: '10000000-0000-4000-8000-000000000001', lineageId: '20000000-0000-4000-8000-000000000001',
  registryAssetId: 'synthetic-material', targetRegistryAssetId: 'synthetic-material', revisionNumber: 1, baseRevisionNumber: null,
  contributorId: 'synthetic-owner', contributorDisplayName: 'Synthetic Owner', contributorEmail: null,
  assetType: 'elementPresets', requestedStudioDestination: 'style.material', semanticRole: 'material', specialtyTags: [], useCaseTags: [], compatibilityTags: [],
  visualFamily: null, variantKind: 'base', variantLabel: null, sourceNotes: 'Synthetic source-contained style.',
  name: 'Synthetic material revision one', description: 'Exact selected history', previewUrl: '', sourceUrl: null, sourcePayload: null,
  sourceStorageBucket: null, sourceStoragePath: null, sourceMimeType: null, sourceFileSizeBytes: 0,
  status: 'published', automatedStatus: 'published', calculatedAccessTier: 'free', automatedAccessTier: 'free', ownerStatusOverride: null,
  ownerAccessTierOverride: null, qualityScore: 100, tierDecisionReason: null, positiveVotes: 0, negativeVotes: 0, currentUserVote: null,
  editorialReviewStatus: 'approved', publishedAt: '2026-01-01T00:00:00Z', submittedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', purgeState: null,
} as PipelineSubmission;
const target = createPipelineReviewTarget(row)!;
if (params.has('published')) target.catalogPublication = { submissionId: row.id, updatedAt: 'registry-epoch' };
const newer = { ...row, id: '10000000-0000-4000-8000-000000000002', name: 'Newer revision must not replace selection', revisionNumber: 2 };
const rows = params.has('missing') ? [newer] : [newer, params.has('stale') ? { ...row, updatedAt: '2026-02-01T00:00:00Z' } : row];
const program = { configured: true, settings: DEFAULT_PIPELINE_PROGRAM_SETTINGS, submissions: rows, votingQueue: [],
  submissionPage: { page: 1, pageSize: 50, total: rows.length }, votingPage: { page: 1, pageSize: 50, total: 0 },
  submissionStatusCounts: Object.fromEntries(PIPELINE_STATUSES.map(status => [status, status === 'published' ? 2 : 0])),
  submissionTypeCounts: Object.fromEntries(PIPELINE_TYPES.map(type => [type, type === 'elementPresets' ? 2 : 0])),
  managedStorageBytes: 0, managedFileCount: 0, totalSubmissionCount: rows.length, totalVoteableCount: 0, activeContributorCount: 0,
  assetTypeSummaries: [], contributions: [], currentContributorIds: [],
} as unknown as PipelineProgramView;
const nativeFetch = window.fetch;
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if ((!init?.method || init.method === 'GET') && url === '/api/catalog') return Response.json({ pipeline: { items: [{ id: row.registryAssetId, lineageId: row.lineageId, submissionId: row.id, updatedAt: params.has('publicationChanged') ? 'new-registry-epoch' : 'registry-epoch' }] } });
  if ((!init?.method || init.method === 'GET') && url.startsWith('/api/pipeline?')) return Response.json({ program });
  if ((!init?.method || init.method === 'GET') && (url.startsWith('/api/owner/pipeline/style-revisions?') || url.startsWith('/api/owner/pipeline/template-revisions?'))) return Response.json({
    expectedBase: { assetId: row.registryAssetId, lineageId: row.lineageId, parentSubmissionId: params.has('historical') ? newer.id : row.id,
      baseRevisionNumber: params.has('historical') ? 2 : 1, revisionHighWater: 2, parentContentVersion: 'a'.repeat(32), registryContentVersion: 'b'.repeat(32) },
    template: { id: row.registryAssetId, name: 'Synthetic Template', aspectRatio: '63:88', freeformCanvas: { width: 630, height: 880, elements: [] }, templateLineageId: row.lineageId, templateRevision: 1 },
    style: { id: row.registryAssetId, kind: 'material', name: row.name, targets: ['shape'], appearance: { material: { baseColor: '#ebd39f' } } },
  });
  return nativeFetch(input, init);
};
function Proof() {
  const [mode, setMode] = useState<'review' | 'global' | 'revise' | null>(params.has('template') ? 'revise' : null);
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false); const [confirm, setConfirm] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const close = () => { setMode(null); setDirty(false); setConfirm(false); requestAnimationFrame(() => trigger.current?.focus()); };
  return <EnvironmentShell ariaLabel="Isolated Library composition proof" brand={{ src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E', alt: 'Fixture' }}
    viewer={{ owner: true, signedIn: true, contributor: true }} zones={ENVIRONMENT_ZONES.filter(zone => zone.id === 'library')} activeZone="library" viewportPolicy="desk" primaryScroll="contained"
    presentation={{ mode: mode ? 'task' : 'browse', focusDepth: 'zone' }} detail={null}
    actionContext={{ kind: 'pipeline-asset', actionSources: [{ id: row.id, label: 'Selected revision', source: 'provider-native', currentRevisionAvailable: true }] }}
    actions={[createLibraryReviewAction()]} statusContent="Synthetic revision 1" footerContent={null} onCommand={() => {}} onCloseDetail={() => {}}
    onAction={() => { trigger.current = document.activeElement as HTMLElement; setMode('review'); }}>
    <h1>Isolated Library composition proof</h1><input aria-label="Library search" defaultValue="material" />
    <button onClick={() => { trigger.current = document.activeElement as HTMLElement; setMode('global'); }}>Pipeline operations</button>
    {mode ? <EnvironmentToolLayer id="library-context-proof" presentation={mode === 'global' ? 'inline' : 'sheet'} title={mode === 'global' ? 'Pipeline operations' : 'Review & manage'} eyebrow="Library" summary="Synthetic selected revision 1" closeLabel="Close Pipeline tool" onClose={close} dirty={dirty} onDirtyCloseRequest={() => setConfirm(true)}><div className="w-full min-w-0 overflow-auto">
      {draft ? <pre data-testid="local-template-draft">{draft}</pre> : null}{confirm ? <div role="alertdialog" aria-label="Unsaved changes"><p>Discard changes?</p><button onClick={() => setConfirm(false)}>Keep editing</button><button onClick={close}>Discard changes</button></div> : null}
      {mode === 'revise' ? <LibraryRevisionEntry target={target} kind={params.has('template') ? 'templates' : 'elementPresets'} onDirtyChange={setDirty} onTemplateDraft={value => setDraft(JSON.stringify(value))} /> : <OwnerContributorProgramPanel target={mode === 'global' ? undefined : target} onDirtyChange={setDirty} onRevise={() => setMode('revise')} renderTemplateSpecimen={async () => { throw new Error('No Template specimen requested in this style fixture'); }} />}
    </div></EnvironmentToolLayer> : null}</EnvironmentShell>;
}
const mount = document.createElement('div'); document.body.append(mount); createRoot(mount).render(<Proof />);
