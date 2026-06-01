"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PackageOpen, Search } from 'lucide-react';

import { CardPreview } from '@/components/card-forge/CardPreview';
import { ExportCardImageButton } from '@/features/card-generator/components/ExportCardImageButton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DisplayCard, TCGCardTemplate } from '@/types';
import type { ExportMode } from '@/lib/printValidation';

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
  exportGateMessage?: string | null;
  onGallerySearchChange: (value: string) => void;
  onGallerySortChange: (value: GeneratedGallerySort) => void;
  onEditCardRequest: (card: DisplayCard) => void;
}

const GALLERY_GRID_GAP_PX = 12;

const GALLERY_DENSITY_OPTIONS: Record<GeneratedGalleryDensity, { label: string; previewWidthPx: number; gridMinWidthPx: number; rowHeightPx: number }> = {
  compact: { label: 'Compact grid', previewWidthPx: 132, gridMinWidthPx: 144, rowHeightPx: 226 },
  comfortable: { label: 'Comfortable grid', previewWidthPx: 176, gridMinWidthPx: 188, rowHeightPx: 286 },
  large: { label: 'Detailed outputs', previewWidthPx: 232, gridMinWidthPx: 244, rowHeightPx: 368 },
};

export function GeneratedCardGallery({
  templates,
  generatorSelectedTemplateId,
  generatedDisplayCards,
  gallerySearch,
  gallerySort,
  exportMode,
  exportDpi,
  exportGateMessage,
  onGallerySearchChange,
  onGallerySortChange,
  onEditCardRequest,
}: GeneratedCardGalleryProps) {
  const [galleryDensity, setGalleryDensity] = useState<GeneratedGalleryDensity>('compact');
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
  const columnCount = Math.max(1, Math.floor((gridWidth + GALLERY_GRID_GAP_PX) / (densityConfig.gridMinWidthPx + GALLERY_GRID_GAP_PX)));
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
  }, []);

  useEffect(() => {
    virtualizer.scrollToIndex(0);
  }, [galleryDensity, gallerySearch, gallerySort, generatedDisplayCards.length, virtualizer]);

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div className="min-w-0">
      <div className="sticky top-0 z-10 bg-background pb-2 flex items-center justify-between mb-2 gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold text-foreground shrink-0">
          Generated Outputs ({generatedDisplayCards.length})
          {selectedTemplate && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              - {selectedTemplate.name}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search outputs..."
              value={gallerySearch}
              onChange={(event) => onGallerySearchChange(event.target.value)}
              className="pl-8 h-8 text-sm w-40"
            />
          </div>
          <Select value={gallerySort} onValueChange={(value) => onGallerySortChange(value as GeneratedGallerySort)}>
            <SelectTrigger className="h-8 text-sm w-36" aria-label="Sort gallery">
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
            <SelectTrigger className="h-8 text-sm w-40" aria-label="Gallery density">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(GALLERY_DENSITY_OPTIONS).map(([value, option]) => (
                <SelectItem key={value} value={value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {generatedDisplayCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-300px)] border rounded-md bg-card/30 text-muted-foreground p-8 text-center shadow-inner">
          <PackageOpen className="h-16 w-16 mb-4 text-primary/70" />
          <p className="text-lg font-medium">No outputs generated yet.</p>
          <p className="text-sm">Create a single output, generate from data, or import a project. This gallery is the visual review surface used before export.</p>
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
                    {rowCards.map((cardItem, cardIndex) => (
                      <div key={cardItem.uniqueId} className="relative group/card">
                        <CardPreview
                          card={cardItem}
                          isPrintMode={false}
                          className="mx-auto"
                          showSizeInfo={rowStart + cardIndex === 0}
                          onEdit={onEditCardRequest}
                          targetWidthPx={densityConfig.previewWidthPx}
                        />
                        <div className="absolute bottom-2 right-2 opacity-0 transition-opacity duration-150 group-hover/card:opacity-100">
                          <ExportCardImageButton
                            card={cardItem}
                            exportMode={exportMode}
                            exportDpi={exportDpi}
                            disabled={false}
                            gateMessage={exportGateMessage}
                          />
                        </div>
                      </div>
                    ))}
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
