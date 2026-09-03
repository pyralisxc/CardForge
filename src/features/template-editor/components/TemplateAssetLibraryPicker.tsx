"use client";

import { useMemo, useState } from 'react';
import { FolderOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  LibraryPickerDialog,
  type LibraryPickerRequest,
  type LibraryPickerResource,
} from '@/features/library-picker/client';
import type { CardAssetOption } from '@/features/pipeline/client/assets';
import type { PersonalLibraryItem, PersonalLibraryRole } from '@/features/personal-library/client';
import { ProjectBinaryAssetBackground } from '@/features/project/client/binary-assets';

type TemplateAssetPickerKind = 'image' | 'frame' | 'icon' | 'texture' | 'divider';

interface TemplateAssetLibraryPickerProps {
  assets: readonly CardAssetOption[];
  kind: TemplateAssetPickerKind;
  label: string;
  personalItems: readonly PersonalLibraryItem[];
  personalRoles: readonly PersonalLibraryRole[];
  providerRole: PersonalLibraryRole;
  target: LibraryPickerRequest['target'];
  onAddFromProvider: (role: PersonalLibraryRole) => Promise<void>;
  onApply: (asset: CardAssetOption) => void;
  onMaterializePersonal: (item: PersonalLibraryItem) => Promise<CardAssetOption>;
}

const pickerSourceForAsset = (asset: CardAssetOption): LibraryPickerResource['source'] => (
  asset.librarySource === 'local'
    ? 'project'
    : asset.librarySource === 'contributor'
      ? 'pipeline'
      : 'published'
);

const sourceLabelForAsset = (asset: CardAssetOption): string => {
  const source = pickerSourceForAsset(asset);
  return source === 'project' ? 'This project' : source === 'pipeline' ? 'Contributor Library' : 'CardForge Library';
};

export function TemplateAssetLibraryPicker({
  assets,
  kind,
  label,
  personalItems,
  personalRoles,
  providerRole,
  target,
  onAddFromProvider,
  onApply,
  onMaterializePersonal,
}: TemplateAssetLibraryPickerProps) {
  const [open, setOpen] = useState(false);
  const request = useMemo((): LibraryPickerRequest => ({
    purpose: `template.${kind}-source`,
    title: `Choose ${label}`,
    description: `Choose compatible ${label.toLocaleLowerCase()} from this project, your connected Library, or reviewed CardForge sources.`,
    acceptedKinds: [kind],
    acceptedRoles: personalRoles,
    sources: ['project', 'personal', 'pipeline', 'published', 'provider'],
    selectionMode: 'single',
    target,
    requiresProjectMaterialization: false,
  }), [kind, label, personalRoles, target]);
  const resources = useMemo((): LibraryPickerResource[] => [
    ...assets.map((asset) => {
      const source = pickerSourceForAsset(asset);
      return {
        id: `${source}:${asset.id}`,
        objectId: asset.id,
        name: asset.name,
        kind,
        role: personalRoles[0],
        source,
        sourceLabel: sourceLabelForAsset(asset),
        previewUrl: asset.url,
        materialization: source === 'project' ? 'already-local' as const : 'reference' as const,
      };
    }),
    ...personalItems
      .filter((item) => personalRoles.includes(item.role))
      .map((item) => ({
        id: `personal:${item.id}:${item.providerRevision}`,
        objectId: item.id,
        name: item.displayName,
        kind,
        role: item.role,
        mimeType: item.mimeType,
        source: 'personal' as const,
        sourceLabel: 'My Library · Google Drive',
        revision: Number.isFinite(Number(item.providerRevision)) ? Number(item.providerRevision) : undefined,
        materialization: 'project-copy' as const,
      })),
  ], [assets, kind, personalItems, personalRoles]);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FolderOpen className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Choose from Library
      </Button>
      <LibraryPickerDialog
        open={open}
        request={request}
        resources={resources}
        onOpenChange={setOpen}
        sourceActions={[{
          id: `google-drive-${providerRole}`,
          label: `Add ${label.toLocaleLowerCase()} from Google Drive`,
          description: 'Google Drive owns file selection. CardForge indexes the chosen file in My Library.',
          onInvoke: () => onAddFromProvider(providerRole),
        }]}
        onSelect={async (result) => {
          const selection = result.selections[0];
          if (!selection) return;
          if (selection.source === 'personal') {
            const item = personalItems.find((candidate) => candidate.id === selection.objectId);
            if (!item) throw new Error('That personal Library item is no longer available. Refresh the Picker and choose again.');
            onApply(await onMaterializePersonal(item));
            return;
          }
          const asset = assets.find((candidate) => candidate.id === selection.objectId);
          if (!asset) throw new Error('That Library resource is no longer available. Refresh the Picker and choose again.');
          onApply(asset);
        }}
        renderPreview={(resource) => resource.previewUrl ? (
          <ProjectBinaryAssetBackground
            source={resource.previewUrl}
            className="block h-16 rounded bg-[#07090d] bg-contain bg-center bg-no-repeat"
          />
        ) : undefined}
      />
    </>
  );
}
