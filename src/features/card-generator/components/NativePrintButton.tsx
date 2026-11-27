"use client";

import { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { CardPreview } from '@/features/card-rendering/client';
import type { DisplayCard, PaperSize, PdfDuplexLayout } from '@/domain/rendering';
import { getCardFaceCanvas, hasCardBacking } from '@/domain/rendering';
import { useBrandPresentation } from '@/features/brand-presentation/client';
import { preparePreviewForExport } from '../lib/cardPreviewExport';
import { createPdfDuplexBackPage, createPdfPlacementPages, getPdfCropMarkSegments, type PdfCardPlacement } from '../lib/pdfProductionLayout';
import { useOutputActivity } from './OutputActivity';
import { validateCleanOutputAccess } from '../lib/outputCleanAccess';
import { getProjectPersistenceScope } from '@/features/project/client/persistence-workspace';

interface NativePrintButtonProps {
  cards: DisplayCard[];
  paper: PaperSize;
  margin: number;
  spacing: number;
  cutLines: boolean;
  duplex: PdfDuplexLayout;
  highlightColor: string;
  canExportClean: boolean;
  disabled: boolean;
  beforeExport?: () => Promise<void>;
}

// A print view is temporary. The browser's print lifecycle releases it; if
// no afterprint event arrives, the creator can explicitly remove it later.
let activePrintView: { cleanup: () => void; preparing: boolean } | null = null;

function PrintViewMounted({ onReady }: { onReady: () => void }) {
  useEffect(() => { onReady(); }, [onReady]);
  return null;
}

function PrintPages({ pages, paper, cutLines, highlightColor, watermark }: {
  pages: PdfCardPlacement[][]; paper: PaperSize; cutLines: boolean; highlightColor: string;
  watermark?: { url: string; width: number; height: number; widthPercent: number; opacity: number };
}) {
  return <>
    <style>{`@page { size: ${paper.widthMm}mm ${paper.heightMm}mm; margin: 0; }
      @media print {
        html, body { height: auto !important; overflow: visible !important; margin: 0 !important; background: white !important; }
        body > :not([data-cardforge-native-print]) { display: none !important; }
        [data-cardforge-native-print] { position: static !important; left: auto !important; top: auto !important; width: auto !important; }
        [data-cardforge-native-print] * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        [data-cardforge-print-sheet] { break-after: page; page-break-after: always; }
        [data-cardforge-print-sheet]:last-child { break-after: auto; page-break-after: auto; }
      }`}</style>
    {pages.map((placements, pageIndex) => <div key={pageIndex} data-cardforge-print-sheet style={{ width: `${paper.widthMm}mm`, height: `${paper.heightMm}mm`, position: 'relative', overflow: 'hidden', background: 'white' }}>
      {placements.map((placement, index) => {
        const outputWidth = placement.trimWidth * 96 / 25.4;
        const canvasWidth = getCardFaceCanvas(placement.card, placement.face)?.width || outputWidth;
        return <div key={`${placement.card.uniqueId}-${placement.face}-${index}`} style={{ position: 'absolute', left: `${placement.trimX}mm`, top: `${placement.trimY}mm`, width: `${placement.trimWidth}mm`, height: `${placement.trimHeight}mm` }}>
        <div style={{ zoom: outputWidth / canvasWidth }}><CardPreview card={placement.card} face={placement.face} isPrintMode targetWidthPx={canvasWidth} highlightColor={highlightColor} /></div>
        {watermark ? <img alt="" aria-hidden="true" src={watermark.url} width={watermark.width} height={watermark.height} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: `${watermark.widthPercent}%`, height: 'auto', opacity: watermark.opacity, pointerEvents: 'none' }} /> : null}
      </div>; })}
      {cutLines ? <svg aria-hidden="true" width="100%" height="100%" viewBox={`0 0 ${paper.widthMm} ${paper.heightMm}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {placements.flatMap((placement, index) => getPdfCropMarkSegments(placement).map((line, n) => <line key={`${index}-${n}`} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="#aaa" strokeWidth="0.1" />))}
      </svg> : null}
    </div>)}
  </>;
}

export function NativePrintButton({ cards, paper, margin, spacing, cutLines, duplex, highlightColor, canExportClean, disabled, beforeExport }: NativePrintButtonProps) {
  const output = useOutputActivity();
  const { toast } = useToast();
  const brand = useBrandPresentation();
  const [hasPrintView, setHasPrintView] = useState(false);
  const [canClear, setCanClear] = useState(false);
  useEffect(() => { setHasPrintView(Boolean(activePrintView)); setCanClear(Boolean(activePrintView && !activePrintView.preparing)); }, [output?.activity?.phase]);

  const print = async () => {
    if (activePrintView) { setHasPrintView(true); return; }
    const startScope = getProjectPersistenceScope();
    const activity = output?.begin('Browser print');
    if (output && !activity) return;
    let root: Root | null = null;
    let host: HTMLDivElement | null = null;
    let requested = false;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      window.removeEventListener('afterprint', cleanup);
      root?.unmount(); host?.remove();
      activePrintView = null; setHasPrintView(false); setCanClear(false);
    };
    try {
      if (!CSS.supports('zoom', '1')) throw new Error('This browser cannot prepare the print view. Download the PDF instead.');
      await beforeExport?.();
      if (activity && !activity.isCurrent()) throw new Error('The active workspace changed. Start browser print again.');
      const width = paper.widthMm - 2 * margin, height = paper.heightMm - 2 * margin;
      const isDuplex = duplex !== 'same-page';
      const items = isDuplex ? cards : cards.flatMap((card) => hasCardBacking(card) ? [{ card, face: 'front' as const }, { card, face: 'back' as const }] : [{ card, face: 'front' as const }]);
      const fronts = createPdfPlacementPages({ items, forcedFace: isDuplex ? 'front' : undefined, printableWidthMm: width, printableHeightMm: height, marginMm: margin, spacingMm: spacing, physical: true, includeCutLines: cutLines, trimOnly: true });
      const backs = isDuplex && cards.some(hasCardBacking);
      const pages = fronts.flatMap((page) => backs ? [page, createPdfDuplexBackPage(page, { widthMm: paper.widthMm, heightMm: paper.heightMm, flip: duplex === 'separate-pages-short-edge' ? 'short-edge' : 'long-edge' }, { trimOnly: true })] : [page]);
      activity?.stage('Preparing browser print');
      host = document.createElement('div'); host.dataset.cardforgeNativePrint = 'true';
      host.style.cssText = 'position:absolute;left:-100000px;top:0;pointer-events:none;'; document.body.appendChild(host);
      root = createRoot(host); activePrintView = { cleanup, preparing: true }; setHasPrintView(true);
      const hostElement = host;
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('Browser print preparation took too long. Try again.')), 120_000);
        root!.render(<><PrintPages pages={pages} paper={paper} cutLines={cutLines} highlightColor={highlightColor} watermark={canExportClean ? undefined : { url: brand.watermarkUrl, width: brand.watermarkWidth, height: brand.watermarkHeight, widthPercent: brand.watermarkWidthPercent, opacity: brand.watermarkPreviewOpacity }} />
          <PrintViewMounted onReady={() => { window.clearTimeout(timer); resolve(); }} /></>);
      });
      // A print view may mount thousands of local assets at once; a single-face
      // capture's readiness budget is too short for that larger view.
      await preparePreviewForExport(hostElement, 60_000);
      await beforeExport?.();
      if (canExportClean) await validateCleanOutputAccess(startScope);
      if (activity && !activity.isCurrent()) throw new Error('The active workspace changed. Start browser print again.');
      if (startScope !== getProjectPersistenceScope()) throw new Error('The active workspace changed. Start browser print again.');
      if (activePrintView) activePrintView.preparing = false;
      setCanClear(true);
      window.addEventListener('afterprint', cleanup, { once: true });
      requested = true;
      window.print();
      activity?.finish('print-requested', 'Use the browser dialog to print or save as PDF.');
    } catch (error) {
      cleanup();
      const message = error instanceof Error ? error.message : 'Browser print could not be prepared.';
      activity?.finish('failed', message); toast({ title: 'Browser print could not be prepared', description: message, variant: 'destructive' });
    } finally {
      if (!requested) cleanup();
    }
  };

  return <div className="space-y-2">
    <Button type="button" variant="outline" className="w-full" disabled={disabled || hasPrintView} onClick={() => void print()}>Print using browser</Button>
    {hasPrintView && canClear ? <button type="button" className="text-xs underline" onClick={() => {
      if (window.confirm('Finish using the browser print dialog before removing its temporary print view. Remove it now?')) { activePrintView?.cleanup(); setHasPrintView(false); setCanClear(false); }
    }}>Remove temporary print view</button> : null}
  </div>;
}
