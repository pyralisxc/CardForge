"use client";

import { createContext, useContext, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { useAccountLibraryProjection } from '../hooks/useAccountLibraryProjection';
import type { AccountLibraryItem } from '../model/accountLibrary';
import { SetTrashDialog } from './SetTrashDialog';
import { WorkLocationDialog } from './WorkLocationDialog';

type Projection = ReturnType<typeof useAccountLibraryProjection>;
type LocationProjection = Pick<Projection, 'items' | 'refresh' | 'driveConnection' | 'localFolderSupported' | 'selectedLocalFolder'> & {
  sourceStatuses: Array<{ id: string; phase: string; failure: { message: string } | null }>;
};
interface StorageLocationContextValue {
  projection: LocationProjection;
  isSignedIn: boolean;
  canUseProjectFiles: boolean;
  onDeviceRemoved?: (setId: string) => void;
}
const StorageLocationContext = createContext<StorageLocationContextValue | null>(null);

export function StorageLocationProvider({ children, ...value }: StorageLocationContextValue & { children: ReactNode }) {
  return <StorageLocationContext.Provider value={value}>{children}</StorageLocationContext.Provider>;
}

/** A view of one location from the surface's existing account-scoped projection. */
export function StorageLocationContents({ source }: { source: 'device' | 'google-drive' }) {
  const context = useContext(StorageLocationContext);
  const [moveSelection, setMoveSelection] = useState<{ item: AccountLibraryItem; accountId?: string; folderId?: string; folder: Projection['selectedLocalFolder'] } | null>(null);
  const [trashItem, setTrashItem] = useState<AccountLibraryItem | null>(null);
  if (!context) return null;
  const { projection, isSignedIn, canUseProjectFiles, onDeviceRemoved } = context;
  const statusId = source === 'device' ? 'workspace' : 'google-drive';
  const sourceStatus = projection.sourceStatuses.find((entry) => entry.id === statusId);
  const assetStatus = source === 'device' ? projection.sourceStatuses.find((entry) => entry.id === 'device-assets') : null;
  const items = projection.items.filter((item) => item.locations.some((location) => location.source === source)
    && (source !== 'google-drive' || Boolean(item.references.driveFileId)));
  const driveConnected = Boolean(projection.driveConnection?.connected && projection.driveConnection.rootFolderId && projection.driveConnection.accountId);
  const sourceReady = Boolean(sourceStatus && ['ready', 'empty'].includes(sourceStatus.phase));
  const sourceItem = (item: AccountLibraryItem): AccountLibraryItem => {
    const references = { ...item.references };
    if (source === 'device') {
      delete references.driveFileId; delete references.driveAccountId; delete references.driveProviderRevision; delete references.driveProjectRevision;
    } else delete references.localSetId;
    return { ...item, name: source === 'google-drive' ? references.driveFileName ?? item.name : item.name, locations: item.locations.filter((location) => location.source === source), references };
  };
  const problem = [sourceStatus, assetStatus].find((entry) => entry && !['ready', 'empty', 'loading'].includes(entry.phase));
  const statusText = source === 'google-drive' && !isSignedIn ? 'Sign in and connect Google Drive to see its projects.'
    : [sourceStatus, assetStatus].some((entry) => entry?.phase === 'loading') ? 'Loading this location…'
    : problem ? problem.failure?.message ?? 'This location needs attention. The list may be incomplete.'
    : source === 'google-drive' && !projection.driveConnection?.connected ? 'Connect Google Drive to see its projects.' : null;
  return <section className="mt-5 space-y-2" aria-label={source === 'device' ? 'This device contents' : 'Google Drive project folder contents'}>
    <h4 className="font-semibold">{source === 'device' ? 'On this device' : 'In the selected project folder'}</h4>
    {source === 'google-drive' ? <p className="text-xs">CardForge shows the project files this connection can access. Google Drive owns the folder and its full path.</p> : null}
    {statusText ? <p role="status" className="text-sm">{statusText}</p> : null}
    {!statusText && !items.length ? <p className="text-sm">No {source === 'device' ? 'device work' : 'accessible projects'} found.</p> : null}
    {items.map((item) => {
      const name = source === 'google-drive' ? item.references.driveFileName ?? item.name : item.name;
      const isSet = item.kind === 'set';
      const folder = projection.selectedLocalFolder;
      const folderReady = folder?.permission === 'granted' && folder.binding?.packageScope === 'set' && folder.binding.verifiedSetScope && folder.binding.workId === item.references.localSetId && Boolean(folder.binding.sourceRevision);
      const canMove = source === 'device' && isSet && Boolean(item.references.localSetId) && canUseProjectFiles && (driveConnected || folderReady);
      const canDelete = isSet && (source === 'device' ? Boolean(item.references.localSetId) : Boolean(item.references.driveFileId));
      return <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border border-[var(--cf-border-subtle)] p-3">
        <div className="min-w-0"><p className="break-words font-medium">{name}</p><p className="text-xs text-[var(--cf-text-muted)]">{item.kind === 'set' ? 'Set' : item.kind === 'template' ? 'Template' : 'Asset'}{source === 'google-drive' ? ' · Google Drive' : ' · This device'}</p></div>
        <div className="flex flex-wrap gap-2">{canMove ? <Button type="button" size="sm" variant="outline" aria-label={`Move ${item.name}`} disabled={!sourceReady} onClick={() => { const connection = projection.driveConnection; setMoveSelection({ item, accountId: connection?.accountId ?? undefined, folderId: connection?.rootFolderId ?? undefined, folder: folderReady ? folder : null }); }}>Move</Button> : null}{canDelete ? <Button type="button" size="sm" variant="outline" aria-label={`Delete ${name} from ${source === 'device' ? 'this device' : 'Google Drive'}`} disabled={!sourceReady || (source === 'google-drive' && (!isSignedIn || !canUseProjectFiles))} onClick={() => setTrashItem(sourceItem(item))}>Delete</Button> : null}</div>
        {!canMove && !canDelete ? <p className="w-full text-xs text-[var(--cf-text-muted)]">Move and Delete are not available here for this item.</p> : source === 'google-drive' ? <p className="w-full text-xs text-[var(--cf-text-muted)]">Moving a Drive original is not available; Delete uses Google Drive Trash.</p> : !canMove ? <p className="w-full text-xs text-[var(--cf-text-muted)]">Connect Drive or select this Set's verified folder to move it from this device.</p> : null}
      </div>;
    })}
    {moveSelection ? <WorkLocationDialog item={moveSelection.item} open onOpenChange={(open) => { if (!open) setMoveSelection(null); }} isSignedIn={isSignedIn} canUseProjectFiles={canUseProjectFiles} driveConnected={driveConnected} localFolderSupported={projection.localFolderSupported} strictMoveDestination expectedDriveDestination={moveSelection.accountId && moveSelection.folderId ? { accountId: moveSelection.accountId, folderId: moveSelection.folderId } : undefined} expectedFolderBinding={moveSelection.folder?.binding} onMoved={onDeviceRemoved} onChanged={projection.refresh} /> : null}
    {trashItem ? <SetTrashDialog item={trashItem} canUseDrive={isSignedIn && canUseProjectFiles} onClose={() => setTrashItem(null)} onCompleted={(target) => { if (target === 'device' && trashItem.references.localSetId) onDeviceRemoved?.(trashItem.references.localSetId); projection.refresh(); }} /> : null}
  </section>;
}
