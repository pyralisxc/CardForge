"use client";

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, PackageOpen, Search } from 'lucide-react';

import { CardPreview } from '@/components/card-forge/CardPreview';
import { ExportCardImageButton } from '@/components/card-forge/ExportCardImageButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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

const DEFAULT_GALLERY_PAGE_SIZE = 60;

const GALLERY_DENSITY_OPTIONS: Record<GeneratedGalleryDensity, { label: string; previewWidthPx: number; gridMinWidthPx: number }> = {
  compact: { label: 'Compact grid', previewWidthPx: 132, gridMinWidthPx: 144 },
  comfortable: { label: 'Comfortable grid', previewWidthPx: 176, gridMinWidthPx: 188 },
  large: { label: 'Detailed outputs', previewWidthPx: 232, gridMinWidthPx: 244 },
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
  const [currentPage, setCurrentPage] = useState(1);
  const [cardsPerPage, setCardsPerPage] = useState(DEFAULT_GALLERY_PAGE_SIZE);
  const [galleryDensity, setGalleryDensity] = useState<GeneratedGalleryDensity>('compact');
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

  const totalPages = Math.max(1, Math.ceil(filteredSortedCards.length / cardsPerPage));
  const boundedCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (boundedCurrentPage - 1) * cardsPerPage;
  const pageEndIndex = Math.min(pageStartIndex + cardsPerPage, filteredSortedCards.length);
  const displayStartIndex = filteredSortedCards.length === 0 ? 0 : pageStartIndex + 1;
  const visibleGalleryCards = filteredSortedCards.slice(pageStartIndex, pageEndIndex);
  const densityConfig = GALLERY_DENSITY_OPTIONS[galleryDensity];

  useEffect(() => {
    setCurrentPage(1);
  }, [gallerySearch, gallerySort, generatedDisplayCards.length, cardsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
          <Select value={String(cardsPerPage)} onValueChange={(value) => setCardsPerPage(parseInt(value, 10))}>
            <SelectTrigger className="h-8 text-sm w-36" aria-label="Outputs per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24">24 / page</SelectItem>
              <SelectItem value="60">60 / page</SelectItem>
              <SelectItem value="120">120 / page</SelectItem>
              <SelectItem value="240">240 / page</SelectItem>
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
        <ScrollArea className="h-[calc(100vh-250px)] border rounded-md p-4 bg-card/30 shadow-inner">
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md border bg-background/80 px-3 py-2 text-xs text-muted-foreground">
            <span>
              Page {boundedCurrentPage} of {totalPages} - showing {displayStartIndex}-{pageEndIndex} of {filteredSortedCards.length} matching outputs
              {filteredSortedCards.length !== generatedDisplayCards.length ? ` (${generatedDisplayCards.length} total generated)` : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={boundedCurrentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                aria-label="Previous gallery page"
              >
                <ChevronLeft className="h-3 w-3" /> Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={boundedCurrentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                aria-label="Next gallery page"
              >
                Next <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${densityConfig.gridMinWidthPx}px, 1fr))` }}
          >
            {visibleGalleryCards.map((cardItem, index) => (
              <div key={cardItem.uniqueId} className="relative group/card">
                <CardPreview
                  card={cardItem}
                  isPrintMode={false}
                  className="mx-auto"
                  showSizeInfo={index === 0}
                  onEdit={onEditCardRequest}
                  targetWidthPx={densityConfig.previewWidthPx}
                />
                <div className="absolute bottom-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
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
        </ScrollArea>
      )}
    </div>
  );
}
