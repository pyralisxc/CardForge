"use client";

import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toCanvas } from 'html-to-image';

import { CardPreview } from '@/components/card-forge/CardPreview';
import { getCardExportHeightPx } from '@/lib/cardExportGeometry';
import { getExportProfile, type ExportMode, type ExportProfile } from '@/lib/printValidation';
import type { DisplayCard } from '@/types';

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

export async function mountCardPreviewForExport(
  card: DisplayCard,
  exportProfile: ExportProfile,
  className = 'export-render-card'
): Promise<MountedCardPreview> {
  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed',
    'left:-100000px',
    'top:-100000px',
    'z-index:-1',
    `width:${exportProfile.renderWidthPx}px`,
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(createElement(CardPreview, {
    card,
    isPrintMode: true,
    targetWidthPx: exportProfile.renderWidthPx,
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

export async function renderCardToCanvasWithProfile(
  card: DisplayCard,
  exportProfile: ExportProfile
): Promise<HTMLCanvasElement> {
  const mounted = await mountCardPreviewForExport(card, exportProfile);
  try {
    return await toCanvas(mounted.element, {
      pixelRatio: exportProfile.canvasPixelRatio,
      width: exportProfile.renderWidthPx,
      height: getCardExportHeightPx(card, exportProfile.renderWidthPx),
      skipFonts: false,
      fetchRequestInit: { mode: 'cors' },
    });
  } finally {
    mounted.cleanup();
  }
}

export async function renderCardToCanvas(
  card: DisplayCard,
  exportMode: ExportMode,
  exportDpi: number
): Promise<HTMLCanvasElement> {
  return renderCardToCanvasWithProfile(card, getExportProfile(exportMode, exportDpi));
}
