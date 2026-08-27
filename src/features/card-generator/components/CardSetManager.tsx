"use client";

import { useMemo, useRef } from 'react';
import { Download, FolderPlus, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useCardTransferActions, useProjectStore } from '@/features/project/client';

export function CardSetManager() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardSets = useProjectStore((state) => state.cardSets);
  const activeCardSet = useProjectStore((state) => state.activeCardSet);
  const storedCards = useProjectStore((state) => state.storedCards);
  const createCardSet = useProjectStore((state) => state.createCardSet);
  const setActiveCardSetId = useProjectStore((state) => state.setActiveCardSetId);
  const { exportSet, handleImportTransfer } = useCardTransferActions({ toast });

  const cardCounts = useMemo(() => {
    const counts = new Map<string, number>();
    storedCards.forEach((card) => {
      if (card.setId) counts.set(card.setId, (counts.get(card.setId) ?? 0) + 1);
    });
    return counts;
  }, [storedCards]);

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
            Sets save in this browser. Export an editable Set or save a portable project to keep durable copies elsewhere.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => createCardSet()}>
            <FolderPlus className="mr-2 h-4 w-4" /> New
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void exportSet(activeCardSet.id)}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Import
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
    </div>
  );
}
