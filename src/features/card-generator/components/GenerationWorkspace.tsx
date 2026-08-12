"use client";

import { useCallback, useMemo, useRef } from 'react';
import { FilePlus2, Layers3, PackagePlus, PenTool } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CardPreview } from '@/features/card-rendering/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BulkGenerator } from '@/features/card-generator/components/BulkGenerator';
import { CardWatermarkOverlay } from '@/features/card-rendering/client';
import { ExportControlsPanel } from '@/features/card-generator/components/ExportControlsPanel';
import { GeneratedCardGallery, type GeneratedGallerySort } from '@/features/card-generator/components/GeneratedCardGallery';
import { SingleCardGenerator } from '@/features/card-generator/components/SingleCardGenerator';
import type { ZipExportKind } from '@/features/card-generator/hooks/useCardZipExportActions';
import type { CardSet } from '@/domain/cards';
import {
  getCompatibleCardBacks,
  getTemplateCardMeasurement,
  resolveTemplateCardFormat,
  type TemplateCardFormatSource,
} from '@/domain/card-formats';
import type { TCGCardTemplate } from '@/domain/templates';
import type { DisplayCard, PaperSize, PdfDuplexLayout } from '@/domain/rendering';
import type { ExportMode } from '@/features/card-generator/lib/printValidation';
import type { TabletopSimulatorExportQuality } from '@/features/card-generator/lib/zipExport';
import { shouldShowVisibleCardWatermark } from '@/features/card-rendering/client';
import { trackCardForgeEvent } from '@/features/analytics/client';

interface GenerationWorkspaceProps {
  isLoadingTemplates: boolean;
  templates: TCGCardTemplate[];
  backFaceTemplates: TCGCardTemplate[];
  activeCardSet: CardSet;
  generatorSelectedTemplateId: string | null;
  selectedPaperSize: PaperSize;
  pdfMarginMm: number;
  pdfCardSpacingMm: number;
  pdfIncludeCutLines: boolean;
  pdfDuplexLayout: PdfDuplexLayout;
  richTextHighlightColor: string;
  exportMode: ExportMode;
  exportDpi: number;
  generatedDisplayCards: DisplayCard[];
  zipProgress: { done: number; total: number } | null;
  gallerySearch: string;
  gallerySort: GeneratedGallerySort;
  isZipExporting: boolean;
  zipExportKind: ZipExportKind | null;
  isCheckoutStarting: boolean;
  canExportClean: boolean;
  exportGateMessage?: string | null;
  exportEntitlementLabel: string;
  exportEntitlementMessage: string;
  onOpenTemplateMaker: () => void;
  onCreateMatchingBack: (formatSource: TemplateCardFormatSource) => void;
  onSingleCardAdded: (card: DisplayCard) => void;
  onBulkCardsGenerated: (cards: DisplayCard[]) => void;
  onTemplateSelectionChange: (templateId: string | null) => void;
  onSetActiveCardSetName: (name: string) => void;
  onSetActiveCardSetBackingTemplateId: (templateId: string | null) => void;
  onSelectPaperSize: (size: PaperSize) => void;
  onSetPdfOptions: (options: { margin?: number; spacing?: number; cutLines?: boolean; duplexLayout?: PdfDuplexLayout }) => void;
  onSetExportMode: (mode: ExportMode) => void;
  onSetExportDpi: (dpi: number) => void;
  onStartCheckout: () => void;
  onExportAllAsZip: () => void;
  onExportTabletopSimulatorSpritesheets: (quality: TabletopSimulatorExportQuality) => void;
  onClearCardsRequest: () => void;
  onGallerySearchChange: (value: string) => void;
  onGallerySortChange: (value: GeneratedGallerySort) => void;
  onEditCardRequest: (card: DisplayCard) => void;
  onRemoveCard: (card: DisplayCard) => void;
}

