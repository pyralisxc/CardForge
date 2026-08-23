"use client";

import { useMemo, useRef, useState } from 'react';
import {
  Cloud,
  CloudDownload,
  CloudUpload,
  Download,
  FolderPlus,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAccountEntitlement } from '@/features/account/client';
import { MAX_CLOUD_SET_BYTES, useCardTransferActions, useCloudSetActions, useProjectStore } from '@/features/project/client';

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

export function CardSetManager() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCloudLibrary, setShowCloudLibrary] = useState(false);
  const cardSets = useProjectStore((state) => state.cardSets);
  const activeCardSet = useProjectStore((state) => state.activeCardSet);
  const storedCards = useProjectStore((state) => state.storedCards);
  const createCardSet = useProjectStore((state) => state.createCardSet);
  const setActiveCardSetId = useProjectStore((state) => state.setActiveCardSetId);
  const { exportSet, handleImportTransfer } = useCardTransferActions({ toast });
  const { isSignedIn, isLoadingEntitlement, capabilities } = useAccountEntitlement();
  const {
    cloud,
    cloudBySetId,
    deletingSetId,
    isLoadingCloudSets,
    loadingSetId,
    removeCloudSet,
    saveSetToCloud,
    savingSetId,
    loadSetFromCloud,
  } = useCloudSetActions({ toast, enabled: isSignedIn && !isLoadingEntitlement });

  const cardCounts = useMemo(() => {
    const counts = new Map<string, number>();
    storedCards.forEach((card) => {
      if (card.setId) counts.set(card.setId, (counts.get(card.setId) ?? 0) + 1);
    });
    return counts;
  }, [storedCards]);

  const cloudLimit = cloud?.limit ?? capabilities.cloudSetLimit;
  const cloudUsed = cloud?.used ?? 0;
  const activeCloudSet = cloudBySetId.get(activeCardSet.id);
  const canSaveActiveSet = Boolean(activeCloudSet) || cloudUsed < cloudLimit;

  return (
    <div className="mb-4 rounded-md border bg-background/60 p-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-1">
          <Label htmlFor="card-set-selector">Working set</Label>
          <Select value={activeCardSet.id} onValueChange={setActiveCardSetId}>
            <SelectTrigger id="card-set-selector">
              <SelectValue placeholder="Choose a set" />
            </SelectTrigger>
            <SelectContent>
              {cardSets.map((set) => (
                <SelectItem key={set.id} value={set.id}>
                  {set.name} · {cardCounts.get(set.id) ?? 0} card{(cardCounts.get(set.id) ?? 0) === 1 ? '' : 's'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Sets always save in this browser. {isSignedIn
              ? `Cloud backup: ${cloudUsed}/${cloudLimit} set slot${cloudLimit === 1 ? '' : 's'} used; local sets stay unlimited.`
              : `Sign in to keep ${capabilities.cloudSetLimit} set backed up in your CardForge cloud library.`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button type="button" size="sm" variant="outline" onClick={() => createCardSet()}>
            <FolderPlus className="mr-2 h-4 w-4" /> New
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void exportSet(activeCardSet.id)}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeCloudSet ? 'secondary' : 'outline'}
            onClick={() => setShowCloudLibrary((value) => !value)}
          >
            <Cloud className="mr-2 h-4 w-4" /> Cloud
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Import CardForge card or set"
            onChange={handleImportTransfer}
          />
        </div>
      </div>

      {showCloudLibrary && (
        <div className="mt-3 border-t pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">CardForge cloud sets</p>
              <p className="text-xs text-muted-foreground">
                Local sets remain unlimited. Each cloud set can use up to {Math.round(MAX_CLOUD_SET_BYTES / 1024 / 1024)} MB including referenced artwork.
              </p>
            </div>
            {isSignedIn && (
              <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
                {cloudUsed} / {cloudLimit} used
              </span>
            )}
          </div>

          {!isSignedIn ? (
            <p className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Sign in to back up this set and load it from your CardForge account on another device.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{activeCardSet.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeCloudSet
                      ? `Cloud revision ${activeCloudSet.revision} · ${formatBytes(activeCloudSet.storageBytes)}`
                      : canSaveActiveSet
                        ? 'Device only · ready for a cloud slot'
                        : `Device only · all ${cloudLimit} cloud slots are already used`}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={Boolean(savingSetId) || isLoadingCloudSets}
                  onClick={() => void saveSetToCloud(activeCardSet.id)}
                >
                  {savingSetId === activeCardSet.id
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <CloudUpload className="mr-2 h-4 w-4" />}
                  {activeCloudSet ? 'Update cloud' : canSaveActiveSet ? 'Back up set' : 'Cloud full — review'}
                </Button>
              </div>

              {isLoadingCloudSets ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading cloud library…
                </div>
              ) : cloud?.sets.length ? (
                <div className="space-y-2">
                  {cloud.sets.map((summary) => (
                    <div key={summary.setId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{summary.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {summary.cardCount} card{summary.cardCount === 1 ? '' : 's'} · revision {summary.revision} · {formatBytes(summary.storageBytes)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={Boolean(loadingSetId)}
                          onClick={() => void loadSetFromCloud(summary.setId)}
                        >
                          {loadingSetId === summary.setId
                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            : <CloudDownload className="mr-2 h-4 w-4" />}
                          Load
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={Boolean(deletingSetId)}
                          onClick={() => {
                            if (window.confirm(`Remove the cloud backup for “${summary.name}”? Local copies on your devices will not be deleted.`)) {
                              void removeCloudSet(summary.setId);
                            }
                          }}
                        >
                          {deletingSetId === summary.setId
                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            : <Trash2 className="mr-2 h-4 w-4" />}
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No cloud sets yet. Back up the current set to use your first slot.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
