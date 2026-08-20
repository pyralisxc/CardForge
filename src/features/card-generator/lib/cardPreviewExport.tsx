"use client";

import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toCanvas } from 'html-to-image';

import { CardPreview, DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR } from '@/features/card-rendering/client';
import { getCardExportDimensionsPx } from '@/domain/rendering';
import { getExportProfile, type ExportMode, type ExportProfile } from '@/features/card-generator/lib/printValidation';
import type { CardFace } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import type { BrandPresentation } from '@/features/brand-presentation/client';

const RENDER_WAIT_TIMEOUT_MS = 1800;

const waitForFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const waitForImages = async (element: HTMLElement) => {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    });
  }));
};

const waitForPreviewReady = async (element: HTMLElement) => {
  await waitForFrame();
  await waitForFrame();
  if ('fonts' in document) {
    await document.fonts.ready.catch(() => undefined);
  }
  await waitForImages(element);
  await waitForFrame();
};

export interface MountedCardPreview {
  container: HTMLDivElement;
  element: HTMLElement;
  root: Root;
  cleanup: () => void;
}

export interface CardFaceExportRenderer {
  renderToBlob: (card: DisplayCard, face?: CardFace) => Promise<Blob>;
  renderToCanvas: (card: DisplayCard, face?: CardFace) => Promise<HTMLCanvasElement>;
  cleanup: () => void;
}

export interface CardExportWatermark {
  url: string;
  width: number;
  height: number;
  widthPercent: number;
  opacity: number;
}

export const resolveCardExportWatermark = (
  canExportClean: boolean,
  brand: BrandPresentation,
): CardExportWatermark | undefined => canExportClean ? undefined : {
  url: brand.watermarkUrl,
  width: brand.watermarkWidth,
  height: brand.watermarkHeight,
  widthPercent: brand.watermarkWidthPercent,
  opacity: brand.watermarkPreviewOpacity,
};

export const getCardExportWatermarkPlacement = (
  canvasWidth: number,
  canvasHeight: number,
  watermark: CardExportWatermark,
) => {
  const width = Math.round(canvasWidth * watermark.widthPercent / 100);
  const height = Math.round(width * watermark.height / watermark.width);
  return {
    x: Math.round((canvasWidth - width) / 2),
    y: Math.round((canvasHeight - height) / 2),
    width,
    height,
  };
};

const loadWatermarkImage = (source: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('The CardForge watermark could not be loaded for export.'));
  image.src = source;
});

export const applyCardExportWatermark = async (
  canvas: HTMLCanvasElement,
  watermark?: CardExportWatermark,
): Promise<HTMLCanvasElement> => {
  if (!watermark) return canvas;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas rendering is unavailable for the CardForge watermark.');
  const image = await loadWatermarkImage(watermark.url);
  const placement = getCardExportWatermarkPlacement(canvas.width, canvas.height, watermark);
  context.save();
  context.globalAlpha = watermark.opacity;
  context.drawImage(image, placement.x, placement.y, placement.width, placement.height);
  context.restore();
  return canvas;
};

const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('Card preview did not produce a PNG blob.'));
  }, 'image/png');
});

export async function mountCardPreviewForExport(
  card: DisplayCard,
  exportProfile: ExportProfile,
  face: CardFace = 'front',
  className = 'export-render-card',
  highlightColor = DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR,
): Promise<MountedCardPreview> {
  const { widthPx, heightPx } = getCardExportDimensionsPx(card, exportProfile.dpi);
  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed',
    'left:-100000px',
    'top:-100000px',
    'z-index:-1',
    `width:${widthPx}px`,
    `height:${heightPx}px`,
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(createElement(CardPreview, {
    card,
    face,
    isPrintMode: true,
    targetWidthPx: widthPx,
    className,
    highlightColor,
  }));

  const started = performance.now();
  let element = container.firstElementChild as HTMLElement | null;
  while (!element && performance.now() - started < RENDER_WAIT_TIMEOUT_MS) {
    await waitForFrame();
    element = container.firstElementChild as HTMLElement | null;
  }

  if (!element) {
    root.unmount();
    document.body.removeChild(container);
    throw new Error('Card preview did not render for export.');
  }

  await waitForPreviewReady(element);

  return {
    container,
    element,
    root,
    cleanup: () => {
      root.unmount();
      if (document.body.contains(container)) document.body.removeChild(container);
    },
  };
}

