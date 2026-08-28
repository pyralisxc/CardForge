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
import {
  copyGoogleDriveProjectToBrowser,
  deleteGoogleDriveProjectCopy,
  readProjectPreference,
  saveCardSetToAttachedFolder,
  saveCardSetToGoogleDrive,
  useProjectStore,
  writeProjectPreference,
} from '@/features/project/client';

import type { AccountLibraryItem } from '../model/accountLibrary';
import {
  accountSourceToWorkLocation,
  canMoveWork,
  canTransferWork,
  DEFAULT_WORK_LOCATION_PREFERENCE,
  getWorkLocationCapabilities,
  normalizeDefaultWorkLocation,
  type WorkLocationId,
} from '../model/workLocations';
import styles from './WorkLocationDialog.module.css';

interface WorkLocationDialogProps {
  item: AccountLibraryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSignedIn: boolean;
  driveConnected: boolean;
  localFolderSupported: boolean;
  onChanged?: () => void;
}

interface DefaultWorkLocationControlProps {
  isSignedIn: boolean;
  driveConnected: boolean;
  localFolderSupported: boolean;
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

export function DefaultWorkLocationControl({ isSignedIn, driveConnected, localFolderSupported }: DefaultWorkLocationControlProps) {
  const capabilities = useMemo(() => getWorkLocationCapabilities({ signedIn: isSignedIn, driveConnected, localFolderSupported }), [driveConnected, isSignedIn, localFolderSupported]);
  const { defaultLocation, changeDefault } = useDefaultWorkLocation(capabilities);
  return <div className={styles.locationPreference}>
    <div><strong>Default save location</strong><span>New Save actions start here. You can choose another destination per Set.</span></div>
    <Select value={defaultLocation} onValueChange={(value) => { void changeDefault(value as WorkLocationId); }}>
      <SelectTrigger aria-label="Default save location" className={styles.defaultSelect}><span>{capabilities.find((capability) => capability.id === defaultLocation)?.label ?? 'This device'}</span></SelectTrigger>
      <SelectContent>{capabilities.map((capability) => <SelectItem key={capability.id} value={capability.id} disabled={!capability.available || !capability.create}>{capability.label}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}

export function WorkLocationDialog({
  item,
  open,
  onOpenChange,
  isSignedIn,
  driveConnected,
  localFolderSupported,
  onChanged,
}: WorkLocationDialogProps) {
  const { toast } = useToast();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const capabilities = useMemo(() => getWorkLocationCapabilities({
    signedIn: isSignedIn,
    driveConnected,
    localFolderSupported,
  }), [driveConnected, isSignedIn, localFolderSupported]);
  const { defaultLocation, changeDefault } = useDefaultWorkLocation(capabilities);
  const orderedCapabilities = useMemo(() => capabilities.toSorted((left, right) => (
    Number(right.id === defaultLocation) - Number(left.id === defaultLocation)
  )), [capabilities, defaultLocation]);
  const source = item
    ? item.references.localSetId
      ? 'device'
      : accountSourceToWorkLocation(item.locations[0]?.source ?? 'device')
    : null;

  const removeDeviceCopy = (setId: string) => {
    const store = useProjectStore.getState();
    if (store.cardSets.length <= 1) store.createCardSet();
    if (!useProjectStore.getState().deleteCardSet(setId)) {
      throw new Error('CardForge could not remove the device copy after verifying the destination.');
    }
  };

  const transfer = async (destination: WorkLocationId, move: boolean) => {
    if (!item || !source) return;
    const actionKey = `${destination}:${move ? 'move' : 'copy'}`;
    setBusyAction(actionKey);
    try {
      if (source === 'device' && item.references.localSetId) {
        if (destination === 'google-drive') {
          await saveCardSetToGoogleDrive({ setId: item.references.localSetId, name: item.name });
        } else if (destination === 'local-folder') {
          await saveCardSetToAttachedFolder(item.references.localSetId);
        } else {
          throw new Error('This Set already lives on this device.');
        }
        if (move) removeDeviceCopy(item.references.localSetId);
      } else if (source === 'google-drive' && destination === 'device' && item.references.driveFileId) {
        await copyGoogleDriveProjectToBrowser({ fileId: item.references.driveFileId, name: item.name });
        if (move) {
          const providerRevision = item.references.driveProviderRevision;
          const projectRevision = item.references.driveProjectRevision;
          if (!providerRevision || !projectRevision) throw new Error('Reload this Drive copy before moving it so CardForge has its exact revisions.');
          await deleteGoogleDriveProjectCopy({ fileId: item.references.driveFileId, providerRevision, projectRevision });
        }
      } else {
        throw new Error('Open this source on the device before sending it to that location.');
      }
      toast({
        title: move ? 'Set moved' : 'Set copied',
        description: move
          ? `${item.name} was verified at ${capabilities.find((capability) => capability.id === destination)?.label} before the source copy was removed.`
          : `${item.name} is now available at ${capabilities.find((capability) => capability.id === destination)?.label}.`,
      });
      onChanged?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: move ? 'Set was not moved' : 'Set was not copied',
        description: error instanceof Error ? error.message : 'CardForge could not complete this location change. The source copy was left unchanged.',
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog}>
        <DialogHeader>
          <DialogTitle className={styles.title}>Save &amp; move {item?.name ?? 'Set'}</DialogTitle>
          <DialogDescription className={styles.description}>
            A move always writes and verifies the destination first. If verification fails, the source stays unchanged.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.defaultRow}>
          <div><strong>Default save location</strong><span>Used as the first destination when you save a Set.</span></div>
          <Select value={defaultLocation} onValueChange={(value) => { void changeDefault(value as WorkLocationId); }}>
            <SelectTrigger aria-label="Default save location" className={styles.defaultSelect}>
              <span>{capabilities.find((capability) => capability.id === defaultLocation)?.label ?? 'This device'}</span>
            </SelectTrigger>
            <SelectContent>
              {capabilities.map((capability) => <SelectItem key={capability.id} value={capability.id} disabled={!capability.available || !capability.create}>{capability.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className={styles.locationList}>
          {orderedCapabilities.map((capability) => {
            const Icon = locationIcon[capability.id];
            const isCurrent = item?.locations.some((location) => accountSourceToWorkLocation(location.source) === capability.id) ?? false;
            const copyAvailable = Boolean(source && canTransferWork({ source, destination: capability.id, capabilities }))
              && (source === 'device' || capability.id === 'device');
            const moveAvailable = copyAvailable && Boolean(source && canMoveWork({ source, destination: capability.id, capabilities }));
            return (
              <div key={capability.id} className={styles.locationRow} data-default={defaultLocation === capability.id}>
                <span className={styles.locationIcon}><Icon aria-hidden="true" /></span>
                <div className={styles.locationCopy}>
                  <strong>{capability.label}</strong>
                  <span>{isCurrent ? 'Current copy' : capability.available ? capability.revisionSafe ? 'Revision-safe provider copy' : 'User-owned portable copy' : capability.reason}</span>
                </div>
                <div className={styles.locationActions}>
                  {copyAvailable ? <Button type="button" size="sm" variant="outline" disabled={busyAction !== null} onClick={() => void transfer(capability.id, false)}>{busyAction === `${capability.id}:copy` ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}{isCurrent ? 'Update copy' : 'Copy here'}</Button> : null}
                  {moveAvailable ? <Button type="button" size="sm" disabled={busyAction !== null} onClick={() => void transfer(capability.id, true)}>{busyAction === `${capability.id}:move` ? <Loader2 className="animate-spin" aria-hidden="true" /> : <MoveRight aria-hidden="true" />}Move here</Button> : null}
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
