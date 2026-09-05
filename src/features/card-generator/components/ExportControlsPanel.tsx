"use client";

import { useMemo, useState } from 'react';
import { ArrowLeftRight, BringToFront, Download, Gamepad2, Scissors } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getCardExportDimensionsPx, hasCardBacking } from '@/domain/rendering';
import type { DisplayCard, PaperSize, PdfDuplexLayout } from '@/domain/rendering';
import { PaperSizeSelector } from '@/features/card-generator/components/PaperSizeSelector';
import { SaveAsPdfButton } from '@/features/card-generator/components/SaveAsPdfButton';
import type { ZipExportKind } from '@/features/card-generator/hooks/useCardZipExportActions';
import {
  RASTER_EXPORT_QUALITY_OPTIONS,
  getRasterExportDimensionsPx,
  getRasterExportQualityOption,
  type ExportMode,
} from '@/features/card-generator/lib/printValidation';
import {
  createTabletopSimulatorSheets,
  getTabletopSimulatorCardCellSize,
  getTabletopSimulatorExportPreset,
  getTabletopSimulatorExportProfile,
  type TabletopSimulatorExportQuality,
} from '@/features/card-generator/lib/zipExport';

interface ExportControlsPanelProps {
  canExportClean: boolean;
  exportDpi: number;
  exportEntitlementLabel: string;
  exportEntitlementMessage: string;
  exportGateMessage?: string | null;
  exportMode: ExportMode;
  generatedDisplayCards: DisplayCard[];
  isCheckoutStarting: boolean;
  isZipExporting: boolean;
  pdfCardSpacingMm: number;
  pdfDuplexLayout: PdfDuplexLayout;
  pdfIncludeCutLines: boolean;
  pdfMarginMm: number;
  richTextHighlightColor: string;
  selectedPaperSize: PaperSize;
  zipExportKind: ZipExportKind | null;
  zipProgress: { done: number; total: number } | null;
  onExportAllAsZip: () => void;
  onExportTabletopSimulatorSpritesheets: (quality: TabletopSimulatorExportQuality) => void;
  onSelectPaperSize: (size: PaperSize) => void;
  onSetExportDpi: (dpi: number) => void;
  onSetExportMode: (mode: ExportMode) => void;
  onSetPdfOptions: (options: { margin?: number; spacing?: number; cutLines?: boolean; duplexLayout?: PdfDuplexLayout }) => void;
  onStartCheckout: () => void;
}

const BASELINE_PNG_BYTES_PER_FACE_AT_HIGH_DETAIL = 226_884;

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