export function createCardFaceExportRenderer(
  exportProfile: ExportProfile,
  highlightColor = DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR,
  watermark?: CardExportWatermark,
): CardFaceExportRenderer {
  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed',
    'left:-100000px',
    'top:-100000px',
    'z-index:-1',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(container);

  const root = createRoot(container);

  const renderPreview = async (card: DisplayCard, face: CardFace = 'front') => {
    const { widthPx, heightPx } = getCardExportDimensionsPx(card, exportProfile.dpi);
    container.style.width = `${widthPx}px`;
    container.style.height = `${heightPx}px`;
    root.render(createElement(CardPreview, {
      card,
      face,
      isPrintMode: true,
      targetWidthPx: widthPx,
      className: 'export-render-card',
      highlightColor,
    }));

    await waitForFrame();
    await waitForFrame();
    const started = performance.now();
    let element = container.firstElementChild as HTMLElement | null;
    while (!element && performance.now() - started < RENDER_WAIT_TIMEOUT_MS) {
      await waitForFrame();
      element = container.firstElementChild as HTMLElement | null;
    }

    if (!element) {
      throw new Error('Card preview did not render for export.');
    }

    await waitForPreviewReady(element);
    return { element, widthPx, heightPx };
  };

  const renderToCanvas = async (card: DisplayCard, face: CardFace = 'front') => {
    const { element, widthPx, heightPx } = await renderPreview(card, face);
    const canvas = await toCanvas(element, {
      pixelRatio: exportProfile.canvasPixelRatio,
      width: widthPx,
      height: heightPx,
      skipFonts: false,
      fetchRequestInit: { mode: 'cors' },
    });
    return applyCardExportWatermark(canvas, watermark);
  };

  return {
    renderToBlob: async (card, face = 'front') => canvasToPngBlob(await renderToCanvas(card, face)),
    renderToCanvas,
    cleanup: () => {
      root.unmount();
      if (document.body.contains(container)) document.body.removeChild(container);
    },
  };
}

export async function renderCardToCanvasWithProfile(
  card: DisplayCard,
  exportProfile: ExportProfile,
  face: CardFace = 'front',
  highlightColor = DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR,
  watermark?: CardExportWatermark,
): Promise<HTMLCanvasElement> {
  const renderer = createCardFaceExportRenderer(exportProfile, highlightColor, watermark);
  try {
    return await renderer.renderToCanvas(card, face);
  } finally {
    renderer.cleanup();
  }
}

export async function renderCardToCanvas(
  card: DisplayCard,
  exportMode: ExportMode,
  exportDpi: number,
  face: CardFace = 'front',
  highlightColor = DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR,
  watermark?: CardExportWatermark,
): Promise<HTMLCanvasElement> {
  return renderCardToCanvasWithProfile(card, getExportProfile(exportMode, exportDpi), face, highlightColor, watermark);
}

export async function renderCardToPngBlob(
  card: DisplayCard,
  exportMode: ExportMode,
  exportDpi: number,
  face: CardFace = 'front',
  highlightColor = DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR,
  watermark?: CardExportWatermark,
): Promise<Blob> {
  const renderer = createCardFaceExportRenderer(
    getExportProfile(exportMode, exportDpi),
    highlightColor,
    watermark,
  );
  try {
    return await renderer.renderToBlob(card, face);
  } finally {
    renderer.cleanup();
  }
}
