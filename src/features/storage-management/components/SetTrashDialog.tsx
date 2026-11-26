"use client";

import { useRef, useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { deleteGoogleDriveProjectCopy } from '@/features/project/client/provider-google-drive';
import { getProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { trashDeviceSet } from '@/features/project/client/workLocationTransfer';
import type { AccountLibraryItem } from '../model/accountLibrary';

type TrashTarget = 'device' | 'drive';

/** One selected-Set lifecycle; the device and Drive owners perform their own operations. */
export function SetTrashDialog({ item, canUseDrive, onClose, onCompleted }: {
  item: AccountLibraryItem;
  canUseDrive: boolean;
  onClose: () => void;
  onCompleted: (target: TrashTarget) => void;
}) {
  const { toast } = useToast();
  const scope = useRef(getProjectPersistenceScope());
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const hasDevice = Boolean(item.references.localSetId);
  const hasDrive = Boolean(item.references.driveFileId);
  const driveReady = Boolean(canUseDrive && item.references.driveAccountId && item.references.driveProviderRevision && item.references.driveProjectRevision);
  const [target, setTarget] = useState<TrashTarget | null>(hasDevice && hasDrive ? null : hasDevice ? 'device' : hasDrive ? 'drive' : null);

  const confirm = async () => {
    if (!target || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (getProjectPersistenceScope() !== scope.current) throw new Error('The active account changed. Reopen Trash for the intended Set.');
      if (target === 'device') {
        if (!item.references.localSetId) throw new Error('The device Set could not be found. Refresh before trying again.');
        await trashDeviceSet(item.references.localSetId, scope.current);
      } else {
        const { driveFileId, driveAccountId, driveProviderRevision, driveProjectRevision } = item.references;
        if (!driveReady || !driveFileId || !driveAccountId || !driveProviderRevision || !driveProjectRevision) throw new Error('Refresh this Set to confirm the Drive account and revisions.');
        await deleteGoogleDriveProjectCopy({ fileId: driveFileId, accountId: driveAccountId, providerRevision: driveProviderRevision, projectRevision: driveProjectRevision });
      }
    } catch (error) {
      toast({ title: 'Trash needs attention', description: error instanceof Error ? error.message : 'Check the selected location before trying again.', variant: 'destructive' });
      busyRef.current = false;
      setBusy(false);
      onClose();
      return;
    }
    // Completion and UI refresh cannot turn a confirmed provider operation into failure.
    try { onCompleted(target); } catch {
      toast({ title: 'Copy removed', description: 'The removal was confirmed, but the view could not refresh. Reload before another action.' });
      onClose();
      return;
    }
    toast({ title: target === 'device' ? 'Device copy deleted' : 'Drive file moved to Trash', description: `Only the selected copy of “${item.name}” was removed.` });
    onClose();
  };

  return <AlertDialog open onOpenChange={(open) => { if (!open && !busyRef.current) onClose(); }}>
    <AlertDialogContent className="border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]">
      <AlertDialogHeader><AlertDialogTitle>Trash “{item.name}”?</AlertDialogTitle><AlertDialogDescription>
        {hasDevice && hasDrive ? 'Choose one copy. The other locations and shared Library content remain unchanged.'
          : hasDevice ? 'The device copy, its local cards and its Set-owned Templates will be permanently deleted from this browser. Drive, local-folder copies and shared Library content remain unchanged.'
            : 'The Google Drive file will move to Drive Trash after checking its saved revision. Device and local-folder copies remain unchanged.'}
      </AlertDialogDescription></AlertDialogHeader>
      {hasDevice && hasDrive ? <fieldset className="space-y-3"><legend className="font-medium">Which copy?</legend>
        <label className="flex items-start gap-2"><input type="radio" name="set-trash-target" checked={target === 'device'} onChange={() => setTarget('device')} disabled={busy} /><span>Device copy — permanently delete it, its local cards and Set-owned Templates from this browser.</span></label>
        <label className="flex items-start gap-2"><input type="radio" name="set-trash-target" checked={target === 'drive'} onChange={() => setTarget('drive')} disabled={busy || !driveReady} /><span>Google Drive file — move it to Drive Trash; the device copy stays.{!driveReady ? ' Refresh or reconnect Drive to confirm access and revisions.' : ''}</span></label>
      </fieldset> : null}
      {hasDrive && !hasDevice && !driveReady ? <p className="text-sm">Refresh or reconnect Drive to confirm access and revisions.</p> : null}
      {item.references.localFolder || item.references.localFolderWorkId ? <p className="text-sm">Local-folder files stay unchanged; manage them in your file manager.</p> : null}
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy || !target || (target === 'drive' && !driveReady)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(event) => { event.preventDefault(); void confirm(); }}>{target === 'device' ? 'Permanently delete device copy' : target === 'drive' ? 'Move Drive file to Trash' : 'Choose a copy'}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
