"use client";

import { useEffect, useMemo, useState } from 'react';
import { Cloud, FolderOpen, HardDrive, Loader2, MoveRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { ApiClientError } from '@/infrastructure/http/clientResponses';

import {
  copyGoogleDriveProjectToBrowser,
  GoogleDriveSaveLinkageError,
  saveCardSetToGoogleDrive,
} from '../client/googleDriveProjectTransfer';
import { saveCardSetToAttachedFolder } from '../client/localProjectFolder';
import { readProjectPreference, writeProjectPreference } from '../persistence/preferences';
import { useProjectStore } from '../store/workspaceStore';
import { getProjectPersistenceScope } from '../persistence/projectPersistenceScope';
import { removeDeviceWorkAfterVerifiedCopy } from '../client/workLocationTransfer';
import {
  canMoveWork,
  canTransferWork,
  DEFAULT_WORK_LOCATION_PREFERENCE,
  getWorkLocationCapabilities,
  normalizeDefaultWorkLocation,
  type WorkLocationId,
} from '../model/workLocations';
import styles from './ProjectWorkLocationDialog.module.css';

export interface ProjectWorkLocationTarget {
  name: string;
  locations: WorkLocationId[];
  localSetId?: string;
  driveFileId?: string;
  driveProviderRevision?: string;
  driveProjectRevision?: string;
}

export interface ProjectWorkLocationContextProps {
  isSignedIn: boolean;
  canUseProjectFiles: boolean;
  driveConnected: boolean;
  localFolderSupported: boolean;
}

import type { ProjectDocumentV1 } from '../model/projectDocument';

interface ProjectWorkLocationDialogProps extends ProjectWorkLocationContextProps {
  target: ProjectWorkLocationTarget | null;
  driveConflictMessage?: string | null;
  driveAvailabilityMessage?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
  renderThumbnail?: (document: ProjectDocumentV1) => Promise<string | null>;
}

const locationIcon = {
  device: HardDrive,
  'google-drive': Cloud,
  'local-folder': FolderOpen,
} as const;

const useDefaultWorkLocation = (capabilities: ReturnType<typeof getWorkLocationCapabilities>) => {
  const { toast } = useToast();
  const [defaultLocation, setDefaultLocation] = useState<WorkLocationId>('device');
  useEffect(() => {
    let cancelled = false;
    void readProjectPreference<unknown>(DEFAULT_WORK_LOCATION_PREFERENCE)
      .then((value) => {
        if (!cancelled) setDefaultLocation(normalizeDefaultWorkLocation(value, capabilities));
      })
      .catch(() => {
        if (!cancelled) toast({
          title: 'Default location is unavailable',
          description: 'CardForge could not read this browser preference. This device remains the safe default.',
          variant: 'destructive',
        });
      });
    return () => { cancelled = true; };
  }, [capabilities, toast]);

  const changeDefault = async (value: WorkLocationId) => {
    const previous = defaultLocation;
    setDefaultLocation(value);
    try {
      await writeProjectPreference(DEFAULT_WORK_LOCATION_PREFERENCE, value);
    } catch {
      setDefaultLocation(previous);
      toast({
        title: 'Default location was not changed',
        description: 'This browser did not save the preference. Your previous default remains active.',
        variant: 'destructive',
      });
    }
  };
  return { defaultLocation, changeDefault };
};

export function DefaultWorkLocationControl({ isSignedIn, canUseProjectFiles, driveConnected, localFolderSupported }: ProjectWorkLocationContextProps) {
  const capabilities = useMemo(() => getWorkLocationCapabilities({ signedIn: isSignedIn, canUseProjectFiles, driveConnected, localFolderSupported }), [canUseProjectFiles, driveConnected, isSignedIn, localFolderSupported]);
  const { defaultLocation, changeDefault } = useDefaultWorkLocation(capabilities);
  return <div className={styles.locationPreference}>
    <div><strong>Preferred save destination</strong><span>Shown first when choosing where to save a Set. Existing attachments keep their destination.</span></div>
    <Select value={defaultLocation} onValueChange={(value) => { void changeDefault(value as WorkLocationId); }}>
      <SelectTrigger aria-label="Preferred save destination" className={styles.defaultSelect}><span>{capabilities.find((capability) => capability.id === defaultLocation)?.label ?? 'This device'}</span></SelectTrigger>
      <SelectContent>{capabilities.map((capability) => <SelectItem key={capability.id} value={capability.id} disabled={!capability.available || !capability.create}>{capability.label}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}

export function ProjectWorkLocationDialog({
  target,
  driveConflictMessage = null,
  driveAvailabilityMessage = null,
  open,
  onOpenChange,
  isSignedIn,
  canUseProjectFiles,
  driveConnected,
  localFolderSupported,
  onChanged,
  renderThumbnail,
}: ProjectWorkLocationDialogProps) {
  const { toast } = useToast();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [driveConflict, setDriveConflict] = useState<string | null>(driveConflictMessage);
  useEffect(() => { setDriveConflict(driveConflictMessage); }, [driveConflictMessage, target?.localSetId]);
  const capabilities = useMemo(() => getWorkLocationCapabilities({
    signedIn: isSignedIn,
    canUseProjectFiles,
    driveConnected,
    localFolderSupported,
  }), [canUseProjectFiles, driveConnected, isSignedIn, localFolderSupported]);
  const { defaultLocation, changeDefault } = useDefaultWorkLocation(capabilities);
  const orderedCapabilities = useMemo(() => capabilities.toSorted((left, right) => (
    Number(right.id === defaultLocation) - Number(left.id === defaultLocation)
  )), [capabilities, defaultLocation]);
  const source = target?.localSetId ? 'device' : target?.locations[0] ?? null;

  const transfer = async (destination: WorkLocationId, move: boolean, asNew = false) => {
    if (!target || !source) return;
    const actionKey = `${destination}:${asNew ? 'save-new' : move ? 'move' : 'copy'}`;
    const expectedState = useProjectStore.getState();
    const scope = getProjectPersistenceScope();
    let destinationCreated = false;
    let sourceReceiptKnown = false;
    setDriveConflict(null);
    setBusyAction(actionKey);
    try {
      if (source === 'device' && target.localSetId) {
        if (destination === 'google-drive') {
          await saveCardSetToGoogleDrive({ setId: target.localSetId, name: target.name, asNew, renderThumbnail });
        } else if (destination === 'local-folder') {
          await saveCardSetToAttachedFolder(target.localSetId);
        } else {
          throw new Error('This Set already lives on this device.');
        }
        destinationCreated = true;
        if (move) await removeDeviceWorkAfterVerifiedCopy({ setId: target.localSetId, expectedState, scope });
      } else if (source === 'google-drive' && destination === 'device' && target.driveFileId) {
        if (move) throw new Error('Copy this document to the device, then manage the original in Drive. Automatic Drive source removal is unavailable.');
        await copyGoogleDriveProjectToBrowser({ fileId: target.driveFileId, name: target.name });
        destinationCreated = true;
      } else {
        throw new Error('Open this source on the device before sending it to that location.');
      }
      toast({
        title: asNew ? 'New Drive copy saved' : move ? 'Set moved' : 'Set copied',
        description: asNew
          ? `${target.name} now has a separate Google Drive copy. The newer existing Drive document was left unchanged.`
          : move
          ? `${target.name} was verified at ${capabilities.find((capability) => capability.id === destination)?.label} before the source copy was removed.`
          : `${target.name} is now available at ${capabilities.find((capability) => capability.id === destination)?.label}.`,
      });
      onChanged?.();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof GoogleDriveSaveLinkageError) {
        destinationCreated = true;
        sourceReceiptKnown = true;
      }
      if (error instanceof ApiClientError && error.kind === 'conflict' && destination === 'google-drive' && !asNew) {
        setDriveConflict(error.message);
        return;
      }
      toast({
        title: destinationCreated ? 'Copy saved · source retained' : 'Location change needs review',
        description: `${destinationCreated ? 'The destination copy is confirmed, and the device source was kept. ' : ''}${error instanceof Error ? error.message : 'CardForge could not confirm this location change. Check the destination before repeating the action.'}${sourceReceiptKnown ? ' Use the Drive status on the open Set to repair its browser link without repeating the upload.' : ''}`,
        variant: 'destructive',
      });
      if (destinationCreated) onChanged?.();
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog}>
        <DialogHeader>
          <DialogTitle className={styles.title}>Save &amp; move {target?.name ?? 'Set'}</DialogTitle>
          <DialogDescription className={styles.description}>
            A move always writes and verifies the destination first. If verification fails, the source stays unchanged.
            {' '}Drive documents can be copied here; remove the original separately in Drive when you are ready.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.defaultRow}>
          <div><strong>Preferred save destination</strong><span>Shown first for new saves. Existing attachments keep their destination.</span></div>
          <Select value={defaultLocation} onValueChange={(value) => { void changeDefault(value as WorkLocationId); }}>
            <SelectTrigger aria-label="Preferred save destination" className={styles.defaultSelect}>
              <span>{capabilities.find((capability) => capability.id === defaultLocation)?.label ?? 'This device'}</span>
            </SelectTrigger>
            <SelectContent>{capabilities.map((capability) => <SelectItem key={capability.id} value={capability.id} disabled={!capability.available || !capability.create}>{capability.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {driveConflict ? <div className={styles.conflict} role="alert">
          <strong>Drive has a newer revision</strong>
          <span>{driveConflict}</span>
          <span>The existing Drive copy is protected. Save this browser work as a new Drive document to keep both versions.</span>
        </div> : null}

        {driveAvailabilityMessage ? <div className={styles.conflict} role="status">
          <strong>Google Drive needs review</strong>
          <span>{driveAvailabilityMessage}</span>
          <span>This dialog will not treat a failed Drive check as a disconnected account or update the Drive copy until it can be checked.</span>
        </div> : null}

        <div className={styles.locationList}>
          {orderedCapabilities.map((capability) => {
            const Icon = locationIcon[capability.id];
            const isCurrent = target?.locations.includes(capability.id) ?? false;
            const copyAvailable = Boolean(source && canTransferWork({ source, destination: capability.id, capabilities }))
              && (source === 'device' || capability.id === 'device');
            const moveAvailable = copyAvailable && Boolean(source && canMoveWork({ source, destination: capability.id, capabilities }));
            const driveUpdateBlocked = capability.id === 'google-drive' && (driveConflict !== null || driveAvailabilityMessage !== null);
            return (
              <div key={capability.id} className={styles.locationRow} data-default={defaultLocation === capability.id}>
                <span className={styles.locationIcon}><Icon aria-hidden="true" /></span>
                <div className={styles.locationCopy}>
                  <strong>{capability.label}</strong>
                  <span>{isCurrent ? 'Current copy' : capability.available ? capability.revisionSafe ? 'Revision-safe provider copy' : 'User-owned portable copy' : capability.reason}</span>
                </div>
                <div className={styles.locationActions}>
                  {copyAvailable ? <Button type="button" size="sm" variant="outline" disabled={busyAction !== null || driveUpdateBlocked} onClick={() => void transfer(capability.id, false)}>{busyAction === `${capability.id}:copy` ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}{isCurrent ? 'Update copy' : 'Copy here'}</Button> : null}
                  {driveUpdateBlocked && target?.localSetId ? <Button type="button" size="sm" disabled={busyAction !== null} onClick={() => void transfer('google-drive', false, true)}>{busyAction === 'google-drive:save-new' ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}Save as new</Button> : null}
                  {moveAvailable ? <Button type="button" size="sm" disabled={busyAction !== null || driveUpdateBlocked} onClick={() => void transfer(capability.id, true)}>{busyAction === `${capability.id}:move` ? <Loader2 className="animate-spin" aria-hidden="true" /> : <MoveRight aria-hidden="true" />}Move here</Button> : null}
                  {!copyAvailable && !isCurrent ? <span className={styles.unavailable}>{capability.available ? 'Open on device first' : 'Not available'}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
