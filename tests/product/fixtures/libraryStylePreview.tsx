import { useState, useRef, type ComponentProps } from 'react';
import { createSelectionSession, openEnvironmentDetail, closeEnvironmentDetail } from '@/features/app-shell/client/environment';
import { LibraryCollection } from '@/features/storage-management/components/LibraryCollection';
import { useUnifiedLibraryView } from '@/features/storage-management/hooks/useUnifiedLibraryView';
import { projectPipelineLibraryObjects } from '@/features/storage-management/hooks/useLibrarySharedProjection';
import { DEFAULT_PIPELINE_PROGRAM_SETTINGS } from '@/features/pipeline/lib/pipelineItems';
import { type PipelineSubmission, type CardForgeCatalogManifest } from '@/features/pipeline/client';
import { createRoot } from 'react-dom/client';
import { EnvironmentDesktopInspector, EnvironmentMobileSheet } from '@/features/app-shell/environment/components/EnvironmentDetail';
import { createLibraryDetailRecord, LibraryDetailVisual, LibraryVisual, type LibraryViewItem } from '@/features/storage-management/components/LibraryObjectPresentation';
import styles from '@/features/storage-management/components/UnifiedAccountLibrary.module.css';

// Synthetic source-contained material: no catalog reads, image requests or writes.
const item = {
  id: 'synthetic-material', scope: 'published', name: 'Synthetic parchment', kindLabel: 'Material',
  sourceLabel: 'Fixture', statusLabel: 'Published', summary: 'Local material layout proof',
  updatedAt: null, sizeBytes: null, previewUrl: null, fontFamily: null,
  published: { kind: 'elementPreset', template: null, style: {
    id: 'synthetic-material', name: 'Synthetic parchment', kind: 'material', targets: ['shape'],
    appearance: { material: { baseColor: '#ebd39f' }, border: { kind: 'relic', color: '#5a3410', width: 4, radius: 6, innerWidth: 1, secondaryColor: '#d5ad54' } },
  } },
} as LibraryViewItem;
const record = { id: item.id, kind: 'style', eyebrow: 'Material', title: item.name,
  summary: item.summary, status: 'Published', tone: 'success' as const, actionSources: [], meta: [] };
const target = document.createElement('div'); document.body.append(target);
const props = { record, actions: [], visual: <LibraryDetailVisual item={item} cards={[]} />, onClose: () => {}, onAction: () => {} };
const materialProof = <>
  <div data-testid="material-tile" className={styles.visualSlot} style={{ width: 168.5 }}><LibraryVisual item={item} cards={[]} /></div>
  {innerWidth > 640 ? <div style={{ width: 368 }}><EnvironmentDesktopInspector {...props} /></div>
    : <EnvironmentMobileSheet {...props} open />}
</>;


// Distinct native IDs with identical labels; no provider reads or content actions.
const sharedName = 'Gilded Filigree';
const style = { id: 'style-gilded', name: sharedName, kind: 'material', targets: ['shape'], appearance: { material: { baseColor: '#ffd700' } } };
const catalog = {
  templates: { defaults: [], userTemplates: [] }, styles: { version: 1, styles: [style] },
  assets: { templates: [], imageAssets: [], textures: [], icons: [],
    dividers: [{ id: 'svg-gilded', name: sharedName, kind: 'divider', url: '/synthetic-divider.svg' }],
    elementPresets: [{ id: style.id, name: sharedName, kind: 'elementPreset', url: '/api/styles#style-gilded' }] },
  fonts: { fonts: [] }, sets: { items: [] },
  pipeline: { items: [{ id: 'svg-gilded', submissionId: 'divider-r2' }, { id: style.id, submissionId: 'style-r1' }] },
} as unknown as CardForgeCatalogManifest;
const rows = [
  { id: 'divider-r2', assetType: 'dividers', targetRegistryAssetId: 'svg-gilded', status: 'published', previewUrl: '/synthetic-divider.svg', revisionNumber: 2 },
  { id: 'style-r1', assetType: 'elementPresets', targetRegistryAssetId: style.id, status: 'published', previewUrl: '/api/styles#style-gilded', revisionNumber: 1 },
  { id: 'missing-svg', assetType: 'dividers', targetRegistryAssetId: 'missing-svg', status: 'archived', previewUrl: '/missing.svg', revisionNumber: 1 },
  { id: 'historical-svg', assetType: 'dividers', targetRegistryAssetId: 'svg-gilded', status: 'archived', previewUrl: '/historical.svg', revisionNumber: 1 },
].map(row => ({ name: sharedName, contributorId: 'fixture', contributorDisplayName: 'Fixture', sourcePayload: null, sourceMimeType: 'image/svg+xml',
  specialtyTags: [], useCaseTags: [], compatibilityTags: [], positiveVotes: 0, negativeVotes: 0, currentUserVote: null, description: row.id, submittedAt: '2026-10-27T00:00:00Z', updatedAt: '2026-10-27T00:00:00Z', ...row })) as unknown as PipelineSubmission[];
function CollisionProof() {
  const [selection, setSelection] = useState(createSelectionSession);
  const searchRef = useRef<HTMLInputElement>(null);
  const [historical, setHistorical] = useState(false);
  const program = { submissions: [], votingQueue: historical ? [rows[3]] : rows.slice(0, 3), currentContributorIds: [], settings: DEFAULT_PIPELINE_PROGRAM_SETTINGS };
  const projection = { visibleItems: [], query: '', sort: 'name', setQuery: () => {}, setSort: () => {} } as unknown as Parameters<typeof useUnifiedLibraryView>[0]['projection'];
  const shared = { catalog, program, publishedItems: [], pipelineItems: projectPipelineLibraryObjects(program, catalog), catalogFailure: null, pipelineFailure: null } as unknown as Parameters<typeof useUnifiedLibraryView>[0]['shared'];
  const view = useUnifiedLibraryView({ activeScope: 'pipeline', pipelineAccess: true, projection, shared, sharedType: 'all' });
  const selected = selection.objectId ? view.itemMap.get(selection.objectId) : null;
  const noop = () => {};
  const collection = { ...view, activeScope: 'pipeline', activeFailure: null, activeLoading: false, projection, selection, density: 'gallery', scopeDefinition: { label: 'Pipeline', description: 'Synthetic same-name assets' }, searchRef,
    sharedType: 'all', cardsFor: () => [], templateFor: () => null, heartMetrics: {}, publishedRevisionByLineage: new Map(), personalActions: () => [],
    onOpenDetail: (value: LibraryViewItem) => setSelection(current => openEnvironmentDetail(current, { objectId: value.id, listOffset: 0, focusReturnId: `library-object-${value.id}` })),
    onSharedTypeChange: noop, onDensityChange: noop, onRefresh: noop, onToggleHeart: noop, onVote: noop,
  } as unknown as ComponentProps<typeof LibraryCollection>;
  const detail = selected ? { record: createLibraryDetailRecord(selected), actions: [], visual: <LibraryDetailVisual item={selected} cards={[]} />,
    onClose: () => setSelection(closeEnvironmentDetail), onAction: noop } : null;
  return <><button onClick={() => { setHistorical(value => !value); setSelection(closeEnvironmentDetail); }}>Toggle historical-only projection</button>
    <LibraryCollection {...collection} />
    <output data-testid="selected-identity">{selected?.id}</output>
    {detail ? innerWidth > 640 ? <div style={{ width: 368 }}><EnvironmentDesktopInspector {...detail} /></div> : <EnvironmentMobileSheet {...detail} open /> : null}
  </>;
}
createRoot(target).render(location.search.includes('collision') ? <CollisionProof /> : materialProof);
