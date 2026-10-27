import { createRoot } from 'react-dom/client';
import { EnvironmentDesktopInspector, EnvironmentMobileSheet } from '@/features/app-shell/environment/components/EnvironmentDetail';
import { LibraryDetailVisual, LibraryVisual, type LibraryViewItem } from '@/features/storage-management/components/LibraryObjectPresentation';
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
createRoot(target).render(<>
  <div data-testid="material-tile" className={styles.visualSlot} style={{ width: 168.5 }}><LibraryVisual item={item} cards={[]} /></div>
  {innerWidth > 640 ? <div style={{ width: 368 }}><EnvironmentDesktopInspector {...props} /></div>
    : <EnvironmentMobileSheet {...props} open />}
</>);
