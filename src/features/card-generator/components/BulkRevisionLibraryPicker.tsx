"use client";

import { useEffect, useMemo, useState } from 'react';
import { Images } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  createLibraryPickerAssignments,
  toLocalLibraryPickerResources,
  LibraryPickerDialog,
  type LibraryPickerRequest,
  type LibraryPickerResource,
} from '@/features/library-picker/client';
import type { CardAssetOption } from '@/features/pipeline/client/assets';
import { loadCardForgeStudioAssets } from '@/features/pipeline/client/catalog';
import {
  chooseGoogleDrivePersonalLibraryItems,
  importPersonalLibraryItemToLocalAsset,
  isPersonalLibraryVisualPickerItem,
  loadPersonalLibrary,
  type PersonalLibraryItem,
} from '@/features/personal-library/client';
import { ProjectBinaryAssetBackground } from '@/features/project/client/binary-assets';
import { LocalLibraryResourcePreview, readLocalLibraryResources, resolveLocalLibrarySelectionValue, type LocalLibraryResource } from '@/features/project/client/library-resources';
import type { DisplayCard } from '@/domain/rendering';
import { buildBulkResourceRevisionPlan, type BulkRevisionPlan } from '@/features/card-generator/lib/bulkRevision';

interface BulkRevisionLibraryPickerProps {
  currentCards: readonly DisplayCard[];
  fieldKey: string;
  fieldLabel: string;
  targetIds: readonly string[];
  onPlan: (plan: BulkRevisionPlan) => void;
}

const sourceForAsset = (asset: CardAssetOption): LibraryPickerResource['source'] => (
  asset.librarySource === 'local' ? 'project' : asset.librarySource === 'contributor' ? 'pipeline' : 'published'
);

