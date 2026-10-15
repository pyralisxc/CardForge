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
import { getCardExportDimensionsPx, getCardProductionGeometryMm, hasCardBacking } from '@/domain/rendering';
import type { DisplayCard, PaperSize, PdfDuplexLayout } from '@/domain/rendering';
import { PaperSizeSelector } from '@/features/card-generator/components/PaperSizeSelector';
import { SaveAsPdfButton } from '@/features/card-generator/components/SaveAsPdfButton';
import type { PdfXExportOptions, ZipExportKind } from '@/features/card-generator/hooks/useCardZipExportActions';
import { createPrintProductionPreflight } from '@/features/card-generator/lib/printProductionPreflight';
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
  isEntitlementPending: boolean;
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
  onExportPrintPngSet: () => void;
  onExportPrintPdfX: (options: PdfXExportOptions) => void;
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
  isEntitlementPending,
  exportDpi,
  exportEntitlementLabel,
  exportEntitlementMessage,
  exportGateMessage,
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
  onExportPrintPngSet,
  onExportPrintPdfX,
  onExportTabletopSimulatorSpritesheets,
  onSelectPaperSize,
  onSetExportDpi,
  onSetExportMode,
  onSetPdfOptions,
  onStartCheckout,
}: ExportControlsPanelProps) {
  const [destination, setDestination] = useState<'images' | 'digital-pdf' | 'tabletop' | 'home-print' | 'print-package'>('images');
  const [printCondition, setPrintCondition] = useState('gracol');
  const [customIcc, setCustomIcc] = useState<File | undefined>();
  const [customCondition, setCustomCondition] = useState('');
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const exportMode: ExportMode = destination === 'home-print' || destination === 'print-package' ? 'physical' : 'virtual';
  const [tabletopQuality, setTabletopQuality] = useState<TabletopSimulatorExportQuality>('standard');
  const firstCard = generatedDisplayCards[0];
  const exportFaceCount = generatedDisplayCards.reduce(
    (count, card) => count + (hasCardBacking(card) ? 2 : 1),
    0
  );
  const rasterQuality = getRasterExportQualityOption(exportDpi);
  const productionGeometry = firstCard && exportMode === 'physical'
    ? getCardProductionGeometryMm(firstCard)
    : null;
  const printPreflight = useMemo(
    () => createPrintProductionPreflight(generatedDisplayCards, exportDpi),
    [exportDpi, generatedDisplayCards],
  );
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
  const isPrintPngSetExporting = isZipExporting && (zipExportKind === 'print-png-set' || zipExportKind === 'print-pdfx-set');
  const isTabletopExporting = isZipExporting && zipExportKind === 'tabletop-simulator';
  const exportsDisabled = isEntitlementPending || generatedDisplayCards.length === 0 || isZipExporting || isPdfExporting;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle id="generator-export-heading" className="text-xl">
            {generatedDisplayCards.length === 0 ? 'Prepare this Set for export' : 'Export the finished set'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {generatedDisplayCards.length > 0 ? (
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              <p className="font-semibold text-foreground">{isEntitlementPending ? 'Checking account access…' : exportEntitlementLabel}</p>
              <p className="mt-1 text-muted-foreground">{isEntitlementPending ? 'CardForge is confirming your download access before it applies watermark or project-file rules.' : exportEntitlementMessage}</p>
              <p className="mt-2 text-muted-foreground">
                CardForge builds exports locally, then your browser saves the single finished file to its configured download location. No server copy is created.
              </p>
            </div>
          ) : null}

          {generatedDisplayCards.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 p-3 text-sm">
              <p className="font-semibold text-foreground">Add cards before exporting</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Return to Desk, then create a design or generate cards. Output settings and downloads appear as soon as this Set has its first card.
              </p>
            </div>
          ) : (
            <>
          <div className="space-y-1">
            <Label htmlFor="outputDestination" className="text-sm font-medium">What would you like to make?</Label>
            <Select value={destination} disabled={isZipExporting || isPdfExporting} onValueChange={(value) => {
              const next = value as typeof destination;
              setDestination(next);
              onSetExportMode(next === 'home-print' || next === 'print-package' ? 'physical' : 'virtual');
            }}>
              <SelectTrigger id="outputDestination" className="h-11 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="images">Images to share</SelectItem>
                <SelectItem value="digital-pdf">Digital reading PDF</SelectItem>
                <SelectItem value="tabletop">Play in Tabletop Simulator</SelectItem>
                <SelectItem value="home-print">Print at home</SelectItem>
                <SelectItem value="print-package">Files for a print shop</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">One Set, different outputs. Your cards and designs stay unchanged.</p>
          </div>

          {!isEntitlementPending && !canExportClean && exportGateMessage ? (
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

          {destination !== 'tabletop' ? (
            <details className="rounded-md border bg-muted/20 p-3">
              <summary className="cursor-pointer text-sm font-medium">Advanced image quality · {rasterQuality.label}</summary>
              <fieldset disabled={exportsDisabled} className="mt-3 space-y-3">
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
              </fieldset>
            </details>
          ) : null}

          {destination === 'images' ? (
          <section aria-labelledby="raster-export-heading" className="space-y-3 rounded-md border bg-muted/20 p-3">
            <div>
              <h3 id="raster-export-heading" className="font-semibold">Images to share</h3>
              <p className="mt-1 text-xs text-muted-foreground">Lossless PNG copies, with each front and back named and ordered together. Individual cards also offer JPEG and WebP in their download menu.</p>
              {rasterDimensions ? <p className="mt-1 text-xs text-muted-foreground">{rasterDimensions.widthPx} × {rasterDimensions.heightPx}px for the first template · {rasterQuality.label}.</p> : null}
            </div>
            <Button
              variant="outline"
              onClick={onExportAllAsZip}
              disabled={exportsDisabled}
              className="w-full gap-2"
            >
              <Download className="h-4 w-4" />
              {isPngSetExporting
                ? `Preparing PNGs… ${zipProgress?.done ?? 0}/${zipProgress?.total ?? 0}`
                : isEntitlementPending
                  ? 'Checking account access…'
                  : `Download PNG set (${exportFaceCount} ${exportFaceCount === 1 ? 'file' : 'files'})`}
            </Button>
            {generatedDisplayCards.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Estimated PNG ZIP size: about {formatBytes(estimatedPngZipBytes)}. Exact size depends on artwork and template complexity.
              </p>
            ) : null}
          </section>
          ) : null}

          {destination === 'digital-pdf' ? (
            <section aria-labelledby="digital-pdf-heading" className="space-y-3 rounded-md border bg-muted/20 p-3">
              <h3 id="digital-pdf-heading" className="font-semibold">Digital reading PDF</h3>
              <p className="text-xs text-muted-foreground">One face per page for reading on a phone, tablet or desktop. Each back follows its front. Pages keep the authored proportions, with no bleed or cutting marks.</p>
              <p className="text-xs text-muted-foreground">RGB image pages · {rasterQuality.label}. Text is part of the artwork; this is a viewing copy, not an editable project or searchable document.</p>
              <SaveAsPdfButton generatedDisplayCards={generatedDisplayCards} selectedPaperSize={selectedPaperSize} pdfMarginMm={pdfMarginMm} pdfCardSpacingMm={pdfCardSpacingMm} pdfIncludeCutLines={false} pdfDuplexLayout={pdfDuplexLayout} exportMode="virtual" exportDpi={exportDpi} richTextHighlightColor={richTextHighlightColor} canExportClean={canExportClean} disabled={exportsDisabled} outputProfile="screen" onBusyChange={setIsPdfExporting} templateName={firstCard?.template?.name} />
            </section>
          ) : null}

          {destination === 'print-package' && productionGeometry ? (
            <section aria-labelledby="print-production-png-heading" className="space-y-3 rounded-md border bg-muted/20 p-3">
              <div>
                <h3 id="print-production-png-heading" className="font-semibold">Files for a print shop</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Keeps the authored trim design unchanged and adds the format&apos;s bleed outside it. The ZIP includes exact production geometry metadata for each face.
                </p>
              </div>
              <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <p><span className="font-medium text-foreground">Trim:</span> {productionGeometry.trimWidthMm} × {productionGeometry.trimHeightMm} mm</p>
                <p><span className="font-medium text-foreground">Bleed:</span> {productionGeometry.bleedMm} mm on every edge</p>
                <p><span className="font-medium text-foreground">Safe margin:</span> {productionGeometry.safeMarginMm} mm inside trim</p>
                <p><span className="font-medium text-foreground">Production face:</span> {productionGeometry.productionWidthMm} × {productionGeometry.productionHeightMm} mm</p>
              </div>
              <div className="grid gap-2 border border-[var(--cf-border-subtle)] bg-[var(--cf-canvas)] p-3 text-xs">
                <p className="font-semibold text-foreground">
                  Production preflight: {printPreflight.productionPrepared ? 'Prepared' : 'Blocked'}
                </p>
                <p className="text-muted-foreground">
                  {printPreflight.issueSummary.blockers} blockers · {printPreflight.issueSummary.warnings} review warnings · {printPreflight.issueSummary.standardsGaps} press-standard gap{printPreflight.issueSummary.standardsGaps === 1 ? '' : 's'}.
                </p>
                <p className="font-medium text-foreground">
                  Press ready: {printPreflight.pressReady ? 'Yes' : 'Not yet'}
                </p>
                {!printPreflight.pressReady ? (
                  <p className="text-muted-foreground">
                    These RGB files have no PDF/X standard or verified printing-condition ICC output intent. Production-prepared files can still be reviewed with a print partner, but they are not certified press-ready output.
                  </p>
                ) : null}
                {printPreflight.issues.filter((issue) => issue.severity === 'blocker').slice(0, 2).map((issue) => (
                  <p key={`${issue.code}:${issue.scope}:${issue.message}`} className="text-[var(--cf-danger)]">
                    {issue.message}
                  </p>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Bleed is edge-extended from the canonical trim render. Inspect artwork at every edge before professional production. The ZIP includes a deterministic preflight JSON report alongside the geometry manifest.
              </p>
              <Button
                variant="outline"
                onClick={onExportPrintPngSet}
                disabled={exportsDisabled || !printPreflight.productionPrepared}
                className="w-full gap-2"
              >
                <Download className="h-4 w-4" />
                {isPrintPngSetExporting
                  ? `Preparing print PNGs… ${zipProgress?.done ?? 0}/${zipProgress?.total ?? 0}`
                  : isEntitlementPending
                    ? 'Checking account access…'
                    : `Download print production PNG ZIP (${exportFaceCount} ${exportFaceCount === 1 ? 'face' : 'faces'})`}
              </Button>
              <details className="border-t pt-3">
                <summary className="cursor-pointer text-sm font-medium">Advanced professional PDF · PDF/X-4 candidate</summary>
                <fieldset disabled={exportsDisabled} className="mt-3 space-y-3">
                  <p className="text-xs text-muted-foreground">One bleed-bearing PDF per face, with trim boxes and an embedded printing-condition ICC profile. Generator structural checks run before download. Independent PDF/X validation and your print shop&apos;s acceptance are still needed.</p>
                  <Label htmlFor="printCondition" className="text-xs">Printing condition</Label>
                  <Select value={printCondition} onValueChange={setPrintCondition} disabled={exportsDisabled}>
                    <SelectTrigger id="printCondition" className="h-11 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gracol">GRACoL 2013 CRPC6 · coated reference</SelectItem>
                      <SelectItem value="custom">Use another printing ICC profile</SelectItem>
                    </SelectContent>
                  </Select>
                  {printCondition === 'custom' ? <>
                    <Label htmlFor="customPrintIcc" className="text-xs">CMYK printing ICC file · up to 8 MB</Label>
                    <Input id="customPrintIcc" type="file" accept=".icc,.icm" onChange={(event) => setCustomIcc(event.target.files?.[0])} />
                    <Label htmlFor="customPrintCondition" className="text-xs">Printing condition name</Label>
                    <Input id="customPrintCondition" value={customCondition} maxLength={200} placeholder="For example, PSO Coated v3 / FOGRA51" onChange={(event) => setCustomCondition(event.target.value)} />
                  </> : null}
                  <p className="text-xs text-muted-foreground">This describes a printing process and paper, not every printer. RGB artwork stays color-managed RGB; selecting an ICC output intent does not convert pixels to CMYK.</p>
                  <Button variant="outline" className="w-full" disabled={exportsDisabled || !printPreflight.productionPrepared || (printCondition === 'custom' && (!customIcc || !customCondition.trim()))} onClick={() => onExportPrintPdfX(printCondition === 'custom' ? { iccFile: customIcc, condition: customCondition } : {})}>
                    {zipExportKind === 'print-pdfx-set' ? `Preparing PDF/X candidates… ${zipProgress?.done ?? 0}/${zipProgress?.total ?? 0}` : 'Download PDF/X-4 candidate ZIP'}
                  </Button>
                  <p className="text-xs text-muted-foreground">Prepared → structural checks → independent standards validation → destination acceptance. This download completes the first two steps.</p>
                </fieldset>
              </details>
            </section>
          ) : null}

          {destination === 'home-print' ? (
          <section aria-labelledby="home-print-heading" className="rounded-md border bg-muted/20 p-3">
            <h3 id="home-print-heading" className="font-semibold">Print at home</h3>
            <div className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">Download a sheet PDF, then use your usual printer dialog. Print at actual size (100%) and match the duplex flip edge. Try one sheet before printing the full Set.</p>
              <details><summary className="cursor-pointer text-sm font-medium">Advanced paper and layout</summary>
              <fieldset disabled={exportsDisabled} className="mt-3 space-y-3">
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
                      <SelectItem value="separate-pages">Duplex sheets · flip long edge</SelectItem>
                      <SelectItem value="separate-pages-short-edge">Duplex sheets · flip short edge</SelectItem>
                      <SelectItem value="same-page">Front + back on same sheet</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Duplex sheets pair every front sheet with its back, placing backs for the selected paper-flip edge. Match that edge in your printer settings and print a two-sided alignment proof at actual size. Same sheet places each back after its front for review, hand cutting, or manual assembly.
                  </p>
                </div>
              ) : null}
              </fieldset></details>
              <p className="text-xs text-muted-foreground">{selectedPaperSize.name} · {pdfDuplexLayout === 'same-page' ? 'front and back on the same sheet' : pdfDuplexLayout === 'separate-pages-short-edge' ? 'duplex, flip short edge' : 'duplex, flip long edge'} · {pdfIncludeCutLines ? 'cut lines included' : 'no cut lines'}.</p>
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
                disabled={exportsDisabled}
                onBusyChange={setIsPdfExporting}
                templateName={firstCard?.template?.name}
              />
            </div>
          </section>
          ) : null}

          {destination === 'tabletop' ? (
          <section aria-labelledby="tabletop-export-heading" className="space-y-3 rounded-md border bg-muted/20 p-3">
            <div>
              <h3 id="tabletop-export-heading" className="font-semibold">Tabletop Simulator</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                PNG deck sheets up to 4K plus a JSON manifest. Deck detail controls this output independently.
              </p>
            </div>
            <details><summary className="cursor-pointer text-sm font-medium">Advanced deck detail</summary>
            <fieldset disabled={exportsDisabled} className="mt-3 space-y-1">
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
            </fieldset>
            </details>
            <Button
              variant="outline"
              onClick={() => onExportTabletopSimulatorSpritesheets(tabletopQuality)}
              disabled={exportsDisabled}
              className="w-full gap-2"
            >
              <Gamepad2 className="h-4 w-4" />
              {isTabletopExporting
                ? `Preparing TTS sheets… ${zipProgress?.done ?? 0}/${zipProgress?.total ?? 0}`
                : isEntitlementPending
                  ? 'Checking account access…'
                  : `Export ${tabletopSummary.preset.label.toLowerCase()} TTS ZIP`}
            </Button>
          </section>
          ) : null}
            </>
          )}

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
                {zipExportKind === 'tabletop-simulator'
                  ? 'Tabletop Simulator export running'
                  : (zipExportKind === 'print-png-set' || zipExportKind === 'print-pdfx-set')
                    ? 'Print production package running'
                    : 'PNG set export running'}
              </p>
              <p className="text-xs text-muted-foreground">
                {zipExportKind === 'tabletop-simulator'
                  ? `Rendering ${zipProgress.done} of ${zipProgress.total} 4K spritesheet faces.`
                  : (zipExportKind === 'print-png-set' || zipExportKind === 'print-pdfx-set')
                    ? `Rendering ${zipProgress.done} of ${zipProgress.total} bleed-bearing production faces.`
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