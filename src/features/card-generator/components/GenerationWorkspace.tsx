"use client";

import { useCallback, useMemo, useRef } from 'react';
import { ArrowLeftRight, BringToFront, Download, FilePlus2, Gamepad2, Layers3, PackagePlus, PenTool, Scissors, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CardPreview } from '@/features/card-rendering/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BulkGenerator } from '@/features/card-generator/components/BulkGenerator';
import { CardWatermarkOverlay } from '@/features/card-rendering/client';
import { GeneratedCardGallery, type GeneratedGallerySort } from '@/features/card-generator/components/GeneratedCardGallery';
import { PaperSizeSelector } from '@/features/card-generator/components/PaperSizeSelector';
import { SaveAsPdfButton } from '@/features/card-generator/components/SaveAsPdfButton';
import { SingleCardGenerator } from '@/features/card-generator/components/SingleCardGenerator';
import type { CardSet } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import type { DisplayCard, PaperSize, PdfDuplexLayout } from '@/domain/rendering';
import type { ExportMode } from '@/features/card-generator/lib/printValidation';
import { shouldShowVisibleCardWatermark } from '@/features/card-rendering/client';
import { hasCardBacking } from '@/domain/rendering';

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
  isCheckoutStarting: boolean;
  canExportClean: boolean;
  exportGateMessage?: string | null;
  exportEntitlementLabel: string;
  exportEntitlementMessage: string;
  onOpenTemplateMaker: () => void;
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
  onExportTabletopSimulatorSpritesheets: () => void;
  onClearCardsRequest: () => void;
  onGallerySearchChange: (value: string) => void;
  onGallerySortChange: (value: GeneratedGallerySort) => void;
  onEditCardRequest: (card: DisplayCard) => void;
  onRemoveCard: (card: DisplayCard) => void;
}