export function BulkRevisionLibraryPicker({ currentCards, fieldKey, fieldLabel, targetIds, onPlan }: BulkRevisionLibraryPickerProps) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<CardAssetOption[]>([]);
  const [personalItems, setPersonalItems] = useState<PersonalLibraryItem[]>([]);
  const [localResources, setLocalResources] = useState<LocalLibraryResource[]>([]);
  const [localFailure, setLocalFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLocalResources([]);
    void Promise.all([
      readLocalLibraryResources(),
      loadCardForgeStudioAssets().then((result) => result.assets.imageAssets ?? []).catch(() => []),
      loadPersonalLibrary().then((result) => result.items).catch(() => []),
    ]).then(([localResult, sharedAssets, items]) => {
      if (cancelled) return;
      setLocalResources(localResult.resources.filter((resource) => resource.collection === 'image'));
      const failure = localResult.failures.find((item) => item.collection === 'image');
      setLocalFailure(failure ? 'Local pictures are unavailable. Retry the local Library source.' : null);
      setAssets(sharedAssets);
      setPersonalItems(items.filter((item) => isPersonalLibraryVisualPickerItem(
        item,
        ['artwork', 'frame', 'reference'],
      )));
    });
    return () => { cancelled = true; };
  }, [open]);

  const request = useMemo((): LibraryPickerRequest => ({
    purpose: 'artifact.bulk-revision.image-field',
    title: `Replace ${fieldLabel}`,
    description: (targetIds.length === 1
      ? 'Choose one Library picture for the selected Artifact.'
      : `Choose one picture for all ${targetIds.length} selected Artifacts, or choose exactly ${targetIds.length} pictures to map them in selection order.`) + (localFailure ? ` ${localFailure}` : ''),
    acceptedKinds: ['image'],
    acceptedRoles: ['artwork', 'frame', 'reference'],
    sources: ['project', 'personal', 'pipeline', 'published', 'provider'],
    selectionMode: 'multiple',
    target: { kind: 'Artifact', ids: targetIds },
    requiresProjectMaterialization: false,
  }), [fieldLabel, localFailure, targetIds]);
  const resources = useMemo((): LibraryPickerResource[] => [
    ...toLocalLibraryPickerResources(localResources),
    ...assets.map((asset) => {
      const source = sourceForAsset(asset);
      return {
        id: `${source}:${asset.id}`,
        objectId: asset.id,
        name: asset.name,
        kind: 'image',
        role: 'artwork',
        source,
        sourceLabel: source === 'project' ? 'This project' : source === 'pipeline' ? 'Contributor Library' : 'CardForge Library',
        previewUrl: asset.url,
        materialization: source === 'project' ? 'already-local' as const : 'reference' as const,
      };
    }),
    ...personalItems.map((item) => ({
      id: `personal:${item.id}:${item.providerRevision}`,
      objectId: item.id,
      name: item.displayName,
      kind: 'image',
      role: item.role,
      mimeType: item.mimeType,
      source: 'personal' as const,
      sourceLabel: 'My Library · Google Drive',
      materialization: 'project-copy' as const,
    })),
  ], [assets, localResources, personalItems]);

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={!targetIds.length} onClick={() => setOpen(true)}>
        <Images className="mr-1.5 h-4 w-4" aria-hidden="true" />Choose Library pictures
      </Button>
      <LibraryPickerDialog
        open={open}
        request={request}
        resources={resources}
        onOpenChange={setOpen}
        sourceActions={[{
          id: 'refresh-local-pictures',
          label: localFailure ? 'Retry local pictures' : 'Refresh local pictures',
          description: localFailure ?? 'Reload local artwork from this browser workspace.',
          onInvoke: async () => {
            const result = await readLocalLibraryResources();
            const failure = result.failures.find((item) => item.collection === 'image');
            if (failure) {
              setLocalFailure('Local pictures are unavailable. Retry the local Library source.');
              setLocalResources((current) => current.map((resource) => ({ ...resource, status: 'unavailable' })));
              throw failure.error;
            }
            setLocalResources(result.resources.filter((resource) => resource.collection === 'image'));
            setLocalFailure(null);
          },
        }, {
          id: 'google-drive-artwork',
          label: 'Add pictures from Google Drive',
          description: 'Google Drive owns file selection. CardForge indexes the chosen files in My Library.',
          onInvoke: async () => {
            const result = await chooseGoogleDrivePersonalLibraryItems('artwork');
            if (!result) return;
            setPersonalItems((current) => {
              const byId = new Map(current.map((item) => [item.id, item]));
              result.items
                .filter((item) => isPersonalLibraryVisualPickerItem(item, ['artwork', 'frame', 'reference']))
                .forEach((item) => byId.set(item.id, item));
              return [...byId.values()];
            });
          },
        }]}
        onSelect={async (result) => {
          const values = new Map<string, string>();
          for (const selection of result.selections) {
            if (selection.source === 'project') {
              values.set(selection.id, await resolveLocalLibrarySelectionValue(localResources, selection.id));
            } else if (selection.source === 'personal') {
              const item = personalItems.find((candidate) => candidate.id === selection.objectId);
              if (!item) throw new Error('A selected personal Library picture is no longer available. Refresh the Picker and choose again.');
              values.set(selection.id, (await importPersonalLibraryItemToLocalAsset(item)).url);
            } else {
              const asset = assets.find((candidate) => candidate.id === selection.objectId);
              if (!asset) throw new Error('A selected Library picture is no longer available. Refresh the Picker and choose again.');
              values.set(selection.id, asset.url);
            }
          }
          const assignments = createLibraryPickerAssignments(result).map(({ targetId, selection }) => ({
            targetId,
            value: values.get(selection.id)!,
          }));
          onPlan(buildBulkResourceRevisionPlan({ existing: currentCards, fieldKey, assignments }));
        }}
        renderPreview={(resource) => resource.source === 'project' && localResources.find((item) => item.id === resource.id) ? (
          <LocalLibraryResourcePreview resource={localResources.find((item) => item.id === resource.id)!} className="block h-16 w-full rounded object-contain" />
        ) : resource.previewUrl ? (
          <ProjectBinaryAssetBackground source={resource.previewUrl} className="block h-16 rounded bg-[#07090d] bg-contain bg-center bg-no-repeat" />
        ) : undefined}
      />
    </>
  );
}
