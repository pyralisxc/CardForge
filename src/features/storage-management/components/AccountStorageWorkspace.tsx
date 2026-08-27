"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { FolderOpen, HardDrive, Images, Laptop, Sparkles, X, type LucideIcon } from 'lucide-react';

import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import {
  CompactSettingRow,
  EnvironmentSectionHeading,
  type EnvironmentSettingRecord,
} from '@/features/app-shell/client/environment';

type AccountStorageLibraryFocus = 'device' | 'drafts';

interface StorageToolLocation extends EnvironmentSettingRecord {
  content: ReactNode;
  focus?: AccountStorageLibraryFocus;
  icon: LucideIcon;
}

export interface LibraryStorageConnectionsToolProps {
  workspaceStorage: ReactNode;
  connectedAssets: ReactNode;
  googleDriveProjects: ReactNode;
  localProjectFolder: ReactNode;
}

const focusedStorageContent = (node: ReactNode, focus: AccountStorageLibraryFocus): ReactNode => (
  isValidElement(node)
    ? cloneElement(node as ReactElement<{ focus?: AccountStorageLibraryFocus }>, { focus })
    : node
);

const selectedContentClass = 'account-storage-detail [&>div]:m-0 [&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0 [&>section]:m-0 [&>section]:max-w-none [&>section]:border-0 [&>section]:bg-transparent [&>section]:p-0 [&>section>div]:border-0 [&>section>div]:bg-transparent [&>section>div]:p-0';

function StorageToolDetail({ location, onClose }: { location: StorageToolLocation; onClose: () => void }) {
  return (
    <div id="environment-detail-panel" className="min-w-0">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--cf-border)] pb-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">{location.eyebrow}</p>
          <h3 className="mt-1 font-serif text-xl text-[var(--cf-text-strong)]">{location.title}</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--cf-text-muted)]">{location.summary}</p>
        </div>
        <button type="button" className="grid h-11 w-11 shrink-0 place-items-center border border-[var(--cf-border-subtle)] text-[var(--cf-text-muted)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]" aria-label={`Close ${location.title}`} onClick={onClose}><X className="h-4 w-4" /></button>
      </div>
      <div className={`pt-3 ${selectedContentClass}`}>{location.content}</div>
    </div>
  );
}

