"use client";

import { useEffect, useState } from 'react';
import { CloudDownload, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PersonalLibraryItem } from '@/features/personal-library/client';

export function ConnectedPersonalAssetImport({
  items,
  busyItemId,
  label,
  onImport,
}: {
  items: PersonalLibraryItem[];
  busyItemId: string | null;
  label: string;
  onImport: (item: PersonalLibraryItem) => Promise<unknown>;
}) {
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    if (selectedId && !items.some((item) => item.id === selectedId)) setSelectedId('');
  }, [items, selectedId]);

  if (items.length === 0) return null;
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const busy = Boolean(busyItemId);

  return (
    <div className="mb-3 rounded-[6px] border border-[var(--cf-editor-border)] bg-[#0a0e14] p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a1]">My connected library</p>
      <div className="mt-2 flex gap-2">
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="h-8 min-w-0 flex-1 text-xs" aria-label={`Choose connected ${label}`}>
            <SelectValue placeholder={`Choose ${label}`} />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>{item.displayName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2 text-xs"
          disabled={!selected || busy}
          onClick={() => {
            if (selected) void onImport(selected);
          }}
        >
          {busyItemId === selected?.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CloudDownload className="mr-1.5 h-3.5 w-3.5" />}
          Import
        </Button>
      </div>
      <p className="mt-1.5 text-[10px] leading-4 text-[#717987]">The source stays in your provider. Importing makes a portable local copy for this CardForge workspace.</p>
    </div>
  );
}