export function ExportControlsPanel({
  canExportClean,
  exportDpi,
  exportEntitlementLabel,
  exportEntitlementMessage,
  exportGateMessage,
  exportMode,
  generatedDisplayCards,
  isCheckoutStarting,
  isZipExporting,
  pdfCardSpacingMm,
  pdfDuplexLayout,
  pdfIncludeCutLines,
  pdfMarginMm,
  richTextHighlightColor,
  selectedPaperSize,
  zipExportKind,
  zipProgress,
  onExportAllAsZip,
  onExportTabletopSimulatorSpritesheets,
  onSelectPaperSize,
  onSetExportDpi,
  onSetExportMode,
  onSetPdfOptions,
  onStartCheckout,
}: ExportControlsPanelProps) {
  const [tabletopQuality, setTabletopQuality] = useState<TabletopSimulatorExportQuality>('standard');
  const firstCard = generatedDisplayCards[0];
  const exportFaceCount = generatedDisplayCards.reduce(
    (count, card) => count + (hasCardBacking(card) ? 2 : 1),
    0
  );
  const rasterQuality = getRasterExportQualityOption(exportDpi);
  const rasterDimensions = firstCard
    ? getRasterExportDimensionsPx(firstCard, exportMode, exportDpi)
    : null;
  const baselineDimensions = firstCard
    ? getRasterExportDimensionsPx(firstCard, exportMode, 300)
    : null;
  const rasterAreaScale = rasterDimensions && baselineDimensions
    ? (rasterDimensions.widthPx * rasterDimensions.heightPx)
      / (baselineDimensions.widthPx * baselineDimensions.heightPx)
    : 1;
  const estimatedPngZipBytes = exportFaceCount
    * BASELINE_PNG_BYTES_PER_FACE_AT_HIGH_DETAIL
    * rasterAreaScale;

  const tabletopSummary = useMemo(() => {
    const preset = getTabletopSimulatorExportPreset(tabletopQuality);
    const sheets = createTabletopSimulatorSheets(generatedDisplayCards, tabletopQuality);
    const textureCount = sheets.reduce(
      (count, sheet) => count + 1 + (sheet.hasBacks ? 1 : 0),
      0
    );
    if (!firstCard) {
      return { preset, sheets, textureCount, cellSize: null };
    }
    const profile = getTabletopSimulatorExportProfile(tabletopQuality);
    const sourceSize = getCardExportDimensionsPx(firstCard, profile.dpi);
    const cellSize = getTabletopSimulatorCardCellSize(
      sourceSize.widthPx * profile.canvasPixelRatio,
      sourceSize.heightPx * profile.canvasPixelRatio,
      preset.grid
    );
    return { preset, sheets, textureCount, cellSize };
  }, [firstCard, generatedDisplayCards, tabletopQuality]);

  const progressPercent = zipProgress && zipProgress.total > 0
    ? Math.round((zipProgress.done / zipProgress.total) * 100)
    : 0;
  const isPngSetExporting = isZipExporting && zipExportKind === 'png-set';
  const isTabletopExporting = isZipExporting && zipExportKind === 'tabletop-simulator';

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle id="generator-export-heading" className="text-xl">
            Export the finished set
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-xs">
            <p className="font-semibold text-foreground">{exportEntitlementLabel}</p>
            <p className="mt-1 text-muted-foreground">{exportEntitlementMessage}</p>
            <p className="mt-2 text-muted-foreground">
              CardForge builds exports locally, then your browser saves the single finished file to its configured download location. No server copy is created.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="exportMode" className="text-sm font-medium">Primary use</Label>
            <Select value={exportMode} onValueChange={(value) => onSetExportMode(value as ExportMode)}>
              <SelectTrigger id="exportMode" className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="physical">Print physical cards</SelectItem>
                <SelectItem value="virtual">Share or play digitally</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This changes filenames and quality warnings. Each destination below owns its own format and settings.
            </p>
          </div>

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
                {isCheckoutStarting ? 'Checking access...' : 'Get watermark-free downloads'}
              </Button>
              <p>You can download every format now with the watermark. Creator Pass makes those same files clean.</p>
            </div>
          ) : null}

          <section aria-labelledby="raster-export-heading" className="space-y-3 rounded-md border bg-muted/20 p-3">
            <div>
              <h3 id="raster-export-heading" className="font-semibold">Individual images and PNG set</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Raster images have fixed pixels. PNG is lossless and best for card masters; JPEG and WebP are smaller, lossy choices in each card&apos;s download menu.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The selected raster quality also controls the card images embedded in Print PDF below.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="exportDpi" className="text-xs">Raster quality</Label>
              <Select value={String(exportDpi)} onValueChange={(value) => onSetExportDpi(parseInt(value, 10))}>
                <SelectTrigger id="exportDpi" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RASTER_EXPORT_QUALITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{rasterQuality.description}</p>
              {rasterDimensions ? (
                <p className="text-xs font-medium text-foreground">
                  {rasterDimensions.widthPx} × {rasterDimensions.heightPx}px per face for this template. Enlarging beyond those pixels softens the image.
                </p>
              ) : null}
            </div>
            <Button
              variant="outline"
              onClick={onExportAllAsZip}
              disabled={generatedDisplayCards.length === 0 || isZipExporting}
              className="w-full gap-2"
            >
              <Download className="h-4 w-4" />
              {isPngSetExporting
                ? `Preparing PNGs… ${zipProgress?.done ?? 0}/${zipProgress?.total ?? 0}`
                : `Download PNG set (${exportFaceCount} ${exportFaceCount === 1 ? 'file' : 'files'})`}
            </Button>
            {generatedDisplayCards.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Estimated PNG ZIP size: about {formatBytes(estimatedPngZipBytes)}. Exact size depends on artwork and template complexity.
              </p>
            ) : null}
          </section>

          <details className="rounded-md border bg-muted/20 p-3">
            <summary className="cursor-pointer font-semibold">Print PDF</summary>
            <div className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                PDF arranges the selected raster quality on paper. Page geometry and cut lines remain sharp, but the cards are RGB raster images—not vector, CMYK, PDF/X, or printer-specific prepress output.
              </p>
              <PaperSizeSelector selectedSize={selectedPaperSize} onSelectSize={onSelectPaperSize} />
              <Label className="text-sm font-medium">PDF layout</Label>
              <TooltipProvider>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label htmlFor="pdfMargin" className="flex cursor-help items-center gap-1 text-xs">
                          <BringToFront className="h-3 w-3" />Margins (mm)
                        </Label>
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
                        <Label htmlFor="pdfCardSpacing" className="flex cursor-help items-center gap-1 text-xs">
                          <ArrowLeftRight className="h-3 w-3" />Card spacing (mm)
                        </Label>
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
                <Label htmlFor="pdfIncludeCutLines" className="flex cursor-pointer items-center gap-1 text-xs">
                  <Scissors className="h-3 w-3" />Include cut lines
                </Label>
              </div>
              {exportMode === 'physical' ? (
                <div className="space-y-1">
                  <Label htmlFor="pdfDuplexLayout" className="text-xs">Front/back layout</Label>
                  <Select
                    value={pdfDuplexLayout}
                    onValueChange={(value) => onSetPdfOptions({ duplexLayout: value as PdfDuplexLayout })}
                  >
                    <SelectTrigger id="pdfDuplexLayout" className="h-9 text-xs">
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
                canExportClean={canExportClean}
                disabled={generatedDisplayCards.length === 0}
                templateName={firstCard?.template?.name}
              />
            </div>
          </details>

          <section aria-labelledby="tabletop-export-heading" className="space-y-3 rounded-md border bg-muted/20 p-3">
            <div>
              <h3 id="tabletop-export-heading" className="font-semibold">Tabletop Simulator</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Fixed 4K PNG spritesheets plus a JSON manifest. Raster quality above does not affect this export.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tabletopQuality" className="text-xs">TTS sheet detail</Label>
              <Select
                value={tabletopQuality}
                onValueChange={(value) => setTabletopQuality(value as TabletopSimulatorExportQuality)}
              >
                <SelectTrigger id="tabletopQuality" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard · 10 × 7, fewer sheets</SelectItem>
                  <SelectItem value="high-detail">High detail · 5 × 4, sharper cards</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{tabletopSummary.preset.description}</p>
              {tabletopSummary.cellSize ? (
                <p className="text-xs font-medium text-foreground">
                  {tabletopSummary.sheets.length} deck {tabletopSummary.sheets.length === 1 ? 'sheet' : 'sheets'} and {tabletopSummary.textureCount} PNG {tabletopSummary.textureCount === 1 ? 'texture' : 'textures'} with backs; approximately {tabletopSummary.cellSize.cardWidthPx} × {tabletopSummary.cellSize.cardHeightPx}px per card for the first template.
                </p>
              ) : null}
            </div>
            <Button
              variant="outline"
              onClick={() => onExportTabletopSimulatorSpritesheets(tabletopQuality)}
              disabled={generatedDisplayCards.length === 0 || isZipExporting}
              className="w-full gap-2"
            >
              <Gamepad2 className="h-4 w-4" />
              {isTabletopExporting
                ? `Preparing TTS sheets… ${zipProgress?.done ?? 0}/${zipProgress?.total ?? 0}`
                : `Export ${tabletopSummary.preset.label.toLowerCase()} TTS ZIP`}
            </Button>
          </section>

        </CardContent>
      </Card>

      {isZipExporting && zipProgress ? (
        <div
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-4xl rounded-xl border bg-background/95 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur"
          role="status"
          aria-live="polite"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">
                {zipExportKind === 'tabletop-simulator' ? 'Tabletop Simulator export running' : 'PNG set export running'}
              </p>
              <p className="text-xs text-muted-foreground">
                {zipExportKind === 'tabletop-simulator'
                  ? `Rendering ${zipProgress.done} of ${zipProgress.total} 4K spritesheet faces.`
                  : `Rendering ${zipProgress.done} of ${zipProgress.total} individual card faces. Estimated PNG ZIP size about ${formatBytes(estimatedPngZipBytes)}.`}
              </p>
            </div>
            <p className="text-sm font-semibold tabular-nums">{progressPercent}%</p>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Keep CardForge open until the browser download begins. CardForge creates the archive locally and does not upload a second copy.
          </p>
        </div>
      ) : null}
    </>
  );
}
