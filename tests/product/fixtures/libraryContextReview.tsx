import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { Desk } from '@/features/desk/components/Desk';
import { EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE } from '@/features/contributor-access/client';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { UnifiedAccountLibrary } from '@/features/storage-management/components/UnifiedAccountLibrary';
import type { AccountExperienceProjection } from '@/features/account/client/experience';
import { identityCatalog, identityTemplate } from './libraryTemplateIdentityData';
import { LibraryCollection } from '@/features/storage-management/components/LibraryCollection';
import { LibraryRevisionQueueControls } from '@/features/storage-management/components/LibraryRevisionQueueControls';
import { useLibraryRevisionQueue } from '@/features/storage-management/hooks/useLibraryRevisionQueue';
import { useUnifiedLibraryView } from '@/features/storage-management/hooks/useUnifiedLibraryView';
import { projectPipelineLibraryObjects } from '@/features/storage-management/hooks/useLibrarySharedProjection';
import { libraryReviewSelection } from '@/features/storage-management/lib/libraryReviewSelection';
import { createSelectionSession } from '@/features/app-shell/client/environment';
import type { PipelineReviewTarget } from '@/features/pipeline/lib/pipelineReviewTarget';
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
  assetType: params.has('media') ? 'textures' : 'elementPresets', requestedStudioDestination: 'style.material', semanticRole: 'material', specialtyTags: [], useCaseTags: [], compatibilityTags: [],
  visualFamily: null, variantKind: 'base', variantLabel: null, sourceNotes: 'Synthetic source-contained style.',
  name: 'Synthetic material revision one', description: 'Exact selected history', previewUrl: '', sourceUrl: null, sourcePayload: null,
  sourceStorageBucket: null, sourceStoragePath: null, sourceMimeType: null, sourceFileSizeBytes: 0,
  status: 'published', automatedStatus: 'published', calculatedAccessTier: 'free', automatedAccessTier: 'free', ownerStatusOverride: null,
  ownerAccessTierOverride: null, qualityScore: 100, tierDecisionReason: null, positiveVotes: 0, negativeVotes: 0, currentUserVote: null,
  editorialReviewStatus: 'approved', publishedAt: '2026-01-01T00:00:00Z', submittedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', purgeState: null,
} as PipelineSubmission;
if (params.has('upload')) Object.assign(row, { registryAssetId: null, targetRegistryAssetId: null, revisionNumber: null,
  assetType: 'dividers', status: 'voting', automatedStatus: 'voting', publishedAt: null, editorialReviewStatus: 'pending', name: 'Synthetic fresh SVG upload' });
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
const proof = window as typeof window & { libraryRequests: { url: string; method: string; body?: string }[]; releaseStylePost?: () => void };
proof.libraryRequests = [];
const receipt = { id: '30000000-0000-4000-8000-000000000001', assetId: row.registryAssetId, revisionNumber: 2, status: 'submitted', editorialReviewStatus: 'pending', requestFingerprint: 'synthetic-fingerprint' };
let stylePosts = 0;
const queueCatalog: ReturnType<typeof identityCatalog> = { ...identityCatalog(), pipeline: { items: [] } };
const queueRows = Array.from({ length: 15 }, (_, index) => ({ ...row,
  id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  lineageId: index < 2 ? row.lineageId : `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  registryAssetId: index < 2 ? row.registryAssetId : `synthetic-material-${index + 1}`, targetRegistryAssetId: index < 2 ? row.registryAssetId : `synthetic-material-${index + 1}`,
  name: index < 2 ? 'Shared material' : `Material ${index + 1}`,
  description: index === 1 ? 'Pending emerald correction' : 'Published gold specimen',
  contributorDisplayName: index === 1 ? 'Candidate Author' : 'Original Author',
  status: index === 1 ? 'publish_candidate' : 'published', revisionNumber: index === 1 ? 3 : 2,
  sourcePayload: { id: row.registryAssetId, name: row.name, kind: 'material', targets: ['shape'], appearance: { material: { baseColor: index === 1 ? '#00cc88' : '#d5ad54' } } },
} as PipelineSubmission));
if (params.has('historyTemplate')) {
  const current = { ...identityTemplate('synthetic-material', '#0000ff'), name: 'Current blue Template', templateRevision: 2 };
  const historical = { ...identityTemplate('synthetic-material', '#00ff00'), name: 'Historical green Template', templateRevision: 1 };
  Object.assign(queueRows[0], { assetType: 'templates', name: 'Current blue Template', revisionNumber: 2,
    previewUrl: '/api/templates#synthetic-material', sourcePayload: current });
  Object.assign(queueRows[14], { assetType: 'templates', name: 'Historical green Template', revisionNumber: 1,
    lineageId: row.lineageId, registryAssetId: 'synthetic-material', targetRegistryAssetId: 'synthetic-material',
    previewUrl: '/api/templates#synthetic-material', sourcePayload: params.has('missingHistory') ? null : historical });
  queueCatalog.templates.defaults = [current];
  queueCatalog.pipeline = { items: [{ id: 'synthetic-material', name: current.name, assetType: 'template',
    submissionId: queueRows[0].id, lineageId: row.lineageId ?? null, updatedAt: 'registry-epoch',
    previewUrl: null, access: 'free', source: 'official', fileSizeBytes: null }] };
}
const nativeFetch = window.fetch;
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (params.has('deskActual') && (!init?.method || init.method === 'GET')) {
    if (url === '/api/pipeline/my-published') return Response.json({submissions:[row]});
    if (url === '/api/catalog/studio-bootstrap') return Response.json({...queueCatalog,studioDefaults:{defaultTemplateId:null}});
    if (url !== '/api/catalog' && !url.startsWith('/api/pipeline?') && !url.startsWith('/api/owner/pipeline/')) return Response.json({error:{code:'fixture_unavailable',kind:'unavailable',message:'Provider excluded from isolated Desk proof',retryable:false}},{status:503});
  }
  if (params.has('queueActual') && (!init?.method || init.method === 'GET')) {
    if (url === '/api/catalog/studio-bootstrap') return Response.json({ ...queueCatalog, studioDefaults: { defaultTemplateId: null } });
    if (url === '/api/catalog') {
      if (params.has('catalogFailure')) return Response.json({ error: { code: 'catalog_unavailable', kind: 'unavailable', message: 'Catalog unavailable', retryable: true } }, { status: 503 });
      if (params.has('catalogMissing') || params.has('catalogLoading')) return new Promise<Response>(() => {});
      return Response.json(queueCatalog);
    }
    if (url === '/api/pipeline/library') return Response.json({ program: { ...program, submissions: queueRows } });
    if (url.startsWith('/api/pipeline/hearts?')) return Response.json({ metrics: [] });
    if (!url.startsWith('/api/pipeline?')) return Response.json({ error: { code: 'fixture_unavailable', kind: 'unavailable', message: 'Provider excluded from isolated Library proof', retryable: false } }, { status: 503 });
  }
  if (params.has('submit') && url.startsWith('/api/owner/pipeline/style-revisions')) {
    proof.libraryRequests.push({ url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined });
    if (init?.method === 'POST') {
      stylePosts += 1;
      if (params.get('submit') === 'busy') await new Promise<void>(resolve => { proof.releaseStylePost = resolve; });
      if (params.get('submit')?.startsWith('uncertain') && stylePosts === 1) return Response.json({ error: { code: 'style_library_unavailable', kind: 'unavailable', message: 'The submission may have succeeded; retain this attempt.', retryable: true } }, { status: 503 });
      return Response.json(receipt);
    }
    if (url.includes('submissionKey=')) return Response.json({ receipt: params.get('submit') === 'uncertainRetry' && stylePosts === 1 ? null : receipt });
  }
  if (url.startsWith('/api/owner/pipeline/media-revisions?')) return Response.json({ assetId: row.registryAssetId, name: row.name, sourceUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E', presentation: {
    schemaVersion: 1, parentSubmissionId: params.has('mediaStale') ? newer.id : row.id, lineageId: row.lineageId, baseRevisionNumber: params.has('mediaStale') ? 2 : 1,
    baseVersion: 'a'.repeat(32), registryVersion: 'b'.repeat(32), intendedAccessTier: 'free', sourceSha256: 'c'.repeat(64), baseline: { tileMode: 'repeat', seamless: false }, proposed: { tileMode: 'repeat', seamless: false },
  } });
  if ((!init?.method || init.method === 'GET') && url === '/api/catalog') return Response.json({ pipeline: { items: [{ id: row.registryAssetId, lineageId: row.lineageId, submissionId: row.id, updatedAt: params.has('publicationChanged') ? 'new-registry-epoch' : 'registry-epoch' }] } });
  if ((!init?.method || init.method === 'GET') && url.startsWith('/api/pipeline?')) {
    if (params.has('queue') || params.has('queueActual')) {
      proof.libraryRequests.push({ url, method: 'GET' });
      const filters = new URL(url, location.origin).searchParams;
      const query = (filters.get('query') ?? '').toLowerCase();
      const filtered = queueRows.filter(row => (!filters.get('assetType') || filters.get('assetType') === 'all' || row.assetType === filters.get('assetType'))
        && (!filters.get('status') || filters.get('status') === 'all' || row.status === filters.get('status'))
        && [row.name, row.description, row.contributorDisplayName, row.registryAssetId].join(' ').toLowerCase().includes(query));
      const page = Number(filters.get('page') ?? 1); const pageSize = Number(filters.get('pageSize') ?? 12);
      return Response.json({ program: { ...program, submissions: filtered.slice((page - 1) * pageSize, page * pageSize),
        submissionPage: { total: filtered.length, page, pageSize } } });
    }
    return Response.json({ program });
  }
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
  const [closeBlocked, setCloseBlocked] = useState<string | null>(null);
  const [blockedNotice, setBlockedNotice] = useState(false);
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
    <h1>Isolated Library composition proof</h1><button onClick={() => { close(); }}>Leave Library</button><input aria-label="Library search" defaultValue="material" />
    <button onClick={() => { trigger.current = document.activeElement as HTMLElement; setMode('global'); }}>Pipeline operations</button>
    {mode ? <EnvironmentToolLayer id="library-context-proof" presentation={mode === 'global' ? 'inline' : 'sheet'} title={mode === 'global' ? 'Pipeline operations' : 'Review & manage'} eyebrow="Library" summary="Synthetic selected revision 1" closeLabel="Close Pipeline tool" onClose={close} dirty={dirty} closeBlocked={Boolean(closeBlocked)} onDirtyCloseRequest={() => { if (closeBlocked) setBlockedNotice(true); else setConfirm(true); }}><div className="w-full min-w-0 overflow-auto">
      {blockedNotice && closeBlocked ? <p role="status">{closeBlocked}</p> : null}{draft ? <pre data-testid="local-template-draft">{draft}</pre> : null}{confirm ? <div role="alertdialog" aria-label="Unsaved changes"><p>Discard changes?</p><button onClick={() => setConfirm(false)}>Keep editing</button><button onClick={close}>Discard changes</button></div> : null}
      {mode === 'revise' ? <LibraryRevisionEntry target={target} kind={params.has('template') ? 'templates' : 'elementPresets'} onDirtyChange={setDirty} onCloseBlockedChange={setCloseBlocked} onTemplateDraft={value => setDraft(JSON.stringify(value))} /> : <OwnerContributorProgramPanel target={mode === 'global' ? undefined : target} onDirtyChange={setDirty} onRevise={() => setMode('revise')} renderTemplateSpecimen={async () => { throw new Error('No Template specimen requested in this style fixture'); }} />}
    </div></EnvironmentToolLayer> : null}</EnvironmentShell>;
}
function QueueProof() {
  const [revisions, setRevisions] = useState(false); const [query, setQuery] = useState('');
  const [target, setTarget] = useState<PipelineReviewTarget | undefined>();
  const [dirty, setDirty] = useState(false); const [confirm, setConfirm] = useState(false);
  const trigger = useRef<HTMLElement | null>(null); const searchRef = useRef<HTMLInputElement>(null);
  const owner = !params.has('contributor') && !params.has('signedOut');
  const queue = useLibraryRevisionQueue({ enabled: owner && revisions, query, catalog: params.has('catalogMissing') ? null : queueCatalog, catalogLoading: params.has('catalogLoading'), catalogFailure: params.has('catalogFailure') ? { message: 'Catalog unavailable', retryable: true, kind: 'unavailable', code: 'catalog_unavailable', correlationId: null } : null });
  const shared = { publishedItems: [], pipelineItems: projectPipelineLibraryObjects({ ...program, submissions: queueRows }, null), program };
  const projection = { query, setQuery, sort: 'recent', setSort: () => {}, items: [], visibleItems: [], failures: [], isLoading: false };
  const view = useUnifiedLibraryView({ activeScope: 'pipeline', pipelineAccess: true, projection: projection as never, shared: shared as never, sharedType: 'all', revisionPage: owner && revisions ? queue : undefined });
  const close = () => { setTarget(undefined); setDirty(false); setConfirm(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); };
  return <main style={{ padding: 12 }}>
    {owner ? <LibraryRevisionQueueControls revisions={revisions} queue={queue} onModeChange={setRevisions} /> : null}
    <LibraryCollection {...view} serverFiltered={revisions} activeScope="pipeline" campaignTargetId={null} canReview={false} canSubmit={false}
      cardsFor={() => []} density="gallery" heartMetrics={{}} heartMetricsFailed={true} heartMetricsLoading={false} heartingId={null}
      isSignedIn={!params.has('signedOut')} isOwner={owner} isSelfVoteBlocked={() => true} onDensityChange={() => {}}
      onOpenContribution={() => {}} onOpenDetail={item => { if (!owner) return; trigger.current = document.activeElement as HTMLElement; setTarget(libraryReviewSelection(item, queueRows) ?? undefined); }}
      onPersonalAction={() => {}} onPublishedAction={() => {}} onRefresh={queue.refresh} onToggleHeart={() => {}} onVote={() => {}}
      personalActions={() => []} publishedRevisionByLineage={new Map()} projection={projection as never} scopeDefinition={{ label: 'Pipeline', description: 'Synthetic Library revision queue' }}
      searchRef={searchRef} selection={createSelectionSession()} sharedType="all" sharedTypes={[]} templateFor={() => null} votingId={null} onSharedTypeChange={() => {}} />
    {target ? <EnvironmentToolLayer id="queue-review" title="Review & manage" eyebrow="Library" summary="Exact selected revision" closeLabel="Close revision review" presentation="sheet" onClose={close} dirty={dirty} onDirtyCloseRequest={() => setConfirm(true)}>
      {confirm ? <div role="alertdialog"><button onClick={() => setConfirm(false)}>Keep editing</button><button onClick={close}>Discard changes</button></div> : null}
      <OwnerContributorProgramPanel target={target} onDirtyChange={setDirty} renderTemplateSpecimen={async () => { throw new Error('Not a Template fixture'); }} />
    </EnvironmentToolLayer> : null}
  </main>;
}
const mount = document.createElement('div'); document.body.append(mount); const fixtureRouter = { bfcacheId: 'isolated-library', back: () => history.back(), forward: () => history.forward(), refresh: () => {}, push: () => {}, replace: () => {}, prefetch: async () => {} };
createRoot(mount).render(params.has('deskActual') ? <AppRouterContext.Provider value={fixtureRouter}><SearchParamsContext.Provider value={params}><Desk businessIdentity={{} as never} persistenceScope="account:isolated-desk-proof" initialFocusedWorkId={`pipeline:${row.lineageId}`} initialContributorAccess={EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE} experience={{signedIn:true,owner:true,plan:'designer',capabilities:{canUseProjectFiles:false},contributor:{active:true,canSubmit:true,canReview:true,canPublish:true,canDraftCampaigns:false}} as AccountExperienceProjection} /></SearchParamsContext.Provider></AppRouterContext.Provider> : params.has('queueActual') ? <AppRouterContext.Provider value={fixtureRouter}><UnifiedAccountLibrary
  experience={{ signedIn: true, owner: true, plan: 'designer', capabilities: { canUseProjectFiles: false }, contributor: { active: true, canSubmit: true, canReview: true, canPublish: true, canDraftCampaigns: false } } as AccountExperienceProjection}
  businessIdentity={{} as never} persistenceScope="account:isolated-library-fixture" />
</AppRouterContext.Provider> : params.has('queue') ? <QueueProof /> : <Proof />);
