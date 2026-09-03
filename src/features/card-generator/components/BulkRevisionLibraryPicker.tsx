"use client";

import { useEffect, useMemo, useState } from 'react';
import { Images } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  createLibraryPickerAssignments,
  LibraryPickerDialog,
  type LibraryPickerRequest,
  type LibraryPickerResource,
} from '@/features/library-picker/client';
import type { CardAssetOption } from '@/features/pipeline/client/assets';
import { loadCardForgeStudioAssets } from '@/features/pipeline/client/catalog';
import {
  chooseGoogleDrivePersonalLibraryItems,
  importPersonalLibraryItemToLocalAsset,
  loadPersonalLibrary,
  type PersonalLibraryItem,
} from '@/features/personal-library/client';
import { getProjectAssetStorage, readTypedProjectAssetListFromStorage } from '@/features/project/client/assets';
import { ProjectBinaryAssetBackground } from '@/features/project/client/binary-assets';
import { CUSTOM_IMAGE_ASSETS_STORAGE_KEY } from '@/features/project/client/package-document';
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

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      readTypedProjectAssetListFromStorage<CardAssetOption>(getProjectAssetStorage(), CUSTOM_IMAGE_ASSETS_STORAGE_KEY).catch(() => []),
      loadCardForgeStudioAssets().then((result) => result.assets.imageAssets ?? []).catch(() => []),
      loadPersonalLibrary().then((result) => result.items).catch(() => []),
    ]).then(([localAssets, sharedAssets, items]) => {
      if (cancelled) return;
      const byId = new Map([...sharedAssets, ...localAssets].map((asset) => [asset.id, asset]));
      setAssets([...byId.values()]);
      setPersonalItems(items.filter((item) => item.role === 'artwork' || item.role === 'frame' || item.role === 'reference'));
    });
    return () => { cancelled = true; };
  }, []);

  const request = useMemo((): LibraryPickerRequest => ({
    purpose: 'artifact.bulk-revision.image-field',
    title: `Replace ${fieldLabel}`,
    description: targetIds.length === 1
      ? 'Choose one Library picture for the selected Artifact.'
      : `Choose one picture for all ${targetIds.length} selected Artifacts, or choose exactly ${targetIds.length} pictures to map them in selection order.`,
    acceptedKinds: ['image'],
    acceptedRoles: ['artwork', 'frame', 'reference'],
    sources: ['project', 'personal', 'pipeline', 'published', 'provider'],
    selectionMode: 'multiple',
    target: { kind: 'Artifact', ids: targetIds },
    requiresProjectMaterialization: false,
  }), [fieldLabel, targetIds]);
  const resources = useMemo((): LibraryPickerResource[] => [
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
  ], [assets, personalItems]);

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
          id: 'google-drive-artwork',
          label: 'Add pictures from Google Drive',
          description: 'Google Drive owns file selection. CardForge indexes the chosen files in My Library.',
          onInvoke: async () => {
            const result = await chooseGoogleDrivePersonalLibraryItems('artwork');
            if (!result) return;
            setPersonalItems((current) => {
              const byId = new Map(current.map((item) => [item.id, item]));
              result.items.forEach((item) => byId.set(item.id, item));
              return [...byId.values()];
            });
          },
        }]}
        onSelect={async (result) => {
          const values = new Map<string, string>();
          for (const selection of result.selections) {
            if (selection.source === 'personal') {
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
        renderPreview={(resource) => resource.previewUrl ? (
          <ProjectBinaryAssetBackground source={resource.previewUrl} className="block h-16 rounded bg-[#07090d] bg-contain bg-center bg-no-repeat" />
        ) : undefined}
      />
    </>
  );
}
