"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PackageOpen, Pencil, Search, Trash2 } from 'lucide-react';

import { CardPreview } from '@/features/card-rendering/client';
import { CardWatermarkOverlay } from '@/features/card-rendering/client';
import { ExportCardImageButton } from '@/features/card-generator/components/ExportCardImageButton';
import { ExportCardTransferButton } from '@/features/card-generator/components/ExportCardTransferButton';
import { ShareCardButton } from '@/features/card-generator/components/ShareCardButton';
import {
  resolveGeneratedGalleryColumnCount,
  type GeneratedGalleryColumns,
} from '@/features/card-generator/lib/generatedGalleryLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { CardFace } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import type { ExportMode } from '@/features/card-generator/lib/printValidation';
import { hasCardBacking, type DisplayCard } from '@/domain/rendering';

export type GeneratedGallerySort = 'default' | 'name-asc' | 'name-desc' | 'template';
type GeneratedGalleryDensity = 'compact' | 'comfortable' | 'large';

interface GeneratedCardGalleryProps {
  templates: TCGCardTemplate[];
  generatorSelectedTemplateId: string | null;
  generatedDisplayCards: DisplayCard[];
  gallerySearch: string;
  gallerySort: GeneratedGallerySort;
  exportMode: ExportMode;
  exportDpi: number;
  richTextHighlightColor: string;
  canExportClean: boolean;
  showPreviewWatermark: boolean;
  onGallerySearchChange: (value: string) => void;
  onGallerySortChange: (value: GeneratedGallerySort) => void;
  onEditCardRequest: (card: DisplayCard) => void;
  onRemoveCard: (card: DisplayCard) => void;
}

const GALLERY_GRID_GAP_PX = 12;

const GALLERY_DENSITY_OPTIONS: Record<GeneratedGalleryDensity, { label: string; previewWidthPx: number; gridMinWidthPx: number; rowHeightPx: number }> = {
  compact: { label: 'Small cards', previewWidthPx: 150, gridMinWidthPx: 220, rowHeightPx: 304 },
  comfortable: { label: 'Medium cards', previewWidthPx: 190, gridMinWidthPx: 260, rowHeightPx: 360 },
  large: { label: 'Large cards', previewWidthPx: 240, gridMinWidthPx: 320, rowHeightPx: 440 },
};

const GALLERY_COLUMN_OPTIONS: Array<{ value: GeneratedGalleryColumns; label: string }> = [
  { value: 'auto', label: 'Auto fit' },
  { value: '2', label: '2 per row' },
  { value: '3', label: '3 per row' },
  { value: '4', label: '4 per row' },
  { value: '6', label: '6 per row' },
];

