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
import { NativePrintButton } from '@/features/card-generator/components/NativePrintButton';
import { CardPreview, CardWatermarkOverlay } from '@/features/card-rendering/client';
import { useOutputActivity } from './OutputActivity';
import type { ZipExportKind } from '@/features/card-generator/hooks/useCardZipExportActions';
import { createPrintProductionPreflight } from '@/features/card-generator/lib/printProductionPreflight';
import {
  RASTER_EXPORT_QUALITY_OPTIONS,
  getRasterExportDimensionsPx,
  getRasterExportQualityOption,
  type ExportMode,
} from '@/features/card-generator/lib/printValidation';
import {
  createCardGridSheets,
  createTabletopSimulatorSheets,
  getTabletopSimulatorCardCellSize,
  getTabletopSimulatorExportPreset,
  getTabletopSimulatorExportProfile,
  type TabletopSimulatorExportQuality,
} from '@/features/card-generator/lib/zipExport';

interface ExportControlsPanelProps {
  setName?: string;
  beforeExport?: () => Promise<void>;
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
  onExportPressCandidate: () => void;
  onExportTabletopSimulatorSpritesheets: (quality: TabletopSimulatorExportQuality, grid?: { columns: number; rows: number }) => void;
  onSelectPaperSize: (size: PaperSize) => void;
  onSetExportDpi: (dpi: number) => void;
  onSetExportMode: (mode: ExportMode) => void;
  onSetPdfOptions: (options: { margin?: number; spacing?: number; cutLines?: boolean; duplexLayout?: PdfDuplexLayout }) => void;
  onStartCheckout: () => void;
}

function GridPreview({ cards, columns, rows, forTabletop, canExportClean, highlightColor }: {
  cards: DisplayCard[]; columns: number; rows: number; forTabletop: boolean; canExportClean: boolean; highlightColor: string;
}) {
  const [open, setOpen] = useState(false);
  const [face, setFace] = useState<'front' | 'back'>('front');
  const geometry = cards[0] ? getCardProductionGeometryMm(cards[0]) : null;
  const previewCells = Math.min(columns * rows, 16);
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary className="cursor-pointer text-sm font-medium">Preview {forTabletop ? 'TTS ' : ''}grid</summary>
    <p className="text-xs text-muted-foreground">Showing up to the first 16 slots on the first sheet.{forTabletop ? ' The final TTS slot is reserved.' : ' Empty slots are transparent.'}</p>
    {open ? <><div className="flex gap-2"><Button type="button" size="sm" variant={face === 'front' ? 'default' : 'outline'} onClick={() => setFace('front')}>Preview fronts</Button>{cards.some(hasCardBacking) ? <Button type="button" size="sm" variant={face === 'back' ? 'default' : 'outline'} onClick={() => setFace('back')}>Preview backs</Button> : null}</div>
      <div className="max-w-full overflow-auto"><div className="grid w-max gap-0" style={{ gridTemplateColumns: `repeat(${Math.min(columns, 16)}, 72px)` }}>
        {Array.from({ length: previewCells }, (_, index) => {
          const card = cards[index];
          const blank = !card || (face === 'back' && !hasCardBacking(card) && !forTabletop);
          const visibleFace = card && face === 'back' && hasCardBacking(card) ? 'back' : 'front';
          return <div key={index} aria-label={blank ? 'Empty grid slot' : undefined} className={`relative w-[72px] overflow-hidden ${forTabletop ? 'bg-white' : 'bg-muted/30'}`} style={{ aspectRatio: geometry ? `${geometry.trimWidthMm} / ${geometry.trimHeightMm}` : undefined }}>
            {card && !blank ? <><CardPreview card={card} face={visibleFace} isPrintMode targetWidthPx={72} highlightColor={highlightColor} />{!canExportClean ? <CardWatermarkOverlay /> : null}</> : null}
          </div>;
        })}
      </div></div>
      {face === 'back' && forTabletop ? <p className="text-xs text-muted-foreground">For cards without a back, the front is used in the TTS back sheet.</p> : null}</> : null}
  </details>;
}

