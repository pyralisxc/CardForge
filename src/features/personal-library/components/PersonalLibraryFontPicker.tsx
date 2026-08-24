"use client";

import { useEffect, useMemo, useState } from 'react';
import { CloudDownload, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { importPersonalLibraryFont } from '../client/importPersonalLibraryFont';
import { loadPersonalLibrary } from '../client/personalLibraryClient';
import type { PersonalLibraryItem } from '../model';

export function PersonalLibraryFontPicker({
  onSelect,
}: {
  onSelect: (fontValue: string, item: PersonalLibraryItem) => void;
}) {
  const [items, setItems] = useState<PersonalLibraryItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadPersonalLibrary()
      .then((library) => {
        if (!cancelled) setItems(library.items.filter((item) => item.role === 'font'));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);
  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">My Library fonts</p>
      <div className="flex min-w-0 gap-2">
        <Select value={selectedId} onValueChange={(value) => { setSelectedId(value); setErrorMessage(null); }}>
          <SelectTrigger className="h-9 min-w-0 flex-1 text-xs" aria-label="Choose font from personal library">
            <SelectValue placeholder="Choose a connected font" />
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
            void importPersonalLibraryFont(selected)
              .then((font) => onSelect(font.value, selected))
              .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load that font.'))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CloudDownload className="mr-1.5 h-4 w-4" />}
          Use
        </Button>
      </div>
      {errorMessage ? <p className="text-[11px] leading-4 text-red-300" role="alert">{errorMessage}</p> : null}
    </div>
  );
}
