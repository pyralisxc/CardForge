"use client";

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { copyGoogleDriveProjectToBrowser, getGoogleDriveWorkBinding, refreshGoogleDriveProject } from '../client/googleDriveProjectTransfer';

/** File actions belong to the selected Set; Project remains the provider owner. */
export function SelectedDriveFileActions({ fileId, accountId, name, localSetId, disabled, onChanged, onOpenCopy }: {
  fileId: string;
  accountId?: string;
  name: string;
  localSetId?: string;
  disabled?: boolean;
  onChanged: () => void;
  onOpenCopy: (setId: string | null) => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

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
      <Button type="button" size="sm" variant="outline" disabled={disabled || busy || !accountId} onClick={() => void run(async () => {
        if (!accountId) throw new Error('Refresh this Set to confirm its connected Drive account.');
        const copy = await copyGoogleDriveProjectToBrowser({ fileId, name, accountId });
        onOpenCopy(copy.workId ?? null);
      }, 'Independent device copy created')}>Make independent copy</Button>
      {localSetId ? <Button type="button" size="sm" variant="outline" disabled={disabled || busy || !accountId} onClick={() => void run(async () => {
        const binding = await getGoogleDriveWorkBinding(localSetId);
        if (!accountId || !binding || binding.fileId !== fileId || binding.accountId !== accountId) throw new Error('The Drive link or account changed. Refresh the selected Set before trying again.');
        await refreshGoogleDriveProject(binding);
      }, 'Working copy refreshed')}>Refresh working copy</Button> : null}
    </div>

  </>;
}