const BASELINE_PRINT_ZIP_BYTES_PER_FACE_AT_300_DPI = 226_884;

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
};

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
  isCheckoutStarting,
  canExportClean,
  exportGateMessage,
  exportEntitlementLabel,
  exportEntitlementMessage,
  onOpenTemplateMaker,
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
  const selectedBackingTemplate = useMemo(
    () => activeCardSet.backingTemplateId
      ? backFaceTemplates.find((template) => template.id === activeCardSet.backingTemplateId) || null
      : null,
    [activeCardSet.backingTemplateId, backFaceTemplates]
  );
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
  const exportFaceCount = generatedDisplayCards.reduce(
    (count, card) => count + (hasCardBacking(card) ? 2 : 1),
    0
  );
  const dpiScale = Math.max(0.1, (exportDpi / 300) ** 2);
  const estimatedZipBytes = exportFaceCount * BASELINE_PRINT_ZIP_BYTES_PER_FACE_AT_300_DPI * dpiScale;
  const exportProgressPercent = zipProgress && zipProgress.total > 0
    ? Math.round((zipProgress.done / zipProgress.total) * 100)
    : 0;
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
                      {template.name || template.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="deck-backing-template">Card Back</Label>
              <Select
                value={activeCardSet.backingTemplateId || '_none_'}
                onValueChange={(value) => onSetActiveCardSetBackingTemplateId(value === '_none_' ? null : value)}
              >
                <SelectTrigger id="deck-backing-template">
                  <SelectValue placeholder="Choose card back" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">No card back</SelectItem>
                  {backFaceTemplates.map((template) => (
                    <SelectItem key={template.id || template.name} value={template.id || template.name}>
                      {template.name || template.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        <Tabs defaultValue="single" className="space-y-4">
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
            <Card>
              <CardHeader>
                <CardTitle id="generator-export-heading" className="text-xl flex items-center gap-2">Export the finished set</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border bg-muted/40 p-3 text-xs">
                  <p className="font-semibold text-foreground">{exportEntitlementLabel}</p>
                  <p className="mt-1 text-muted-foreground">{exportEntitlementMessage}</p>
                </div>
                <div className="space-y-3 pt-2 border-t">
                  <div className="space-y-1">
                    <Label htmlFor="exportMode" className="text-md font-medium">How will you use this set?</Label>
                    <Select
                      value={exportMode}
                      onValueChange={(value) => onSetExportMode(value as ExportMode)}
                    >
                      <SelectTrigger id="exportMode" className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="physical">Print physical cards</SelectItem>
                        <SelectItem value="virtual">Share or play digitally</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose print for physical cards, or digital for online sharing and virtual tabletop play.
                    </p>
                  </div>
                </div>
                <details className="rounded-md border bg-muted/20 p-3">
                  <summary className="cursor-pointer font-medium">Print settings</summary>
                  <div className="mt-4 space-y-3">
                    <PaperSizeSelector selectedSize={selectedPaperSize} onSelectSize={onSelectPaperSize} />
                    <div className="space-y-1">
                      <Label htmlFor="exportDpi" className="text-xs">Image quality</Label>
                      <Select
                        value={String(exportDpi)}
                        onValueChange={(value) => onSetExportDpi(parseInt(value, 10))}
                      >
                        <SelectTrigger id="exportDpi" className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="150">150 DPI</SelectItem>
                          <SelectItem value="300">300 DPI (industry standard)</SelectItem>
                          <SelectItem value="600">600 DPI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  <Label className="text-md font-medium">PDF layout</Label>
                  <TooltipProvider>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Label htmlFor="pdfMargin" className="text-xs flex items-center gap-1 cursor-help"><BringToFront className="h-3 w-3"/>Margins (mm)</Label>
                          </TooltipTrigger>
                          <TooltipContent>Space from paper edge to first card. Typical: 5-10 mm.</TooltipContent>
                        </Tooltip>
                        <Input
                          id="pdfMargin"
                          type="number"
                          value={pdfMarginMm}
                          onChange={(event) => onSetPdfOptions({ margin: parseInt(event.target.value, 10) || 0 })}
                          className="h-8 text-xs"
                          min="0"
                        />
                      </div>
                      <div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Label htmlFor="pdfCardSpacing" className="text-xs flex items-center gap-1 cursor-help"><ArrowLeftRight className="h-3 w-3"/>Card Spacing (mm)</Label>
                          </TooltipTrigger>
                          <TooltipContent>Gap between each card. 0 = no gap, 2-4 mm is typical for cutting.</TooltipContent>
                        </Tooltip>
                        <Input
                          id="pdfCardSpacing"
                          type="number"
                          value={pdfCardSpacingMm}
                          onChange={(event) => onSetPdfOptions({ spacing: parseInt(event.target.value, 10) || 0 })}
                          className="h-8 text-xs"
                          min="0"
                        />
                      </div>
                    </div>
                  </TooltipProvider>
                  <div className="flex items-center space-x-2 pt-1">
                    <Switch
                      id="pdfIncludeCutLines"
                      checked={pdfIncludeCutLines}
                      onCheckedChange={(checked) => onSetPdfOptions({ cutLines: checked })}
                      aria-label="Toggle cut lines in PDF"
                    />
                    <Label htmlFor="pdfIncludeCutLines" className="flex items-center gap-1 cursor-pointer text-xs"><Scissors className="h-3 w-3"/>Include Cut Lines</Label>
                  </div>
                  {exportMode === 'physical' && (
                    <div className="space-y-1">
                      <Label htmlFor="pdfDuplexLayout" className="text-xs">Front/Back PDF Layout</Label>
                      <Select
                        value={pdfDuplexLayout}
                        onValueChange={(value) => onSetPdfOptions({ duplexLayout: value as PdfDuplexLayout })}
                      >
                        <SelectTrigger id="pdfDuplexLayout" className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="separate-pages">Separate front/back sheets</SelectItem>
                          <SelectItem value="same-page">Front + back on same sheet</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Separate sheets supports duplex printing. Same sheet places each back after its front for review, hand cutting, or manual assembly.
                      </p>
                    </div>
                  )}
                  </div>
                </details>

                <div className="flex flex-col gap-2 pt-2 border-t">
                  {!canExportClean && exportGateMessage ? (
                    <div className="space-y-3 rounded-md border border-primary/30 bg-primary/10 p-3 text-xs text-muted-foreground">
                      <p>{exportGateMessage}</p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={onStartCheckout}
                        disabled={isCheckoutStarting}
                        className="w-full"
                      >
                        {isCheckoutStarting ? 'Checking access...' : 'Unlock clean downloads'}
                      </Button>
                      <p>Sign in to claim an open Founder Beta seat, or use Creator Pass when you are ready for clean downloads.</p>
                    </div>
                  ) : null}
                  <SaveAsPdfButton
                    generatedDisplayCards={generatedDisplayCards}
                    selectedPaperSize={selectedPaperSize}
                    pdfMarginMm={pdfMarginMm}
                    pdfCardSpacingMm={pdfCardSpacingMm}
                    pdfIncludeCutLines={pdfIncludeCutLines}
                    pdfDuplexLayout={pdfDuplexLayout}
                    exportMode={exportMode}
                    exportDpi={exportDpi}
                    richTextHighlightColor={richTextHighlightColor}
                    disabled={generatedDisplayCards.length === 0}
                    gateMessage={exportGateMessage}
                    templateName={generatedDisplayCards[0]?.template?.name}
                  />
                  <Button variant="outline" onClick={onExportAllAsZip} disabled={generatedDisplayCards.length === 0 || isZipExporting} className="flex items-center gap-2">
                    <Download className="h-4 w-4" /> {isZipExporting ? `Preparing… ${zipProgress?.done ?? 0}/${zipProgress?.total ?? 0}` : 'Download PNG set'}
                  </Button>
                  <Button variant="outline" onClick={onExportTabletopSimulatorSpritesheets} disabled={generatedDisplayCards.length === 0 || isZipExporting} className="flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4" /> Tabletop Simulator export
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Tabletop Simulator export creates 10 × 7 spritesheets with up to 69 playable cards per sheet plus a JSON manifest.
                  </p>
                  {generatedDisplayCards.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Estimated ZIP size: about {formatBytes(estimatedZipBytes)}. Large print batches can take several minutes; keep this tab open while exporting.
                    </p>
                  )}
                  {zipProgress && (
                    <Progress value={(zipProgress.done / zipProgress.total) * 100} className="h-1.5 mt-1" />
                  )}
                  {generatedDisplayCards.length > 0 && (
                    <Button variant="destructive" onClick={onClearCardsRequest} className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4" /> Remove all cards ({generatedDisplayCards.length})
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
      </section>
    </div>
    {isZipExporting && zipProgress && (
      <div
        className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-4xl rounded-xl border bg-background/95 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur"
        role="status"
        aria-live="polite"
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Export job running</p>
            <p className="text-xs text-muted-foreground">
              Rendering {zipProgress.done} of {zipProgress.total} faces. Estimated archive size about {formatBytes(estimatedZipBytes)}.
            </p>
          </div>
          <p className="text-sm font-semibold tabular-nums">{exportProgressPercent}%</p>
        </div>
        <Progress value={exportProgressPercent} className="h-2" />
        <p className="mt-2 text-[11px] text-muted-foreground">
          Keep CardForge open until the download begins. For 1000 front and back card images, print-quality exports can be hundreds of MB.
        </p>
      </div>
    )}
    </>
  );
}
