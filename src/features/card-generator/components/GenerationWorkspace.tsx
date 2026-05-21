"use client";

import type { ChangeEvent, RefObject } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, BringToFront, Download, FilePlus2, FolderDown, FolderUp, PackagePlus, PenTool, Scissors, Settings2, Trash2 } from 'lucide-react';

import { BulkGenerator } from '@/components/card-forge/BulkGenerator';
import { PaperSizeSelector } from '@/components/card-forge/PaperSizeSelector';
import { SaveAsPdfButton } from '@/components/card-forge/SaveAsPdfButton';
import { SingleCardGenerator } from '@/components/card-forge/SingleCardGenerator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { GeneratedCardGallery, type GeneratedGallerySort } from '@/features/card-generator/components/GeneratedCardGallery';
import type { DisplayCard, PaperSize, PdfDuplexLayout, TCGCardTemplate } from '@/types';
import type { ExportMode } from '@/lib/printValidation';
import { buildExportJobPreflight } from '@/lib/exportPreflight';
import type { ExportArtifactType, ExportJobRecord } from '@/lib/exportJobTypes';
import { getZipExportFaceCount, getZipExportLabels } from '@/lib/zipExportLayout';

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
  fileInputRef: RefObject<HTMLInputElement>;
  zipProgress: { done: number; total: number } | null;
  gallerySearch: string;
  gallerySort: GeneratedGallerySort;
  isZipExporting: boolean;
  onOpenTemplateMaker: () => void;
  onSingleCardAdded: (card: DisplayCard) => void;
  onBulkCardsGenerated: (cards: DisplayCard[]) => void;
  onTemplateSelectionChange: (templateId: string | null) => void;
  onSelectPaperSize: (size: PaperSize) => void;
  onSetPdfOptions: (options: { margin?: number; spacing?: number; cutLines?: boolean; duplexLayout?: PdfDuplexLayout }) => void;
  onSetExportMode: (mode: ExportMode) => void;
  onSetExportDpi: (dpi: number) => void;
  onSaveCardSet: () => void;
  onLoadCardSet: (event: ChangeEvent<HTMLInputElement>) => void;
  onExportAllAsZip: () => void;
  onClearCardsRequest: () => void;
  onGallerySearchChange: (value: string) => void;
  onGallerySortChange: (value: GeneratedGallerySort) => void;
  onEditCardRequest: (card: DisplayCard) => void;
}

