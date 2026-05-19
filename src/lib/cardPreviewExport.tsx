"use client";

import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toBlob, toCanvas } from 'html-to-image';

import { CardPreview } from '@/components/card-forge/CardPreview';
import { getCardExportDimensionsPx } from '@/lib/cardExportGeometry';
import { getExportProfile, type ExportMode, type ExportProfile } from '@/lib/printValidation';
import type { CardFace, DisplayCard } from '@/types';

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

export async function mountCardPreviewForExport(
  card: DisplayCard,
  exportProfile: ExportProfile,
  face: CardFace = 'front',
  className = 'export-render-card'
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

export function createCardFaceExportRenderer(exportProfile: ExportProfile): CardFaceExportRenderer {
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

  return {
    renderToBlob: async (card, face = 'front') => {
      const { element, widthPx, heightPx } = await renderPreview(card, face);
      const blob = await toBlob(element, {
        pixelRatio: exportProfile.canvasPixelRatio,
        width: widthPx,
        height: heightPx,
        skipFonts: false,
        fetchRequestInit: { mode: 'cors' },
      });
      if (!blob) throw new Error('Card preview did not produce a PNG blob.');
      return blob;
    },
    renderToCanvas: async (card, face = 'front') => {
      const { element, widthPx, heightPx } = await renderPreview(card, face);
      return toCanvas(element, {
        pixelRatio: exportProfile.canvasPixelRatio,
        width: widthPx,
        height: heightPx,
        skipFonts: false,
        fetchRequestInit: { mode: 'cors' },
      });
    },
    cleanup: () => {
      root.unmount();
      if (document.body.contains(container)) document.body.removeChild(container);
    },
  };
}

export async function renderCardToCanvasWithProfile(
  card: DisplayCard,
  exportProfile: ExportProfile,
  face: CardFace = 'front'
): Promise<HTMLCanvasElement> {
  const renderer = createCardFaceExportRenderer(exportProfile);
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
  face: CardFace = 'front'
): Promise<HTMLCanvasElement> {
  return renderCardToCanvasWithProfile(card, getExportProfile(exportMode, exportDpi), face);
}