export function LibraryStorageConnectionsTool({
  workspaceStorage,
  connectedAssets,
  googleDriveProjects,
  localProjectFolder,
}: LibraryStorageConnectionsToolProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setMobileDetail(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const locations = useMemo<StorageToolLocation[]>(() => [
    {
      id: 'browser-workspace', kind: 'storage-location', eyebrow: 'Browser-owned', title: 'This device',
      summary: 'Local Sets, cards, Templates, artwork, quota health, portable estimates, and device-only removal.',
      status: 'Available in this browser', tone: 'success', value: 'Browser workspace', icon: Laptop,
      actionSources: [{ id: 'storage:browser-workspace', label: 'This device', source: 'browser-local', currentRevisionAvailable: true }],
      meta: [['Ownership', 'This browser'], ['Removal', 'Only the named local Set and its local cards']],
      focus: 'device', content: focusedStorageContent(workspaceStorage, 'device'),
    },
    {
      id: 'working-drafts', kind: 'storage-location', eyebrow: 'Temporary work', title: 'Working drafts',
      summary: 'Private AI and Studio working documents, exact revisions, retention, recoverable trash, and restore.',
      status: 'Retention-managed', tone: 'warning', value: 'Private drafts', icon: Sparkles,
      actionSources: [{ id: 'storage:working-drafts', label: 'Temporary workspace', source: 'temporary', currentRevisionAvailable: true }],
      meta: [['Ownership', 'Signed-in CardForge account'], ['Removal', 'Recoverable for 24 hours before purge']],
      focus: 'drafts', content: focusedStorageContent(workspaceStorage, 'drafts'),
    },
    {
      id: 'local-project-folder', kind: 'storage-location', eyebrow: 'Portable project ownership', title: 'Local project folder',
      summary: 'Attach, save, reopen, reconnect, or detach a browser-authorized .cardforge project folder.',
      status: 'Browser permission', tone: 'neutral', value: 'User-owned files', icon: FolderOpen,
      actionSources: [{ id: 'storage:local-project-folder', label: 'Local folder', source: 'local-folder', currentRevisionAvailable: true }],
      meta: [['Ownership', 'Your filesystem'], ['Permission', 'Granted and remembered by this browser']],
      content: localProjectFolder,
    },
    {
      id: 'google-drive-projects', kind: 'storage-location', eyebrow: 'Portable project ownership', title: 'Google Drive projects',
      summary: 'Provider connection health, selected folder, exact revisions, project saves, checkout, and provider deletion.',
      status: 'Provider-owned', tone: 'neutral', value: 'Google Drive', icon: HardDrive,
      actionSources: [{ id: 'storage:google-drive-projects', label: 'Google Drive', source: 'google-drive', currentRevisionAvailable: true }],
      meta: [['Ownership', 'Your Google Drive'], ['Permission', 'Explicit per-file drive.file access']],
      content: googleDriveProjects,
    },
    {
      id: 'connected-assets', kind: 'storage-location', eyebrow: 'Connected source', title: 'Google Drive assets',
      summary: 'Explicitly selected artwork, frames, and fonts indexed by role without copying provider bytes into CardForge.',
      status: 'Provider references', tone: 'neutral', value: 'Connected assets', icon: Images,
      actionSources: [{ id: 'storage:connected-assets', label: 'Google Drive assets', source: 'google-drive', currentRevisionAvailable: true }],
      meta: [['Ownership', 'Your Google Drive'], ['Removal', 'CardForge index only; source file remains']],
      content: connectedAssets,
    },
  ], [connectedAssets, googleDriveProjects, localProjectFolder, workspaceStorage]);

  const selected = locations.find((location) => location.id === selectedId) ?? null;
  const closeDetail = () => {
    const focusId = selectedId ? `environment-object-${selectedId}` : null;
    setSelectedId(null);
    requestAnimationFrame(() => { if (focusId) document.getElementById(focusId)?.focus(); });
  };

  return (
    <section aria-label="Storage and connections">
      <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(16rem,0.72fr)_minmax(0,1.28fr)]">
        <div className="min-w-0">
          <EnvironmentSectionHeading id="storage-location-list-heading" title="Owners & locations" meta={`${locations.length} locations`} />
          {locations.map((location) => <CompactSettingRow key={location.id} item={location} selected={selectedId === location.id} onOpen={() => setSelectedId(location.id)} />)}
        </div>
        <aside className="hidden min-w-0 border-l border-[var(--cf-border-subtle)] pl-5 md:block" aria-live="polite">
          {selected ? <StorageToolDetail location={selected} onClose={closeDetail} /> : <div className="py-8"><p className="font-serif text-xl text-[var(--cf-text-strong)]">Choose a location</p><p className="mt-2 max-w-md text-sm leading-6 text-[var(--cf-text-muted)]">Actions stay with the location they affect, so removing a local copy, provider file, index reference, or temporary draft cannot be mistaken for deleting authored work everywhere.</p></div>}
        </aside>
      </div>

      {selected && mobileDetail ? (
        <Sheet open onOpenChange={(open) => { if (!open) closeDetail(); }}>
          <SheetContent
            side="bottom"
            overlayClassName="z-[95]"
            className="z-[100] max-h-[88dvh] overflow-y-auto border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] text-[var(--cf-text)]"
            onCloseAutoFocus={(event) => { event.preventDefault(); document.getElementById(`environment-object-${selected.id}`)?.focus(); }}
          >
            <SheetTitle className="font-serif text-xl text-[var(--cf-text-strong)]">{selected.title}</SheetTitle>
            <SheetDescription className="mt-1 text-sm leading-5 text-[var(--cf-text-muted)]">{selected.summary}</SheetDescription>
            <div className={`mt-4 border-t border-[var(--cf-border)] pt-3 ${selectedContentClass}`}>{selected.content}</div>
          </SheetContent>
        </Sheet>
      ) : null}
    </section>
  );
}

export function AccountStorageWorkspace(props: LibraryStorageConnectionsToolProps) {
  return <LibraryStorageConnectionsTool {...props} />;
}