export function ExportControlsPanel({
  beforeExport,
  canExportClean,
  isEntitlementPending,
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
  onExportPrintPngSet,
  onExportTabletopSimulatorSpritesheets,
  onSelectPaperSize,
  onSetExportDpi,
  onSetExportMode,
  onSetPdfOptions,
  onStartCheckout,
}: ExportControlsPanelProps) {
  const outputActivity = useOutputActivity();
  const [tabletopQuality, setTabletopQuality] = useState<TabletopSimulatorExportQuality>('standard');
  const [pdfLayout, setPdfLayout] = useState<'sheets' | 'cards'>('sheets');
  const [spriteColumns, setSpriteColumns] = useState(4);
  const [spriteRows, setSpriteRows] = useState(4);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewFace, setImagePreviewFace] = useState<'front' | 'back'>('front');
  const firstCard = generatedDisplayCards[0];
  const exportFaceCount = generatedDisplayCards.reduce(
    (count, card) => count + (hasCardBacking(card) ? 2 : 1),
    0
  );
  const rasterQuality = getRasterExportQualityOption(exportDpi);
  const productionGeometry = firstCard ? getCardProductionGeometryMm(firstCard) : null;
  const printPreflight = useMemo(
    () => createPrintProductionPreflight(generatedDisplayCards, exportDpi),
    [exportDpi, generatedDisplayCards],
  );
  const rasterDimensions = firstCard
    ? getRasterExportDimensionsPx(firstCard, exportMode, exportDpi)
    : null;
  const spritePlan = useMemo(() => {
    try { return { sheets: createCardGridSheets(generatedDisplayCards, { columns: spriteColumns, rows: spriteRows, cardsPerSheet: spriteColumns * spriteRows }, true), error: null }; }
    catch (error) { return { sheets: [], error: error instanceof Error ? error.message : 'The grid could not be prepared.' }; }
  }, [generatedDisplayCards, spriteColumns, spriteRows]);
  const tabletopSummary = useMemo(() => {
    const preset = getTabletopSimulatorExportPreset(tabletopQuality);
    let sheets: ReturnType<typeof createTabletopSimulatorSheets> = [];
    let geometryError: string | null = null;
    try {
      sheets = createTabletopSimulatorSheets(generatedDisplayCards, tabletopQuality);
    } catch (error) {
      geometryError = error instanceof Error ? error.message : 'Card face geometry is incompatible.';
    }
    const textureCount = sheets.reduce(
      (count, sheet) => count + 1 + (sheet.hasBacks ? 1 : 0),
      0
    );
    if (!firstCard) {
      return { preset, sheets, textureCount, cellSize: null, geometryError };
    }
    const profile = getTabletopSimulatorExportProfile(tabletopQuality);
    const sourceSize = getCardExportDimensionsPx(firstCard, profile.dpi);
    const cellSize = getTabletopSimulatorCardCellSize(
      sourceSize.widthPx * profile.canvasPixelRatio,
      sourceSize.heightPx * profile.canvasPixelRatio,
      preset.grid
    );
    return { preset, sheets, textureCount, cellSize, geometryError };
  }, [firstCard, generatedDisplayCards, tabletopQuality]);

  const progressPercent = zipProgress && zipProgress.total > 0
    ? Math.round((zipProgress.done / zipProgress.total) * 100)
    : 0;
  const isPngSetExporting = isZipExporting && zipExportKind === 'png-set';
  const isPrintPngSetExporting = isZipExporting && zipExportKind === 'print-png-set';
  const isTabletopExporting = isZipExporting && zipExportKind === 'tabletop-simulator';
  const exportsDisabled = isEntitlementPending || generatedDisplayCards.length === 0 || isZipExporting || (outputActivity?.activity?.phase === 'running' || outputActivity?.activity?.phase === 'checking' || outputActivity?.activity?.phase === 'removing');

  const exportProgress = isZipExporting && zipProgress ? (
    <div
      className="rounded-md border bg-background p-3"
      role="status"
      aria-live="polite"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {zipExportKind === 'tabletop-simulator' || zipExportKind === 'spritesheet'
              ? (zipExportKind === 'spritesheet' ? 'PNG spritesheet export running' : 'Tabletop Simulator export running')
              : zipExportKind === 'print-png-set'
                ? 'Print production PNG export running'
                : zipExportKind === 'press-candidate'
                  ? 'Press candidate export running'
                  : 'PNG set export running'}
          </p>
          <p className="text-xs text-muted-foreground">
            {zipExportKind === 'tabletop-simulator' || zipExportKind === 'spritesheet'
              ? `Rendering ${zipProgress.done} of ${zipProgress.total} spritesheet faces.`
              : (zipExportKind === 'print-png-set' || zipExportKind === 'press-candidate')
                ? `Rendering ${zipProgress.done} of ${zipProgress.total} bleed-bearing production faces.`
                : `Rendering ${zipProgress.done} of ${zipProgress.total} individual card faces.`}
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums">{progressPercent}%</p>
      </div>
      <Progress value={progressPercent} className="h-2" />
      <p className="mt-2 text-[11px] text-muted-foreground">
        Keep CardForge open until the browser download begins. CardForge creates the archive locally and does not upload a second copy.
      </p>
    </div>
  ) : null;

  const printPdf = (
          <details className="rounded-md border bg-muted/20 p-3" open>
            <summary className="cursor-pointer font-semibold">Print or save PDF</summary>
            <div className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Use your browser's print dialog to print or save a PDF. Browser print uses the shared card design and its own rendering, not the image quality setting. It does not add extended bleed or certify professional print standards.
              </p>
              <p className="text-xs text-muted-foreground">{isEntitlementPending ? 'Checking download access…' : canExportClean ? 'This output has no CardForge watermark.' : 'This output includes the CardForge watermark.'}</p>
              <div className="space-y-1"><Label htmlFor="browserPdfLayout" className="text-sm font-medium">PDF layout</Label>
                <Select value={pdfLayout} onValueChange={value => setPdfLayout(value as 'sheets' | 'cards')}>
                  <SelectTrigger id="browserPdfLayout"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="sheets">Cards on paper sheets</SelectItem><SelectItem value="cards">One face per card-sized page</SelectItem></SelectContent>
                </Select>
              </div>
              <NativePrintButton cards={generatedDisplayCards} paper={selectedPaperSize} margin={pdfMarginMm} spacing={pdfCardSpacingMm}
                cutLines={pdfIncludeCutLines} duplex={pdfDuplexLayout} highlightColor={richTextHighlightColor}
                canExportClean={canExportClean} disabled={exportsDisabled} beforeExport={beforeExport} layout={pdfLayout} />
              {pdfLayout === 'sheets' ? <>
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
              </> : <p className="text-xs text-muted-foreground">Each front and back is a separate trim-sized page, in card order. This view does not add bleed or crop marks.</p>}
            </div>
          </details>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle id="generator-export-heading" className="text-xl">
            {generatedDisplayCards.length === 0 ? 'Prepare this Set for export' : 'Export the finished set'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {generatedDisplayCards.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 p-3 text-sm">
              <p className="font-semibold text-foreground">Add cards before exporting</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Return to Desk, then create a design or generate cards. Output settings and downloads appear as soon as this Set has its first card.
              </p>
            </div>
          ) : (
            <>
          {printPdf}

          <div className="space-y-1 rounded-md border bg-muted/20 p-3">
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
            {rasterDimensions ? (
              <p className="text-xs text-muted-foreground">
                Approximately {rasterDimensions.effectivePixelsPerInch} PPI for the finished face at this template's intended size. Resizing changes PPI; original artwork may contain less detail. Browser print uses its own rendering.
              </p>
            ) : null}
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

          {generatedDisplayCards.length > 0 ? (
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              <p className="font-semibold text-foreground">{exportEntitlementLabel}</p>
              <p className="mt-1 text-muted-foreground">{exportEntitlementMessage}</p>
              <p className="mt-2 text-muted-foreground">
                CardForge builds exports locally, then your browser saves the single finished file to its configured download location. No server copy is created.
              </p>
            </div>
          ) : null}

          <section aria-labelledby="raster-export-heading" className="space-y-3 rounded-md border bg-muted/20 p-3">
            <div>
              <h3 id="raster-export-heading" className="font-semibold">Individual images and PNG set</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Raster images have fixed pixels. PNG is lossless and best for card masters; JPEG and WebP are smaller, lossy choices in each card&apos;s download menu.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                This quality setting applies to the individual card images, not browser print.
              </p>
            </div>
            {firstCard ? <details onToggle={event => setImagePreviewOpen(event.currentTarget.open)}><summary className="cursor-pointer text-sm font-medium">Preview first card image</summary>
              <p className="text-xs text-muted-foreground">Trim preview; print-production PNGs add bleed outside this design.</p>
              {imagePreviewOpen ? <><div className="flex gap-2"><Button type="button" variant={imagePreviewFace === 'front' ? 'default' : 'outline'} onClick={() => setImagePreviewFace('front')}>Front</Button>{hasCardBacking(firstCard) ? <Button type="button" variant={imagePreviewFace === 'back' ? 'default' : 'outline'} onClick={() => setImagePreviewFace('back')}>Back</Button> : null}</div>
                <div className="relative w-[180px] overflow-hidden"><CardPreview card={firstCard} face={imagePreviewFace === 'back' && hasCardBacking(firstCard) ? 'back' : 'front'} isPrintMode targetWidthPx={180} highlightColor={richTextHighlightColor} />{!canExportClean ? <CardWatermarkOverlay /> : null}</div></> : null}
            </details> : null}
            <div className="space-y-1">
              <Label htmlFor="exportMode" className="text-sm font-medium">Individual image profile</Label>
              <Select value={exportMode} onValueChange={(value) => onSetExportMode(value as ExportMode)}>
                <SelectTrigger id="exportMode" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="physical">Print images</SelectItem>
                  <SelectItem value="virtual">Digital images</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Changes image filenames and quality warnings. Browser print uses its own settings.
              </p>
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
                ZIP size varies with the artwork, number of faces, and selected detail.
              </p>
            ) : null}
            {isPngSetExporting ? exportProgress : null}
          </section>



          {productionGeometry ? (
            <section aria-labelledby="print-production-png-heading" className="space-y-3 rounded-md border bg-muted/20 p-3">
              <div>
                <h3 id="print-production-png-heading" className="font-semibold">Print production PNGs</h3>
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
                  Print PNG preflight: {printPreflight.productionPrepared ? 'Prepared' : 'Blocked'}
                </p>
                <p className="text-muted-foreground">
                  {printPreflight.issueSummary.blockers} blockers · {printPreflight.issueSummary.warnings} review warnings · {printPreflight.issueSummary.standardsGaps} press-standard gap{printPreflight.issueSummary.standardsGaps === 1 ? '' : 's'}.
                </p>
                <p className="font-medium text-foreground">
                  Press ready: {printPreflight.pressReady ? 'Yes' : 'Not yet'}
                </p>
                {!printPreflight.pressReady ? (
                  <p className="text-muted-foreground">
                    These PNGs have no printer-specific color contract. Confirm the file and color requirements with your printer.
                  </p>
                ) : null}
                {printPreflight.issues.filter((issue) => issue.severity === 'blocker').slice(0, 2).map((issue) => (
                  <p key={`${issue.code}:${issue.scope}:${issue.message}`} className="text-[var(--cf-danger)]">
                    {issue.message}
                  </p>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Bleed repeats the authored background edge pixels, not mirrored card borders or text. The trim design stays in place; digital rounded corners are not a physical cut specification. Inspect every edge and keep important content inside the safe area. The ZIP includes preflight and geometry reports.
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
              {isPrintPngSetExporting ? exportProgress : null}
            </section>
          ) : null}

          <section aria-labelledby="sprite-grid-heading" className="space-y-3 rounded-md border bg-muted/20 p-3">
            <h3 id="sprite-grid-heading" className="font-semibold">PNG spritesheets</h3>
            <p className="text-xs text-muted-foreground">Arrange cards in a grid for games or other tools. Fronts and backs are separate PNGs; missing backs stay transparent. Different card proportions start a new sheet. A card's front and back must have matching proportions.</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="spriteColumns">Columns</Label><Input id="spriteColumns" type="number" min="1" value={spriteColumns} onChange={event => { const n = Number(event.target.value); setSpriteColumns(Number.isSafeInteger(n) && n > 0 ? n : 1); }} /></div>
              <div><Label htmlFor="spriteRows">Rows</Label><Input id="spriteRows" type="number" min="1" value={spriteRows} onChange={event => { const n = Number(event.target.value); setSpriteRows(Number.isSafeInteger(n) && n > 0 ? n : 1); }} /></div>
            </div>
            {spritePlan.error ? <p role="alert" className="text-xs text-[var(--cf-danger)]">{spritePlan.error}</p> : rasterDimensions ? <p className="text-xs text-muted-foreground">{spritePlan.sheets.length} front sheet{spritePlan.sheets.length === 1 ? '' : 's'}; up to {spriteColumns * spriteRows} cards per sheet; approximately {rasterDimensions.widthPx * spriteColumns} × {rasterDimensions.heightPx * spriteRows}px for this template. Larger sheets use more memory.</p> : null}
            <GridPreview cards={spritePlan.sheets[0]?.cards.map(item => item.card) ?? []} columns={spriteColumns} rows={spriteRows} forTabletop={false} canExportClean={canExportClean} highlightColor={richTextHighlightColor} />
            <Button variant="outline" className="w-full gap-2" disabled={exportsDisabled || Boolean(spritePlan.error)} onClick={() => onExportTabletopSimulatorSpritesheets('standard', { columns: spriteColumns, rows: spriteRows })}><Download className="h-4 w-4" />Download PNG spritesheets</Button>
            {zipExportKind === 'spritesheet' ? exportProgress : null}
          </section>

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
              <p className="text-xs text-muted-foreground">The final slot is reserved for the hidden card image. Back sheets use the same slot order.</p>
              {tabletopSummary.geometryError ? (
                <p role="alert" className="text-xs text-[var(--cf-danger)]">{tabletopSummary.geometryError}</p>
              ) : null}
              {!tabletopSummary.geometryError && tabletopSummary.sheets.length > 1 ? (
                <p className="text-xs text-muted-foreground">Cards retain their authored order. Different portrait, landscape or square proportions start a new numbered sheet; import the sheets in order.</p>
              ) : null}
              {tabletopSummary.cellSize && !tabletopSummary.geometryError ? (
                <p className="text-xs font-medium text-foreground">
                  {tabletopSummary.sheets.length} deck {tabletopSummary.sheets.length === 1 ? 'sheet' : 'sheets'} and {tabletopSummary.textureCount} PNG {tabletopSummary.textureCount === 1 ? 'texture' : 'textures'} with backs; approximately {tabletopSummary.cellSize.cardWidthPx} × {tabletopSummary.cellSize.cardHeightPx}px per card for the first template.
                </p>
              ) : null}
            </div>
            <GridPreview cards={tabletopSummary.sheets[0]?.cards.map(item => item.card) ?? []} columns={tabletopSummary.preset.grid.columns} rows={tabletopSummary.preset.grid.rows} forTabletop canExportClean={canExportClean} highlightColor={richTextHighlightColor} />
            <Button
              variant="outline"
              onClick={() => onExportTabletopSimulatorSpritesheets(tabletopQuality)}
              disabled={exportsDisabled || Boolean(tabletopSummary.geometryError)}
              className="w-full gap-2"
            >
              <Gamepad2 className="h-4 w-4" />
              {isTabletopExporting
                ? `Preparing TTS sheets… ${zipProgress?.done ?? 0}/${zipProgress?.total ?? 0}`
                : isEntitlementPending
                  ? 'Checking account access…'
                  : `Export ${tabletopSummary.preset.label.toLowerCase()} TTS ZIP`}
            </Button>
            {isTabletopExporting ? exportProgress : null}
          </section>
            </>
          )}

        </CardContent>
      </Card>


    </>
  );
}
