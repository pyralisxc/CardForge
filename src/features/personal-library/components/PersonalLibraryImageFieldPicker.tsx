"use client";

import { useEffect, useMemo, useState } from 'react';
import { CloudDownload, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  loadPersonalLibrary,
  materializePersonalLibraryItemContent,
} from '../client/personalLibraryClient';
import type { PersonalLibraryItem } from '../model';

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string'
    ? resolve(reader.result)
    : reject(new Error('CardForge could not read the selected artwork.'));
  reader.onerror = () => reject(new Error('CardForge could not read the selected artwork.'));
  reader.readAsDataURL(blob);
});

export function PersonalLibraryImageFieldPicker({
  onSelect,
  label,
}: {
  onSelect: (dataUrl: string, item: PersonalLibraryItem) => void;
  label: string;
}) {
  const [items, setItems] = useState<PersonalLibraryItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadPersonalLibrary()
      .then((library) => {
        if (cancelled) return;
        setItems(library.items.filter((item) => (
          item.mimeType.startsWith('image/')
          && (item.role === 'artwork' || item.role === 'reference' || item.role === 'frame')
        )));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);
  if (items.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-1 gap-2 sm:max-w-md">
      <Select value={selectedId} onValueChange={(value) => { setSelectedId(value); setErrorMessage(null); }}>
        <SelectTrigger className="h-9 min-w-0 flex-1 text-xs" aria-label={`Choose ${label} from personal library`}>
          <SelectValue placeholder="My Library" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => <SelectItem key={item.id} value={item.id}>{item.displayName}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0"
        disabled={!selected || busy}
        onClick={() => {
          if (!selected) return;
          setBusy(true);
          setErrorMessage(null);
          void materializePersonalLibraryItemContent(selected)
            .then(async (content) => {
              onSelect(await blobToDataUrl(content.blob), selected);
            })
            .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load that artwork.'))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CloudDownload className="mr-1.5 h-4 w-4" />}
        Use
      </Button>
      {errorMessage ? <span className="sr-only" role="alert">{errorMessage}</span> : null}
    </div>
  );
}
