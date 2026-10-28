import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { EnvironmentDesktopInspector, EnvironmentMobileSheet } from '@/features/app-shell/environment/components/EnvironmentDetail';
import { LibraryDetailVisual, LibraryVisual, createLibraryDetailRecord, type LibraryViewItem } from '@/features/storage-management/components/LibraryObjectPresentation';
import { projectPipelineLibraryObjects, projectPublishedLibraryObjects } from '@/features/storage-management/hooks/useLibrarySharedProjection';
import { useUnifiedLibraryView } from '@/features/storage-management/hooks/useUnifiedLibraryView';
import styles from '@/features/storage-management/components/UnifiedAccountLibrary.module.css';
import { identityCatalog, identityProgram, identitySubmission, identityTemplate, mixedAuthorRows } from './libraryTemplateIdentityData';

function Proof() {
  const [selection, select] = useState('A');
  const [open, setOpen] = useState(false);
  const [viewer, setViewer] = useState('C');
  const catalog = identityCatalog();
  const row = identitySubmission('A1', { name: 'Same name', lineageId: 'lineage-A', targetRegistryAssetId: 'A', status: 'archived',
    sourcePayload: selection === 'history' ? identityTemplate('original-A', '#00ff00') : null });
  const pipelineItems = projectPipelineLibraryObjects(identityProgram(selection === 'mixed' ? mixedAuthorRows() : [row], viewer), catalog);
  const view = useUnifiedLibraryView({ activeScope: 'pipeline', pipelineAccess: true, sharedType: 'all',
    projection: { items: [], visibleItems: [], query: '', sort: 'name', failures: [], isLoading: false } as never,
    shared: { pipelineItems, publishedItems: [] } as never });
  const published = projectPublishedLibraryObjects(catalog).find(item => item.id === `published:template:${selection}`);
  const item: LibraryViewItem = published ? {
    id: published.id, scope: 'published', name: published.name, kindLabel: published.kindLabel, sourceLabel: published.sourceLabel,
    statusLabel: published.accessLabel, summary: published.description, updatedAt: null, sizeBytes: null,
    previewUrl: published.previewUrl, fontFamily: null, published,
  } : selection === 'fork' ? {
    id: 'personal-fork', scope: 'personal', name: 'Same name', kindLabel: 'Template', sourceLabel: 'This device', statusLabel: 'Available',
    summary: 'Independent authored copy', updatedAt: null, sizeBytes: null, previewUrl: null, fontFamily: null,
    personal: { id: 'personal-fork', kind: 'template', name: 'Same name', locations: [{ source: 'device', status: 'available', label: 'This device' }], details: [], sizeBytes: null, revision: null, updatedAt: null, expiresAt: null, webViewLink: null, references: { localTemplateId: 'personal-fork' }, organization: { workflow: 'template', type: null, tags: [], source: 'none', publicationState: 'working' } } as never,
  } : view.viewItems[0];
  const template = selection === 'fork' ? identityTemplate('personal-fork', '#ffff00') : null;
  const record = createLibraryDetailRecord(item);
  const props = { record, actions: [], visual: <LibraryDetailVisual item={item} cards={[]} template={template} />, onClose: () => setOpen(false), onAction: () => {} };
  return <>
    <nav style={{ position: 'relative', zIndex: 100, background: 'white', padding: 8 }}>
      {['A', 'B', 'history', 'missing', 'missing-history', 'fork', 'mixed'].map(value => <button key={value} onClick={() => select(value)}>Select {value}</button>)}
      {['A', 'B', 'C'].map(value => <button key={value} onClick={() => setViewer(value)}>Viewer {value}</button>)}
    </nav>
    <button onClick={() => setOpen(true)}>Open Details</button>
    <p data-testid="source-label">{item.sourceLabel}</p>
    <div data-testid="template-tile" className={styles.visualSlot} style={{ width: 168.5 }}><LibraryVisual item={item} cards={[]} template={template} /></div>
    {innerWidth > 640 ? (open ? <div style={{ width: 368 }}><EnvironmentDesktopInspector {...props} /></div> : null) : <EnvironmentMobileSheet {...props} open={open} />}
  </>;
}
const target = document.createElement('main'); document.body.append(target); createRoot(target).render(<Proof />);
