"use client";

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { copyGoogleDriveProjectToBrowser, deleteGoogleDriveProjectCopy, getGoogleDriveWorkBinding, refreshGoogleDriveProject } from '../client/googleDriveProjectTransfer';

/** File actions belong to the selected Set; Project remains the provider owner. */
export function SelectedDriveFileActions({ fileId, name, providerRevision, projectRevision, localSetId, disabled, onChanged, onOpenCopy }: {
  fileId: string;
  name: string;
  providerRevision?: string;
  projectRevision?: string;
  localSetId?: string;
  disabled?: boolean;
  onChanged: () => void;
  onOpenCopy: (setId: string) => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [confirmTrash, setConfirmTrash] = useState(false);

  const run = async (operation: () => Promise<void>, success: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await operation();
      onChanged();
      toast({ title: success });
    } catch (error) {
      toast({ title: 'Drive action needs attention', description: error instanceof Error ? error.message : 'Check Drive before retrying. Your device work remains available.', variant: 'destructive' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return <>
    <div className="flex flex-wrap gap-2" aria-label="Google Drive file actions">
      <Button type="button" size="sm" variant="outline" disabled={disabled || busy} onClick={() => void run(async () => {
        const copy = await copyGoogleDriveProjectToBrowser({ fileId, name });
        if (!copy.workId) throw new Error('The independent copy has no Set to open.');
        onOpenCopy(copy.workId);
      }, 'Independent device copy created')}>Make independent copy</Button>
      {localSetId ? <Button type="button" size="sm" variant="outline" disabled={disabled || busy} onClick={() => void run(async () => {
        const binding = await getGoogleDriveWorkBinding(localSetId);
        if (!binding || binding.fileId !== fileId) throw new Error('The Drive link changed. Refresh the selected Set before trying again.');
        await refreshGoogleDriveProject(binding);
      }, 'Working copy refreshed')}>Refresh working copy</Button> : null}
      {localSetId ? <Button type="button" size="sm" variant="outline" disabled={disabled || busy || !providerRevision || !projectRevision} onClick={() => setConfirmTrash(true)}>Move Drive file to Trash</Button> : null}
    </div>
    <AlertDialog open={confirmTrash} onOpenChange={(open) => { if (!busy) setConfirmTrash(open); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Move this Drive file to Trash?</AlertDialogTitle><AlertDialogDescription>
          {`The entire Google Drive file “${name}” will move to Drive Trash. Your device work and local-folder copies stay here. Restore the file from Google Drive if needed.`}
        </AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(event) => {
          event.preventDefault();
          if (!providerRevision || !projectRevision) return;
          void run(async () => {
            await deleteGoogleDriveProjectCopy({ fileId, providerRevision, projectRevision });
            setConfirmTrash(false);
          }, 'Drive file moved to Trash');
        }}>Move to Trash</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
