"use client";

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getProjectPersistenceScope } from '../persistence/projectPersistenceScope';
import { useProjectStore } from '../store/workspaceStore';
import { hasProjectDocumentStateChanged } from '../client/projectWorkspaceDocument';
import {
  getLocalProjectWorkBinding, LOCAL_PROJECT_FOLDER_CHANGE_EVENT, LocalFolderRevisionConflict, saveCardSetToAttachedFolder,
  type LocalProjectFolderBinding,
} from '../client/localProjectFolder';
import { FolderSaveConflictChoices } from './FolderSaveConflictChoices';

/** Reuses the folder owner; this control keeps only the currently presented receipt. */
export function LinkedFolderSave({ setId, compact = false, onChanged }: {
  setId: string;
  compact?: boolean;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const scope = getProjectPersistenceScope();
  const [loaded, setLoaded] = useState<{ setId: string; scope: string; binding: LocalProjectFolderBinding | null; ready: boolean }>({ setId, scope, binding: null, ready: false });
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<{ error: LocalFolderRevisionConflict; binding: LocalProjectFolderBinding } | null>(null);
  useEffect(() => {
    let active = true;
    setConflict(null);
    const refresh = () => {
      void getLocalProjectWorkBinding(setId).then((binding) => {
        if (active && scope === getProjectPersistenceScope()) setLoaded({ setId, scope, binding, ready: true });
      }).catch(() => { if (active) setLoaded({ setId, scope, binding: null, ready: true }); });
    };
    refresh();
    window.addEventListener(LOCAL_PROJECT_FOLDER_CHANGE_EVENT, refresh);
    return () => { active = false; window.removeEventListener(LOCAL_PROJECT_FOLDER_CHANGE_EVENT, refresh); };
  }, [scope, setId]);
  const binding = loaded.setId === setId && loaded.scope === scope ? loaded.binding : null;
  const save = async (options: { asNew?: boolean } = {}, expected = binding) => {
    if (!expected || busy || scope !== getProjectPersistenceScope()) return;
    const before = useProjectStore.getState();
    setBusy(true);
    try {
      const saved = await saveCardSetToAttachedFolder(setId, expected, options);
      if (scope !== getProjectPersistenceScope()) return;
      const newer = hasProjectDocumentStateChanged(before, useProjectStore.getState());
      setConflict(null);
      toast({ title: options.asNew ? 'New folder copy saved' : 'Set saved', description: options.asNew
        ? `Saved ${saved.fileName ?? 'a new file'} in ${saved.folderName}. The previous file remains there; use Open a Set file to open it.${newer ? ' Newer changes remain on this device.' : ''}`
        : newer ? `Saved earlier changes to ${saved.folderName}. Newer changes remain on this device.` : `Saved to ${saved.folderName}.` });
      onChanged?.();
    } catch (error) {
      if (error instanceof LocalFolderRevisionConflict && scope === getProjectPersistenceScope()) { setConflict({ error, binding: expected }); return; }
      if (scope === getProjectPersistenceScope()) toast({ title: 'Folder save needs review', description: `${error instanceof Error ? error.message : 'The folder save could not be confirmed.'} Browser work remains on this device; check the folder before retrying.`, variant: 'destructive' });
    } finally { setBusy(false); }
  };
  return <div className="inline-flex min-w-0 flex-wrap items-center gap-1"><Button type="button" size="sm" variant="outline" aria-label={binding ? `Save to folder ${binding.folderName}` : 'Save to linked folder'} title={binding ? `Save to ${binding.folderName}` : 'Linked folder unavailable'} disabled={!binding || busy} onClick={() => { void save(); }}>
    <Save aria-hidden="true" /><span className={compact ? 'max-md:hidden' : undefined}>{busy ? 'Saving to folder…' : 'Save to folder'}</span>
  </Button>{binding && !conflict ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { void save({ asNew: true }); }}>Save as new copy</Button> : null}{conflict ? <FolderSaveConflictChoices busy={busy} reason={conflict.error.reason} onSaveNew={() => { void save({ asNew: true }, conflict.binding); }} onCancel={() => setConflict(null)} /> : null}{loaded.ready && loaded.setId === setId && loaded.scope === scope && !binding ? <span role="status" className="text-xs text-muted-foreground">Folder link unavailable. Open Save &amp; move to review it.</span> : null}</div>;
}