export function GeneratedCardGallery({
  templates,
  generatorSelectedTemplateId,
  generatedDisplayCards,
  gallerySearch,
  gallerySort,
  exportMode,
  exportDpi,
  richTextHighlightColor,
  canExportClean,
  showPreviewWatermark,
  onGallerySearchChange,
  onGallerySortChange,
  onEditCardRequest,
  onRemoveCard,
}: GeneratedCardGalleryProps) {
  const [galleryDensity, setGalleryDensity] = useState<GeneratedGalleryDensity>('comfortable');
  const [galleryColumns, setGalleryColumns] = useState<GeneratedGalleryColumns>('auto');
  const [previewFace, setPreviewFace] = useState<CardFace>('front');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const scrollParentRef = useRef<HTMLDivElement | null>(null);
  const gridMeasureRef = useRef<HTMLDivElement | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const selectedTemplate = generatorSelectedTemplateId
    ? templates.find((template) => template.id === generatorSelectedTemplateId)
    : undefined;

  const filteredSortedCards = useMemo(() => (
    generatedDisplayCards
      .filter((card) => {
        if (!gallerySearch.trim()) return true;
        const query = gallerySearch.toLowerCase();
        return (
          card.template.name?.toLowerCase().includes(query) ||
          Object.values(card.data).some((value) => String(value).toLowerCase().includes(query)) ||
          Object.values(card.backingData ?? {}).some((value) => String(value).toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        if (gallerySort === 'name-asc') return String(a.data.cardName || a.data.name || '').localeCompare(String(b.data.cardName || b.data.name || ''));
        if (gallerySort === 'name-desc') return String(b.data.cardName || b.data.name || '').localeCompare(String(a.data.cardName || a.data.name || ''));
        if (gallerySort === 'template') return (a.template.name || '').localeCompare(b.template.name || '');
        return 0;
      })
  ), [gallerySearch, gallerySort, generatedDisplayCards]);

  const densityConfig = GALLERY_DENSITY_OPTIONS[galleryDensity];
  const hasBackedCards = useMemo(
    () => generatedDisplayCards.some(hasCardBacking),
    [generatedDisplayCards]
  );
  const visiblePreviewFace: CardFace = hasBackedCards ? previewFace : 'front';
  const columnCount = resolveGeneratedGalleryColumnCount({
    availableWidth: gridWidth,
    minimumItemWidth: densityConfig.gridMinWidthPx,
    gap: GALLERY_GRID_GAP_PX,
    requestedColumns: galleryColumns,
    itemCount: filteredSortedCards.length,
  });
  const rowCount = Math.ceil(filteredSortedCards.length / columnCount);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => densityConfig.rowHeightPx,
    overscan: 3,
  });

  useEffect(() => {
    const element = gridMeasureRef.current;
    if (!element) return;
    const updateGridWidth = () => setGridWidth(element.clientWidth);
    updateGridWidth();
    const resizeObserver = new ResizeObserver(updateGridWidth);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [generatedDisplayCards.length]);

  useEffect(() => {
    virtualizer.scrollToIndex(0);
  }, [galleryDensity, gallerySearch, gallerySort, generatedDisplayCards.length, virtualizer]);

  const virtualRows = virtualizer.getVirtualItems();
  const hasRepeatedExportButtons = filteredSortedCards.length > 1;

  return (
    <div>
      <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center justify-between gap-3 bg-background pb-2">
        <h2 className="min-w-0 text-xl font-semibold text-foreground sm:text-2xl">
          Cards in This Set ({generatedDisplayCards.length})
          {selectedTemplate && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">- {selectedTemplate.name}</span>
          )}
        </h2>
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <div className="relative col-span-2 min-w-0 sm:col-span-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search cards..." value={gallerySearch} onChange={(event) => onGallerySearchChange(event.target.value)} className="h-10 w-full pl-8 text-sm sm:h-8 sm:w-40" />
          </div>
          <Select value={gallerySort} onValueChange={(value) => onGallerySortChange(value as GeneratedGallerySort)}>
            <SelectTrigger className="h-10 w-full text-sm sm:h-8 sm:w-36" aria-label="Sort gallery"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Order added</SelectItem>
              <SelectItem value="name-asc">Name A-Z</SelectItem>
              <SelectItem value="name-desc">Name Z-A</SelectItem>
              <SelectItem value="template">By Template</SelectItem>
            </SelectContent>
          </Select>
          <Select value={galleryDensity} onValueChange={(value) => setGalleryDensity(value as GeneratedGalleryDensity)}>
            <SelectTrigger className="h-10 w-full text-sm sm:h-8 sm:w-36" aria-label="Card size in this set"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(GALLERY_DENSITY_OPTIONS).map(([value, option]) => <SelectItem key={value} value={value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={galleryColumns} onValueChange={(value) => setGalleryColumns(value as GeneratedGalleryColumns)}>
            <SelectTrigger className="col-span-2 h-10 w-full text-sm sm:col-span-1 sm:h-8 sm:w-32" aria-label="Cards per row in this set"><SelectValue /></SelectTrigger>
            <SelectContent>{GALLERY_COLUMN_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <div className="col-span-2 flex h-10 items-center rounded-md border bg-background p-1 sm:col-span-1 sm:h-8" role="group" aria-label="Preview card face">
            {(['front', 'back'] as const).map((face) => (
              <Button key={face} type="button" size="sm" variant={visiblePreviewFace === face ? 'secondary' : 'ghost'} className="h-full flex-1 px-3 text-xs capitalize" disabled={face === 'back' && !hasBackedCards} aria-pressed={visiblePreviewFace === face} onClick={() => setPreviewFace(face)}>
                {face}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {generatedDisplayCards.length === 0 ? (
        <div className="flex h-[calc(100vh-300px)] flex-col items-center justify-center rounded-md border bg-card/30 p-8 text-center text-muted-foreground shadow-inner">
          <PackageOpen className="mb-4 h-16 w-16 text-primary/70" />
          <p className="text-lg font-medium">Your set is ready for its first card.</p>
          <p className="text-sm">Make one card or add a list above. Every card will appear here so you can review and edit it before downloading the set.</p>
        </div>
      ) : (
        <div ref={scrollParentRef} data-testid="generated-gallery-scroll" className="h-[calc(100vh-250px)] overflow-auto rounded-md border bg-card/30 p-4 shadow-inner">
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md border bg-background/80 px-3 py-2 text-xs text-muted-foreground">
            <span>Showing {filteredSortedCards.length} matching cards{filteredSortedCards.length !== generatedDisplayCards.length ? ` (${generatedDisplayCards.length} in this set)` : ''}</span>
            <span>{columnCount} per row</span>
            <span className="capitalize">Viewing {visiblePreviewFace}s</span>
          </div>
          <div ref={gridMeasureRef}>
            <div className="relative" style={{ height: `${virtualizer.getTotalSize()}px` }}>
              {virtualRows.map((virtualRow) => {
                const rowStart = virtualRow.index * columnCount;
                const rowCards = filteredSortedCards.slice(rowStart, rowStart + columnCount);
                return (
                  <div key={virtualRow.key} ref={virtualizer.measureElement} data-index={virtualRow.index} className="absolute left-0 top-0 grid w-full gap-3" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(${densityConfig.gridMinWidthPx}px, 1fr))`, transform: `translateY(${virtualRow.start}px)` }}>
                    {rowCards.map((cardItem, cardIndex) => {
                      const isSelected = selectedCardId === cardItem.uniqueId;
                      return (
                        <div key={cardItem.uniqueId} className={`rounded-md p-1 transition-shadow ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`} data-selected={isSelected ? 'true' : 'false'}>
                          <div className="relative mx-auto w-fit">
                            <CardPreview card={cardItem} face={visiblePreviewFace} isPrintMode={false} highlightColor={richTextHighlightColor} className="mx-auto" showSizeInfo={rowStart + cardIndex === 0} onSelect={(card) => setSelectedCardId(card.uniqueId)} onEdit={onEditCardRequest} targetWidthPx={densityConfig.previewWidthPx} />
                            {showPreviewWatermark ? <CardWatermarkOverlay /> : null}
                          </div>
                          <div data-testid="generated-card-action-rail" className={`mx-auto mt-2 flex min-h-12 w-full items-center gap-1 rounded-md border border-border/80 bg-background/95 p-1 shadow-sm ${isSelected ? '' : 'invisible'}`} style={{ maxWidth: `${densityConfig.gridMinWidthPx}px` }} aria-label={isSelected ? `Actions for card ${rowStart + cardIndex + 1}` : undefined}>
                            {isSelected ? (
                              <>
                                <Button type="button" variant="secondary" size="sm" className="h-10 min-w-0 flex-1 gap-1 px-2 text-xs" onClick={(event) => { event.stopPropagation(); onEditCardRequest(cardItem); }} aria-label={hasRepeatedExportButtons ? `Edit card ${rowStart + cardIndex + 1}` : 'Edit card'}>
                                  <Pencil className="h-3.5 w-3.5" /> Edit card
                                </Button>
                                <ShareCardButton card={cardItem} exportMode={exportMode} exportDpi={exportDpi} richTextHighlightColor={richTextHighlightColor} ariaLabel={hasRepeatedExportButtons ? `Share card ${rowStart + cardIndex + 1}` : undefined} />
                                <ExportCardImageButton card={cardItem} exportMode={exportMode} exportDpi={exportDpi} richTextHighlightColor={richTextHighlightColor} canExportClean={canExportClean} disabled={false} iconOnly ariaLabel={hasRepeatedExportButtons ? `Download card ${rowStart + cardIndex + 1}` : 'Download individual card'} />
                                <ExportCardTransferButton cardUniqueId={cardItem.uniqueId} ariaLabel={hasRepeatedExportButtons ? `Export editable card ${rowStart + cardIndex + 1}` : 'Export editable card'} />
                                <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={(event) => { event.stopPropagation(); onRemoveCard(cardItem); }} aria-label={`Remove card ${rowStart + cardIndex + 1}`} title="Remove card">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
