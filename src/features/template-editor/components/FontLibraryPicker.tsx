"use client";

import { useEffect, useMemo, useState } from 'react';
import { Type } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  LibraryPickerDialog,
  type LibraryPickerRequest,
  type LibraryPickerResource,
} from '@/features/library-picker/client';
import {
  chooseGoogleDrivePersonalLibraryItems,
  importPersonalLibraryFont,
  isPersonalLibraryFontMimeType,
  loadPersonalLibrary,
  type PersonalLibraryItem,
} from '@/features/personal-library/client';

interface FontLibraryPickerProps {
  availableFonts: readonly { value: string; name: string }[];
  targetId: string;
  onSelect: (fontValue: string) => void;
}

export function FontLibraryPicker({ availableFonts, targetId, onSelect }: FontLibraryPickerProps) {
  const [open, setOpen] = useState(false);
  const [personalItems, setPersonalItems] = useState<PersonalLibraryItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadPersonalLibrary()
      .then((library) => { if (!cancelled) setPersonalItems(library.items.filter((item) => (
        (item.role === 'font' || item.role === 'reference') && isPersonalLibraryFontMimeType(item.mimeType)
      ))); })
      .catch(() => { if (!cancelled) setPersonalItems([]); });
    return () => { cancelled = true; };
  }, []);

  const request = useMemo((): LibraryPickerRequest => ({
    purpose: 'template.font-family',
    title: 'Choose a font',
    description: 'Choose a built-in, reviewed, project, or connected font for this text.',
    acceptedKinds: ['font'],
    acceptedRoles: ['font', 'reference'],
    sources: ['project', 'personal', 'published', 'provider'],
    selectionMode: 'single',
    target: { kind: 'template-element', ids: [targetId] },
    requiresProjectMaterialization: false,
  }), [targetId]);
  const resources = useMemo((): LibraryPickerResource[] => [
    ...availableFonts.map((font) => {
      const source = font.value.startsWith('font-personal-') ? 'project' as const : 'published' as const;
      return {
        id: `${source}:${font.value}`,
        objectId: font.value,
        name: font.name,
        kind: 'font',
        role: 'font',
        source,
        sourceLabel: source === 'project' ? 'This project' : font.value.startsWith('font-contributor-') ? 'Contributor Library' : 'CardForge fonts',
        materialization: source === 'project' ? 'already-local' as const : 'reference' as const,
      };
    }),
    ...personalItems.map((item) => ({
      id: `personal:${item.id}:${item.providerRevision}`,
      objectId: item.id,
      name: item.displayName,
      kind: 'font',
      role: 'font',
      mimeType: item.mimeType,
      source: 'personal' as const,
      sourceLabel: 'My Library · Google Drive',
      materialization: 'project-copy' as const,
    })),
  ], [availableFonts, personalItems]);

  return (
    <>
      <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setOpen(true)}>
        <Type className="mr-2 h-4 w-4" aria-hidden="true" />Choose from Library
      </Button>
      <LibraryPickerDialog
        open={open}
        request={request}
        resources={resources}
        onOpenChange={setOpen}
        sourceActions={[{
          id: 'google-drive-font',
          label: 'Add fonts from Google Drive',
          description: 'Google Drive owns file selection. CardForge indexes the chosen files in My Library.',
          onInvoke: async () => {
            const result = await chooseGoogleDrivePersonalLibraryItems('font');
            if (!result) return;
            setPersonalItems((current) => {
              const byId = new Map(current.map((item) => [item.id, item]));
              result.items.forEach((item) => byId.set(item.id, item));
              return [...byId.values()].filter((item) => (
                (item.role === 'font' || item.role === 'reference') && isPersonalLibraryFontMimeType(item.mimeType)
              ));
            });
          },
        }]}
        onSelect={async (result) => {
          const selection = result.selections[0];
          if (!selection) return;
          if (selection.source === 'personal') {
            const item = personalItems.find((candidate) => candidate.id === selection.objectId);
            if (!item) throw new Error('That personal Library font is no longer available. Refresh the Picker and choose again.');
            onSelect((await importPersonalLibraryFont(item)).value);
            return;
          }
          onSelect(selection.objectId);
        }}
        renderPreview={(resource) => (
          <div className="flex h-16 items-center justify-center rounded bg-[#07090d] text-2xl" style={{ fontFamily: resource.objectId }} aria-hidden="true">Aa</div>
        )}
      />
    </>
  );
}
