"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PackageOpen, Search, Trash2 } from 'lucide-react';

import { CardPreview } from '@/features/card-rendering/client';
import { CardWatermarkOverlay } from '@/features/card-rendering/client';
import { ExportCardImageButton } from '@/features/card-generator/components/ExportCardImageButton';
import { ShareCardButton } from '@/features/card-generator/components/ShareCardButton';
import {
  resolveGeneratedGalleryColumnCount,
  type GeneratedGalleryColumns,
} from '@/features/card-generator/lib/generatedGalleryLayout';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { TCGCardTemplate } from '@/domain/templates';
import type { ExportMode } from '@/features/card-generator/lib/printValidation';
import type { DisplayCard } from '@/domain/rendering';

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
  exportGateMessage?: string | null;
  showPreviewWatermark: boolean;
  onGallerySearchChange: (value: string) => void;
  onGallerySortChange: (value: GeneratedGallerySort) => void;
  onEditCardRequest: (card: DisplayCard) => void;
  onRemoveCard: (card: DisplayCard) => void;
}

const GALLERY_GRID_GAP_PX = 12;

const GALLERY_DENSITY_OPTIONS: Record<GeneratedGalleryDensity, { label: string; previewWidthPx: number; gridMinWidthPx: number; rowHeightPx: number }> = {
  compact: { label: 'Small cards', previewWidthPx: 132, gridMinWidthPx: 144, rowHeightPx: 226 },
  comfortable: { label: 'Medium cards', previewWidthPx: 176, gridMinWidthPx: 188, rowHeightPx: 286 },
  large: { label: 'Large cards', previewWidthPx: 232, gridMinWidthPx: 244, rowHeightPx: 368 },
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
  exportGateMessage,
  showPreviewWatermark,
  onGallerySearchChange,
  onGallerySortChange,
  onEditCardRequest,
  onRemoveCard,
}: GeneratedCardGalleryProps) {
  const [galleryDensity, setGalleryDensity] = useState<GeneratedGalleryDensity>('compact');
  const [galleryColumns, setGalleryColumns] = useState<GeneratedGalleryColumns>('auto');
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
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
          Object.values(card.data).some((value) => String(value).toLowerCase().includes(query))
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
  const columnCount = resolveGeneratedGalleryColumnCount({
    availableWidth: gridWidth,
    minimumItemWidth: densityConfig.gridMinWidthPx,
    gap: GALLERY_GRID_GAP_PX,
    requestedColumns: galleryColumns,
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
  // The gallery mounts empty. Re-run once there are outputs so the measurement
  // target exists; otherwise it remains at its initial zero-width, one-column state.
  }, [generatedDisplayCards.length]);

  useEffect(() => {
    virtualizer.scrollToIndex(0);
  }, [galleryDensity, gallerySearch, gallerySort, generatedDisplayCards.length, virtualizer]);

  const virtualRows = virtualizer.getVirtualItems();
  const hasRepeatedExportButtons = filteredSortedCards.length > 1;

  return (
    <div>
      <div className="sticky top-0 z-10 bg-background pb-2 flex items-center justify-between mb-2 gap-3 flex-wrap">
        <h2 className="min-w-0 text-xl font-semibold text-foreground sm:text-2xl">
          Generated Outputs ({generatedDisplayCards.length})
          {selectedTemplate && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              - {selectedTemplate.name}
            </span>
          )}
        </h2>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="relative min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search outputs..."
              value={gallerySearch}
              onChange={(event) => onGallerySearchChange(event.target.value)}
              className="h-8 w-36 pl-8 text-sm sm:w-40"
            />
          </div>
          <Select value={gallerySort} onValueChange={(value) => onGallerySortChange(value as GeneratedGallerySort)}>
            <SelectTrigger className="h-8 w-32 text-sm sm:w-36" aria-label="Sort gallery">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Order added</SelectItem>
              <SelectItem value="name-asc">Name A-Z</SelectItem>
              <SelectItem value="name-desc">Name Z-A</SelectItem>
              <SelectItem value="template">By Template</SelectItem>
            </SelectContent>
          </Select>
          <Select value={galleryDensity} onValueChange={(value) => setGalleryDensity(value as GeneratedGalleryDensity)}>
            <SelectTrigger className="h-8 w-32 text-sm sm:w-36" aria-label="Card size in generated outputs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(GALLERY_DENSITY_OPTIONS).map(([value, option]) => (
                <SelectItem key={value} value={value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={galleryColumns} onValueChange={(value) => setGalleryColumns(value as GeneratedGalleryColumns)}>
            <SelectTrigger className="h-8 w-28 text-sm sm:w-32" aria-label="Cards per row in generated outputs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GALLERY_COLUMN_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {generatedDisplayCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-300px)] border rounded-md bg-card/30 text-muted-foreground p-8 text-center shadow-inner">
          <PackageOpen className="h-16 w-16 mb-4 text-primary/70" />
          <p className="text-lg font-medium">No outputs generated yet.</p>
          <p className="text-sm">Create a single output or run Bulk Import. Filled fields appear here for visual review, edits, and export.</p>
        </div>
      ) : (
        <div
          ref={scrollParentRef}
          data-testid="generated-gallery-scroll"
          className="h-[calc(100vh-250px)] overflow-auto rounded-md border bg-card/30 p-4 shadow-inner"
        >
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md border bg-background/80 px-3 py-2 text-xs text-muted-foreground">
            <span>
              Showing {filteredSortedCards.length} matching outputs
              {filteredSortedCards.length !== generatedDisplayCards.length ? ` (${generatedDisplayCards.length} total generated)` : ''}
            </span>
            <span>{columnCount} per row</span>
          </div>
          <div ref={gridMeasureRef}>
            <div
              className="relative"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              {virtualRows.map((virtualRow) => {
                const rowStart = virtualRow.index * columnCount;
                const rowCards = filteredSortedCards.slice(rowStart, rowStart + columnCount);
                return (
                  <div
                    key={virtualRow.key}
                    ref={virtualizer.measureElement}
                    data-index={virtualRow.index}
                    className="absolute left-0 top-0 grid w-full gap-3"
                    style={{
                      gridTemplateColumns: `repeat(${columnCount}, minmax(${densityConfig.gridMinWidthPx}px, 1fr))`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {rowCards.map((cardItem, cardIndex) => {
                      const isSelected = selectedOutputId === cardItem.uniqueId;
                      return (
                        <div
                          key={cardItem.uniqueId}
                          className={`relative rounded-md transition-shadow ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                          data-selected={isSelected ? 'true' : 'false'}
                        >
                          <div className="relative mx-auto w-fit">
                            <CardPreview
                              card={cardItem}
                              isPrintMode={false}
                              highlightColor={richTextHighlightColor}
                              className="mx-auto"
                              showSizeInfo={rowStart + cardIndex === 0}
                              onSelect={(card) => setSelectedOutputId(card.uniqueId)}
                              onEdit={onEditCardRequest}
                              targetWidthPx={densityConfig.previewWidthPx}
                            />
                            {showPreviewWatermark ? <CardWatermarkOverlay /> : null}
                          </div>
                          {isSelected ? (
                            <button
                              type="button"
                              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-destructive/50 bg-background/90 text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground focus:outline-none focus:ring-2 focus:ring-destructive"
                              onClick={(event) => {
                                event.stopPropagation();
                                onRemoveCard(cardItem);
                              }}
                              aria-label={`Remove generated output ${rowStart + cardIndex + 1}`}
                              title="Remove output"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                          {isSelected ? (
                            <div className="absolute bottom-2 right-2 flex gap-2">
                              <ShareCardButton
                                card={cardItem}
                                exportMode={exportMode}
                                exportDpi={exportDpi}
                                richTextHighlightColor={richTextHighlightColor}
                                ariaLabel={hasRepeatedExportButtons ? `Share output ${rowStart + cardIndex + 1}` : undefined}
                              />
                              <ExportCardImageButton
                                card={cardItem}
                                exportMode={exportMode}
                                exportDpi={exportDpi}
                                richTextHighlightColor={richTextHighlightColor}
                                disabled={false}
                                gateMessage={exportGateMessage}
                                iconOnly
                                ariaLabel={
                                  hasRepeatedExportButtons
                                    ? `Download individual output ${rowStart + cardIndex + 1}`
                                    : 'Download individual card'
                                }
                              />
                            </div>
                          ) : null}
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
