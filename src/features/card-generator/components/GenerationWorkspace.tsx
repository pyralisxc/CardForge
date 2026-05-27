"use client";

import { ArrowLeftRight, BringToFront, Download, FilePlus2, Gamepad2, PackagePlus, PenTool, Scissors, Settings2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BulkGenerator } from '@/features/card-generator/components/BulkGenerator';
import { GeneratedCardGallery, type GeneratedGallerySort } from '@/features/card-generator/components/GeneratedCardGallery';
import { PaperSizeSelector } from '@/features/card-generator/components/PaperSizeSelector';
import { SaveAsPdfButton } from '@/features/card-generator/components/SaveAsPdfButton';
import { SingleCardGenerator } from '@/features/card-generator/components/SingleCardGenerator';
import type { DisplayCard, PaperSize, PdfDuplexLayout, TCGCardTemplate } from '@/types';
import type { ExportMode } from '@/lib/printValidation';

interface GenerationWorkspaceProps {
  isLoadingTemplates: boolean;
  templates: TCGCardTemplate[];
  generatorSelectedTemplateId: string | null;
  selectedPaperSize: PaperSize;
  pdfMarginMm: number;
  pdfCardSpacingMm: number;
  pdfIncludeCutLines: boolean;
  pdfDuplexLayout: PdfDuplexLayout;
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
  accountAccessMode: string;
  accountEmail: string | null;
  accountSource: string;
  authConfigured: boolean;
  isSignedIn: boolean;
  onOpenTemplateMaker: () => void;
  onSingleCardAdded: (card: DisplayCard) => void;
  onBulkCardsGenerated: (cards: DisplayCard[]) => void;
  onTemplateSelectionChange: (templateId: string | null) => void;
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
  generatorSelectedTemplateId,
  selectedPaperSize,
  pdfMarginMm,
  pdfCardSpacingMm,
  pdfIncludeCutLines,
  pdfDuplexLayout,
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
  accountAccessMode,
  accountEmail,
  accountSource,
  authConfigured,
  isSignedIn,
  onOpenTemplateMaker,
  onSingleCardAdded,
  onBulkCardsGenerated,
  onTemplateSelectionChange,
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
}: GenerationWorkspaceProps) {
  const exportFaceCount = generatedDisplayCards.reduce(
    (count, card) => count + (card.template.backCanvas ? 2 : 1),
    0
  );
  const dpiScale = Math.max(0.1, (exportDpi / 300) ** 2);
  const estimatedZipBytes = exportFaceCount * BASELINE_PRINT_ZIP_BYTES_PER_FACE_AT_300_DPI * dpiScale;
  const exportProgressPercent = zipProgress && zipProgress.total > 0
    ? Math.round((zipProgress.done / zipProgress.total) * 100)
    : 0;
  const zipExportLabel = exportMode === 'physical'
    ? `Export Print PNG ZIP (${exportFaceCount} faces)`
    : `Export Digital PNG ZIP (${exportFaceCount} images)`;

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
          <h2 className="text-2xl font-bold">No Templates Yet</h2>
          <p className="text-muted-foreground max-w-sm">Create a template in Layout Studio first, then come back here to fill in data and generate outputs.</p>
        </div>
        <Button size="lg" onClick={onOpenTemplateMaker} className="gap-2">
          <PenTool className="h-5 w-5" /> Open Layout Studio
        </Button>
      </div>
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="min-w-0">
        <Tabs defaultValue="single" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl border bg-card/70 p-1">
            <TabsTrigger value="single" className="h-auto flex-col gap-1 px-2 py-2 text-xs">
              <FilePlus2 className="h-4 w-4" />
              Single
            </TabsTrigger>
            <TabsTrigger value="bulk" className="h-auto flex-col gap-1 px-2 py-2 text-xs">
              <PackagePlus className="h-4 w-4" />
              Data Import
            </TabsTrigger>
            <TabsTrigger value="export" className="h-auto flex-col gap-1 px-2 py-2 text-xs">
              <Settings2 className="h-4 w-4" />
              Exports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="mt-0">
            <SingleCardGenerator
              templates={templates}
              onSingleCardAdded={onSingleCardAdded}
              onTemplateSelectionChange={onTemplateSelectionChange}
              selectedTemplateIdProp={generatorSelectedTemplateId}
            />
          </TabsContent>

          <TabsContent value="bulk" className="mt-0">
            <BulkGenerator
              templates={templates}
              onCardsGenerated={onBulkCardsGenerated}
              selectedTemplateIdProp={generatorSelectedTemplateId}
              onTemplateSelectionChange={onTemplateSelectionChange}
            />
          </TabsContent>

          <TabsContent value="export" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">Exports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border bg-muted/40 p-3 text-xs">
                  <p className="font-semibold text-foreground">{exportEntitlementLabel}</p>
                  <p className="mt-1 text-muted-foreground">{exportEntitlementMessage}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-md border bg-background/80 p-3 text-xs text-muted-foreground sm:grid-cols-4">
                  <div>
                    <p className="font-semibold text-foreground">Auth</p>
                    <p>{authConfigured ? 'Configured' : 'Local fallback'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Session</p>
                    <p>{isSignedIn ? 'Signed in' : 'Signed out'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Access</p>
                    <p className="uppercase">{accountAccessMode}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Account</p>
                    <p className="truncate">{accountEmail || accountSource}</p>
                  </div>
                </div>
                <PaperSizeSelector selectedSize={selectedPaperSize} onSelectSize={onSelectPaperSize} />
                <div className="space-y-3 pt-2 border-t">
                  <div className="space-y-1">
                    <Label htmlFor="exportMode" className="text-md font-medium">Export Profile</Label>
                    <Select
                      value={exportMode}
                      onValueChange={(value) => onSetExportMode(value as ExportMode)}
                    >
                      <SelectTrigger id="exportMode" className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="physical">Physical Print (300 DPI, strict checks)</SelectItem>
                        <SelectItem value="virtual">Virtual Export (faster, warning-first)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Physical mode is recommended for print companies. Virtual mode is optimized for digital sharing.
                    </p>
                    <div className="space-y-1">
                      <Label htmlFor="exportDpi" className="text-xs">Export DPI</Label>
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
                  </div>
                  <Label className="text-md font-medium">PDF Options</Label>
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

                <div className="flex flex-col gap-2 pt-2 border-t">
                  {!canExportClean && exportGateMessage ? (
                    <div className="space-y-3 rounded-md border border-primary/30 bg-primary/10 p-3 text-xs text-muted-foreground">
                      <p>{exportGateMessage} You can still design layouts, import data, and generate previews.</p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={onStartCheckout}
                        disabled={isCheckoutStarting}
                        className="w-full"
                      >
                        {isCheckoutStarting ? 'Checking access...' : 'Unlock clean export'}
                      </Button>
                      <p>Early beta export access can be granted by the CardForge team while Stripe checkout is being connected. Checkout will be handled by Stripe when billing is enabled.</p>
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
                    disabled={generatedDisplayCards.length === 0}
                    gateMessage={exportGateMessage}
                    templateName={generatedDisplayCards[0]?.template?.name}
                  />
                  <Button variant="outline" onClick={onExportAllAsZip} disabled={generatedDisplayCards.length === 0 || isZipExporting} className="flex items-center gap-2">
                    <Download className="h-4 w-4" /> {isZipExporting ? `Exporting... ${zipProgress?.done ?? 0}/${zipProgress?.total ?? 0}` : zipExportLabel}
                  </Button>
                  <Button variant="outline" onClick={onExportTabletopSimulatorSpritesheets} disabled={generatedDisplayCards.length === 0 || isZipExporting} className="flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4" /> Export Tabletop Simulator ZIP
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Tabletop Simulator export creates 10 x 7 spritesheets with up to 69 playable cards per sheet plus a JSON manifest.
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
                      <Trash2 className="h-4 w-4" /> Clear All ({generatedDisplayCards.length})
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <GeneratedCardGallery
        templates={templates}
        generatorSelectedTemplateId={generatorSelectedTemplateId}
        generatedDisplayCards={generatedDisplayCards}
        gallerySearch={gallerySearch}
        gallerySort={gallerySort}
        exportMode={exportMode}
        exportDpi={exportDpi}
        onGallerySearchChange={onGallerySearchChange}
        onGallerySortChange={onGallerySortChange}
        onEditCardRequest={onEditCardRequest}
        exportGateMessage={exportGateMessage}
      />
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
          Keep CardForge open until the download begins. For 1000 front/back outputs, current print-quality exports can be hundreds of MB.
        </p>
      </div>
    )}
    </>
  );
}