const BASELINE_PRINT_ZIP_BYTES_PER_FACE_AT_300_DPI = 290_000;
const BROWSER_EXPORT_SECONDS_PER_PRINT_FACE_AT_300_DPI = 0.7;
const LARGE_EXPORT_FACE_THRESHOLD = 1000;
const LARGE_EXPORT_BYTE_THRESHOLD = 250 * 1024 * 1024;

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

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'under a minute';
  if (seconds < 90) return 'about 1 minute';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0
    ? `about ${hours}h ${remainingMinutes}m`
    : `about ${hours}h`;
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
  fileInputRef,
  zipProgress,
  gallerySearch,
  gallerySort,
  isZipExporting,
  onOpenTemplateMaker,
  onSingleCardAdded,
  onBulkCardsGenerated,
  onTemplateSelectionChange,
  onSelectPaperSize,
  onSetPdfOptions,
  onSetExportMode,
  onSetExportDpi,
  onSaveCardSet,
  onLoadCardSet,
  onExportAllAsZip,
  onClearCardsRequest,
  onGallerySearchChange,
  onGallerySortChange,
  onEditCardRequest,
}: GenerationWorkspaceProps) {
  const [workerJob, setWorkerJob] = useState<ExportJobRecord | null>(null);
  const [workerJobError, setWorkerJobError] = useState<string | null>(null);
  const exportFaceCount = getZipExportFaceCount(generatedDisplayCards);
  const dpiScale = Math.max(0.1, (exportDpi / 300) ** 2);
  const estimatedZipBytes = exportFaceCount * BASELINE_PRINT_ZIP_BYTES_PER_FACE_AT_300_DPI * dpiScale;
  const estimatedBrowserExportSeconds = exportMode === 'physical'
    ? exportFaceCount * BROWSER_EXPORT_SECONDS_PER_PRINT_FACE_AT_300_DPI * dpiScale
    : Math.max(10, exportFaceCount * 0.18 * dpiScale);
  const isLargeBrowserExport = exportFaceCount >= LARGE_EXPORT_FACE_THRESHOLD || estimatedZipBytes >= LARGE_EXPORT_BYTE_THRESHOLD;
  const exportProgressPercent = zipProgress && zipProgress.total > 0
    ? Math.round((zipProgress.done / zipProgress.total) * 100)
    : 0;
  const zipExportLabel = exportMode === 'physical'
    ? `Export Print PNG ZIP (${exportFaceCount} faces)`
    : `Export Digital PNG ZIP (${exportFaceCount} images)`;
  const zipOutputLabel = getZipExportLabels(exportMode).outputLabel;
  const workerPreflight = useMemo(() => buildExportJobPreflight({
    cards: generatedDisplayCards,
    artifactType: 'zip',
    exportMode,
    exportDpi,
    paperSize: selectedPaperSize,
    pdfMarginMm,
    pdfCardSpacingMm,
    pdfIncludeCutLines,
    pdfDuplexLayout,
  }), [
    exportDpi,
    exportMode,
    generatedDisplayCards,
    pdfCardSpacingMm,
    pdfDuplexLayout,
    pdfIncludeCutLines,
    pdfMarginMm,
    selectedPaperSize,
  ]);
  const workerProgressPercent = workerJob?.progress.total
    ? Math.round((workerJob.progress.done / workerJob.progress.total) * 100)
    : 0;
  const isWorkerJobActive = workerJob?.status === 'queued' || workerJob?.status === 'running';

  useEffect(() => {
    if (!workerJob || !isWorkerJobActive) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/export-jobs/${workerJob.id}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Unable to read export job ${workerJob.id}.`);
        const payload = await response.json() as { job?: ExportJobRecord };
        if (!cancelled && payload.job) setWorkerJob(payload.job);
      } catch (error) {
        if (!cancelled) setWorkerJobError((error as Error).message);
      }
    };
    const interval = window.setInterval(() => void poll(), 1500);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isWorkerJobActive, workerJob]);

  const startWorkerExport = async (artifactType: ExportArtifactType) => {
    if (generatedDisplayCards.length === 0 || isWorkerJobActive) return;
    setWorkerJobError(null);
    const response = await fetch('/api/export-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cards: generatedDisplayCards,
        artifactType,
        exportMode,
        exportDpi,
        paperSize: selectedPaperSize,
        pdfMarginMm,
        pdfCardSpacingMm,
        pdfIncludeCutLines,
        pdfDuplexLayout,
      }),
    });
    const payload = await response.json() as { job?: ExportJobRecord; error?: { message?: string } };
    if (!response.ok || !payload.job) {
      setWorkerJobError(payload.error?.message || 'Unable to queue export job.');
      return;
    }
    setWorkerJob(payload.job);
  };

  const cancelWorkerExport = async () => {
    if (!workerJob || !isWorkerJobActive) return;
    const response = await fetch(`/api/export-jobs/${workerJob.id}/cancel`, { method: 'POST' });
    const payload = await response.json() as { job?: ExportJobRecord };
    if (payload.job) setWorkerJob(payload.job);
    if (!response.ok) setWorkerJobError('Unable to cancel export job.');
  };

  const downloadWorkerArtifact = () => {
    if (!workerJob?.artifact) return;
    window.location.href = `/api/export-jobs/${workerJob.id}/download`;
  };

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
          <p className="text-muted-foreground max-w-sm">Create a template in the Card Maker first, then come back here to fill in data and generate your cards.</p>
        </div>
        <Button size="lg" onClick={onOpenTemplateMaker} className="gap-2">
          <PenTool className="h-5 w-5" /> Open Card Maker
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
              Bulk Import
            </TabsTrigger>
            <TabsTrigger value="export" className="h-auto flex-col gap-1 px-2 py-2 text-xs">
              <Settings2 className="h-4 w-4" />
              Export & Sets
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
                <CardTitle className="text-xl flex items-center gap-2">Export & Sets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={onSaveCardSet} disabled={generatedDisplayCards.length === 0} className="flex items-center gap-2">
                      <FolderDown className="h-4 w-4" /> Save Set
                    </Button>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2">
                      <FolderUp className="h-4 w-4" /> Load Set
                    </Button>
                    <input type="file" ref={fileInputRef} onChange={onLoadCardSet} accept=".json" aria-hidden="true" style={{ display: 'none' }} />
                  </div>
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
                    templateName={generatedDisplayCards[0]?.template?.name}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (isLargeBrowserExport) {
                        void startWorkerExport('zip');
                        return;
                      }
                      onExportAllAsZip();
                    }}
                    disabled={generatedDisplayCards.length === 0 || isZipExporting || isWorkerJobActive}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" /> {isZipExporting ? `Exporting... ${zipProgress?.done ?? 0}/${zipProgress?.total ?? 0}` : isLargeBrowserExport ? `Queue Worker ZIP (${exportFaceCount} faces)` : zipExportLabel}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void startWorkerExport('pdf')}
                    disabled={generatedDisplayCards.length === 0 || isWorkerJobActive}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" /> Queue Worker PDF
                  </Button>
                  {generatedDisplayCards.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Estimated ZIP size: about {formatBytes(estimatedZipBytes)}. Estimated browser render time: {formatDuration(estimatedBrowserExportSeconds)}.
                    </p>
                  )}
                  {generatedDisplayCards.length > 0 && (
                    <div className="rounded-md border bg-muted/40 p-3 text-xs">
                      <div className="mb-1 font-semibold">Worker export preflight</div>
                      <p>
                        {workerPreflight.cardCount} cards / {workerPreflight.faceCount} faces at {workerPreflight.dimensionsPx.widthPx} x {workerPreflight.dimensionsPx.heightPx}px.
                        Estimated worker artifact: {formatBytes(workerPreflight.estimatedBytes)} over {formatDuration(workerPreflight.estimatedSeconds)}.
                      </p>
                      {workerPreflight.warnings.length > 0 && (
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          {workerPreflight.warnings.map((warning) => (
                            <li key={warning.code}>{warning.message}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {generatedDisplayCards.length > 0 && isLargeBrowserExport && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-950 dark:text-amber-100">
                      <div className="mb-1 flex items-center gap-2 font-semibold">
                        <AlertTriangle className="h-4 w-4" />
                        Large export uses worker queue
                      </div>
                      <p>
                        CardForge will queue large ZIPs to the local export worker by default so the browser stays responsive.
                        Run <code className="rounded bg-background/70 px-1">npm run export:worker</code> while production jobs are queued.
                      </p>
                    </div>
                  )}
                  {workerJob && (
                    <div className="rounded-md border bg-card p-3 text-xs">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">Worker job: {workerJob.status}</p>
                          <p className="text-muted-foreground">{workerJob.progress.label || workerJob.id}</p>
                        </div>
                        <p className="font-semibold tabular-nums">{workerProgressPercent}%</p>
                      </div>
                      <Progress value={workerProgressPercent} className="h-1.5" />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {isWorkerJobActive && (
                          <Button type="button" variant="outline" size="sm" onClick={() => void cancelWorkerExport()}>
                            Cancel Worker Job
                          </Button>
                        )}
                        {workerJob.status === 'completed' && workerJob.artifact && (
                          <Button type="button" variant="default" size="sm" onClick={downloadWorkerArtifact}>
                            Download {workerJob.artifact.fileName}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {(workerJobError || workerJob?.error) && (
                    <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                      {workerJobError || workerJob?.error}
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
          Keep CardForge open until the download begins. Large {zipOutputLabel} batches can take a long time in-browser; split jobs if the machine feels strained.
        </p>
      </div>
    )}
    {workerJob && isWorkerJobActive && (
      <div
        className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-4xl rounded-xl border bg-background/95 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur"
        role="status"
        aria-live="polite"
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Worker export {workerJob.status}</p>
            <p className="text-xs text-muted-foreground">
              {workerJob.progress.done} of {workerJob.progress.total} faces. {workerJob.progress.label || 'Waiting for the local worker.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold tabular-nums">{workerProgressPercent}%</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void cancelWorkerExport()}>
              Cancel
            </Button>
          </div>
        </div>
        <Progress value={workerProgressPercent} className="h-2" />
        <p className="mt-2 text-[11px] text-muted-foreground">
          Worker jobs are stored in <code>storage/export-jobs</code>. Run <code>npm run export:worker</code> if this remains queued.
        </p>
      </div>
    )}
    </>
  );
}