export function GenerationWorkspace({
  isLoadingTemplates,
  templates,
  backFaceTemplates,
  activeCardSet,
  generatorSelectedTemplateId,
  selectedPaperSize,
  pdfMarginMm,
  pdfCardSpacingMm,
  pdfIncludeCutLines,
  pdfDuplexLayout,
  richTextHighlightColor,
  exportMode,
  exportDpi,
  generatedDisplayCards,
  zipProgress,
  gallerySearch,
  gallerySort,
  isZipExporting,
  zipExportKind,
  isCheckoutStarting,
  canExportClean,
  exportGateMessage,
  exportEntitlementLabel,
  exportEntitlementMessage,
  onOpenTemplateMaker,
  onCreateMatchingBack,
  onSingleCardAdded,
  onBulkCardsGenerated,
  onTemplateSelectionChange,
  onSetActiveCardSetName,
  onSetActiveCardSetBackingTemplateId,
  onSelectPaperSize,
  onSetPdfOptions,
  onSetExportMode,
  onSetExportDpi,
  onStartCheckout,
  onExportAllAsZip,
  onExportTabletopSimulatorSpritesheets,
  onClearCardsRequest,
  onGallerySearchChange,
  onGallerySortChange,
  onEditCardRequest,
  onRemoveCard,
}: GenerationWorkspaceProps) {
  const galleryRegionRef = useRef<HTMLDivElement | null>(null);
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === generatorSelectedTemplateId) || null,
    [generatorSelectedTemplateId, templates]
  );
  const compatibleBackTemplates = useMemo(
    () => selectedTemplate ? getCompatibleCardBacks(selectedTemplate, backFaceTemplates) : [],
    [backFaceTemplates, selectedTemplate],
  );
  const selectedBackingTemplate = useMemo(
    () => activeCardSet.backingTemplateId
      ? compatibleBackTemplates.find((template) => template.id === activeCardSet.backingTemplateId) || null
      : null,
    [activeCardSet.backingTemplateId, compatibleBackTemplates]
  );
  const selectedFormat = selectedTemplate ? resolveTemplateCardFormat(selectedTemplate) : null;
  const deckPreviewCard = useMemo<DisplayCard | null>(() => (
    selectedTemplate
      ? {
        template: selectedTemplate,
        backingTemplate: selectedBackingTemplate,
        backingTemplateId: selectedBackingTemplate?.id ?? null,
        setId: activeCardSet.id,
        setName: activeCardSet.name,
        data: selectedTemplate.templatePreviewData || {},
        uniqueId: `${activeCardSet.id}-setup-preview`,
      }
      : null
  ), [activeCardSet.id, activeCardSet.name, selectedBackingTemplate, selectedTemplate]);
  const showGeneratedPreviewWatermark = shouldShowVisibleCardWatermark(canExportClean);
  const scrollGalleryIntoView = useCallback(() => {
    window.requestAnimationFrame(() => {
      galleryRegionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const handleSingleCardAdded = useCallback((card: DisplayCard) => {
    onSingleCardAdded(card);
    scrollGalleryIntoView();
  }, [onSingleCardAdded, scrollGalleryIntoView]);

  const handleBulkCardsGenerated = useCallback((cards: DisplayCard[]) => {
    onBulkCardsGenerated(cards);
    if (cards.length > 0) scrollGalleryIntoView();
  }, [onBulkCardsGenerated, scrollGalleryIntoView]);

  if (isLoadingTemplates) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-label="Loading templates" />
        <p className="text-muted-foreground text-sm">Loading templates...</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] border rounded-xl bg-card/30 text-center p-12 space-y-5 shadow-inner">
        <PenTool className="h-16 w-16 text-primary/60" />
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">No Card Designs Yet</h2>
          <p className="text-muted-foreground max-w-sm">Use Design layouts to create a card design first, then come back here to fill in details and make cards.</p>
        </div>
        <Button size="lg" onClick={onOpenTemplateMaker} className="gap-2">
          <PenTool className="h-5 w-5" /> Open Design layouts
        </Button>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-8">
      <section data-workflow-step="setup" tabIndex={-1} aria-labelledby="generator-setup-heading" className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Layers3 className="h-5 w-5 text-primary" />
            <div>
              <h2 id="generator-setup-heading" className="text-base font-semibold">Set up your set</h2>
              <p className="text-xs text-muted-foreground">Choose the front design and card back for this set.</p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-start">
            <div>
              <Label htmlFor="active-card-set-name">Set name</Label>
              <Input
                id="active-card-set-name"
                value={activeCardSet.name}
                onChange={(event) => onSetActiveCardSetName(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="deck-front-template">Card design</Label>
              <Select
                value={generatorSelectedTemplateId ?? undefined}
                onValueChange={(value) => onTemplateSelectionChange(value)}
                disabled={templates.length === 0}
              >
                <SelectTrigger id="deck-front-template">
                  <SelectValue placeholder="Choose a card design" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id || template.name} value={template.id || template.name}>
                      {template.name || template.id} · {getTemplateCardMeasurement(template, 'mm').label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="deck-backing-template">Card Back</Label>
              <Select
                value={activeCardSet.backingTemplateId || '_none_'}
                onValueChange={(value) => {
                  onSetActiveCardSetBackingTemplateId(value === '_none_' ? null : value);
                  trackCardForgeEvent('card_back_selected', {
                    format_id: selectedFormat?.formatId ?? 'custom',
                    has_matching_back: value !== '_none_',
                  });
                }}
              >
                <SelectTrigger id="deck-backing-template">
                  <SelectValue placeholder="Choose card back" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">No card back</SelectItem>
                  {compatibleBackTemplates.map((template) => (
                    <SelectItem key={template.id || template.name} value={template.id || template.name}>
                      {template.name || template.id} · {getTemplateCardMeasurement(template, 'mm').label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplate && compatibleBackTemplates.length === 0 ? (
                <div className="mt-2 space-y-2 rounded-md border border-amber-500/35 bg-amber-500/10 p-3 text-xs">
                  <p className="font-medium text-foreground">No matching card back yet</p>
                  <p className="leading-5 text-muted-foreground">
                    This design uses {selectedFormat ? `${selectedFormat.widthMm} × ${selectedFormat.heightMm} mm` : 'a custom size'}.
                    Create a matching back now, or continue without one.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      trackCardForgeEvent('matching_back_requested', {
                        format_id: selectedFormat?.formatId ?? 'custom',
                        format_kind: selectedFormat?.formatId === 'custom' ? 'custom' : 'standard',
                      });
                      onCreateMatchingBack(selectedTemplate);
                    }}
                  >
                    Create matching card back
                  </Button>
                </div>
              ) : null}
            </div>
            {deckPreviewCard ? (
              <div className="grid grid-cols-2 gap-3 rounded-md border bg-background/70 p-3">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Front</p>
                  <div className="relative w-fit">
                    <CardPreview card={deckPreviewCard} face="front" highlightColor={richTextHighlightColor} targetWidthPx={110} />
                    {showGeneratedPreviewWatermark ? <CardWatermarkOverlay testId="deck-front-watermark" /> : null}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Back</p>
                  {selectedBackingTemplate ? (
                    <div className="relative w-fit">
                      <CardPreview card={deckPreviewCard} face="back" highlightColor={richTextHighlightColor} targetWidthPx={110} />
                      {showGeneratedPreviewWatermark ? <CardWatermarkOverlay testId="deck-back-watermark" /> : null}
                    </div>
                  ) : (
                    <div className="flex aspect-[63/88] w-[78px] items-center justify-center rounded border border-dashed bg-muted/40 px-2 text-center text-xs text-muted-foreground">
                      No card back selected
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
      </section>

      <section data-workflow-step="generate" aria-labelledby="generator-entry-heading" className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Create cards</p>
          <h2 id="generator-entry-heading" className="mt-1 text-xl font-semibold">Fill one card or bring in a whole list</h2>
        </div>
        <Tabs
          defaultValue="single"
          className="space-y-4"
          onValueChange={(value) => trackCardForgeEvent('generation_method_selected', { generation_method: value })}
        >
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border bg-card/70 p-1">
            <TabsTrigger value="single" className="h-auto flex-col gap-1 px-2 py-2 text-xs">
              <FilePlus2 className="h-4 w-4" />
              One card
            </TabsTrigger>
            <TabsTrigger value="bulk" className="h-auto flex-col gap-1 px-2 py-2 text-xs">
              <PackagePlus className="h-4 w-4" />
              Use a list
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="mt-0">
            <SingleCardGenerator
              templates={templates}
              backingTemplate={selectedBackingTemplate}
              activeCardSet={activeCardSet}
              onSingleCardAdded={handleSingleCardAdded}
              selectedTemplateIdProp={generatorSelectedTemplateId}
            />
          </TabsContent>

          <TabsContent value="bulk" className="mt-0">
            <BulkGenerator
              templates={templates}
              backingTemplate={selectedBackingTemplate}
              activeCardSet={activeCardSet}
              onCardsGenerated={handleBulkCardsGenerated}
              selectedTemplateIdProp={generatorSelectedTemplateId}
            />
          </TabsContent>
        </Tabs>
      </section>

      <section data-workflow-step="review" aria-labelledby="generator-review-heading" className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Review the set</p>
          <h2 id="generator-review-heading" className="mt-1 text-xl font-semibold">Review your cards</h2>
        </div>
        <div ref={galleryRegionRef} className="min-w-0 scroll-mt-4">
          <GeneratedCardGallery
            templates={templates}
            generatorSelectedTemplateId={generatorSelectedTemplateId}
            generatedDisplayCards={generatedDisplayCards}
            gallerySearch={gallerySearch}
            gallerySort={gallerySort}
            exportMode={exportMode}
            exportDpi={exportDpi}
            richTextHighlightColor={richTextHighlightColor}
            showPreviewWatermark={showGeneratedPreviewWatermark}
            onGallerySearchChange={onGallerySearchChange}
            onGallerySortChange={onGallerySortChange}
            onEditCardRequest={onEditCardRequest}
            onRemoveCard={onRemoveCard}
            exportGateMessage={exportGateMessage}
          />
        </div>
      </section>

      <section data-workflow-step="export" aria-labelledby="generator-export-heading">
        <ExportControlsPanel
          canExportClean={canExportClean}
          exportDpi={exportDpi}
          exportEntitlementLabel={exportEntitlementLabel}
          exportEntitlementMessage={exportEntitlementMessage}
          exportGateMessage={exportGateMessage}
          exportMode={exportMode}
          generatedDisplayCards={generatedDisplayCards}
          isCheckoutStarting={isCheckoutStarting}
          isZipExporting={isZipExporting}
          pdfCardSpacingMm={pdfCardSpacingMm}
          pdfDuplexLayout={pdfDuplexLayout}
          pdfIncludeCutLines={pdfIncludeCutLines}
          pdfMarginMm={pdfMarginMm}
          richTextHighlightColor={richTextHighlightColor}
          selectedPaperSize={selectedPaperSize}
          zipExportKind={zipExportKind}
          zipProgress={zipProgress}
          onClearCardsRequest={onClearCardsRequest}
          onExportAllAsZip={onExportAllAsZip}
          onExportTabletopSimulatorSpritesheets={onExportTabletopSimulatorSpritesheets}
          onSelectPaperSize={onSelectPaperSize}
          onSetExportDpi={onSetExportDpi}
          onSetExportMode={onSetExportMode}
          onSetPdfOptions={onSetPdfOptions}
          onStartCheckout={onStartCheckout}
        />
      </section>
    </div>
    </>
  );
}
