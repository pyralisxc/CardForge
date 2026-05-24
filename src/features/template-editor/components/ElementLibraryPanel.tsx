"use client";

import type { DragEvent as ReactDragEvent, ElementType } from 'react';
import { useMemo, useState } from 'react';
import { Image as ImageIcon, Search, Shapes } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { CardAssetOption } from '@/lib/cardAssets';
import {
  buildCardPartElementPreset,
  filterCardPartAssets,
  getCardPartPackName,
  getCardPartRoleLabel,
  getCardPartRoleOptions,
  type CardPartRole,
} from '@/lib/partAssetCatalog';
import type { FreeformCardElement } from '@/types';

interface ElementLibraryItem {
  label: string;
  description: string;
  icon: ElementType;
  type: FreeformCardElement['type'];
  preset?: Partial<FreeformCardElement>;
  dragKitIndex: number;
}

interface ElementLibrarySection {
  category: string;
  items: ElementLibraryItem[];
}

interface ElementLibraryPanelProps {
  sections: ElementLibrarySection[];
  partAssets: CardAssetOption[];
  onAddElement: (type: FreeformCardElement['type'], preset?: Partial<FreeformCardElement>) => void;
  panelClassName: string;
}

export function ElementLibraryPanel({
  sections,
  partAssets,
  onAddElement,
  panelClassName,
}: ElementLibraryPanelProps) {
  const [partSearch, setPartSearch] = useState('');
  const [partRole, setPartRole] = useState<CardPartRole | 'all'>('all');
  const partRoleOptions = useMemo(() => getCardPartRoleOptions(partAssets), [partAssets]);
  const filteredPartAssets = useMemo(
    () => filterCardPartAssets(partAssets, partSearch, partRole),
    [partAssets, partRole, partSearch],
  );

  const handleDragStart = (event: ReactDragEvent<HTMLButtonElement>, item: ElementLibraryItem) => {
    event.dataTransfer.setData('application/cardforge-element', item.type);
    event.dataTransfer.setData('application/cardforge-kit-index', String(item.dragKitIndex));
    if (item.preset) {
      event.dataTransfer.setData('application/cardforge-preset', JSON.stringify(item.preset));
    }
  };

  return (
    <Card className={cn(panelClassName, 'rounded-[8px]')}>
      <CardHeader className="p-2.5">
        <CardTitle className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b7bdc9]">
          <Shapes className="h-3.5 w-3.5 text-[#d5ad54]" /> Elements
        </CardTitle>
        <p className="pt-1 text-[10px] uppercase tracking-[0.12em] text-[#757d8c]">Primitives only; styles live in inspector</p>
      </CardHeader>
      <CardContent className="space-y-2 p-2.5 pt-0">
        {sections.map((section) => (
          <div key={section.category} className="space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#757d8c]">{section.category}</div>
            <div className="grid grid-cols-2 gap-1.5 2xl:grid-cols-3">
              {section.items.map((item) => (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      draggable
                      onDragStart={(event) => handleDragStart(event, item)}
                      onClick={() => onAddElement(item.type, item.preset)}
                      className="h-[54px] flex-col gap-1 rounded-[5px] border-[#2d3340] bg-[#111720] px-1 text-[#d8d1c4] hover:border-[#d5ad54]/80 hover:bg-[#171b24]"
                    >
                      <item.icon className="h-4 w-4 text-[#d5ad54]" />
                      <span className="max-w-full truncate text-[10px] leading-none">{item.label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-56">
                    <div className="space-y-1">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        ))}
        <div className="space-y-2 border-t border-[#1b2029] pt-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#757d8c]">Asset Catalog</div>
            <span className="rounded-[4px] border border-[#2d3340] px-1.5 py-0.5 text-[10px] text-[#8f95a3]">{filteredPartAssets.length}</span>
          </div>
          <div className="grid grid-cols-[1fr_112px] gap-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#757d8c]" />
              <Input
                value={partSearch}
                onChange={(event) => setPartSearch(event.target.value)}
                placeholder="Search parts"
                className="h-8 rounded-[4px] border-[#2d3340] bg-[#0d1117] pl-7 text-xs text-[#d8d1c4]"
              />
            </div>
            <Select value={partRole} onValueChange={(value) => setPartRole(value as CardPartRole | 'all')}>
              <SelectTrigger className="h-8 rounded-[4px] border-[#2d3340] bg-[#0d1117] text-xs text-[#d8d1c4]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {partRoleOptions.map((role) => (
                  <SelectItem key={role} value={role}>{getCardPartRoleLabel(role)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {partAssets.length === 0 ? (
            <div className="rounded-[5px] border border-dashed border-[#2d3340] bg-[#0b0f15] p-3 text-[11px] leading-relaxed text-[#8f95a3]">
              <p className="font-medium text-[#d8d1c4]">No project parts found.</p>
              <p className="mt-1 font-mono text-[10px] text-[#757d8c]">public/card-assets/parts/...</p>
            </div>
          ) : filteredPartAssets.length === 0 ? (
            <div className="rounded-[5px] border border-[#2d3340] bg-[#0b0f15] p-3 text-[11px] text-[#8f95a3]">
              No matching parts.
            </div>
          ) : (
            <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
              {filteredPartAssets.map((asset) => {
                const preset = buildCardPartElementPreset(asset);
                return (
                  <Tooltip key={asset.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => handleDragStart(event, {
                          label: asset.name,
                          description: getCardPartRoleLabel(asset.partRole),
                          icon: ImageIcon,
                          type: 'image',
                          preset,
                          dragKitIndex: -1,
                        })}
                        onClick={() => onAddElement('image', preset)}
                        className="group min-h-[116px] rounded-[5px] border border-[#2d3340] bg-[#0b0f15] p-1.5 text-left transition hover:border-[#d5ad54]/80 hover:bg-[#111720]"
                      >
                        <span
                          className="block h-16 rounded-[4px] border border-[#1f2530] bg-[#07090d] bg-contain bg-center bg-no-repeat"
                          style={{ backgroundImage: `url(${asset.url})` }}
                          aria-hidden="true"
                        />
                        <span className="mt-1 block truncate text-[10px] font-semibold text-[#d8d1c4] group-hover:text-[#f5d27b]">{asset.name}</span>
                        <span className="block truncate text-[9px] uppercase tracking-[0.12em] text-[#757d8c]">{getCardPartRoleLabel(asset.partRole)}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-56">
                      <div className="space-y-1">
                        <p className="font-medium">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">{getCardPartPackName(asset)} / {getCardPartRoleLabel(asset.partRole)}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
