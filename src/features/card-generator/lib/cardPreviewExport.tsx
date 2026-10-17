"use client";

import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toCanvas } from 'html-to-image';

import { CardPreview, DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR } from '@/features/card-rendering/client';
import { getCardExportDimensionsPx, getCardFaceCanvas, getCardFaceTemplate, getCardPhysicalSizeMm, getCardPreviewLayout, getTemplateProductionGeometryMm } from '@/domain/rendering';
import { getExportProfile, type ExportMode, type ExportProfile } from '@/features/card-generator/lib/printValidation';
import type { CardFace } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import type { BrandPresentation } from '@/features/brand-presentation/client';
import { measureSourceImageDetail, transformedImageDimensions, splitCssLayers, backgroundImageDimensions, type SourceImageDetail } from './sourceImageDetail';

const RENDER_WAIT_TIMEOUT_MS = 1800;

const waitForFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const waitForImages = async (element: HTMLElement) => {
  const images = Array.from(element.querySelectorAll('img'));
  const started = performance.now();
  while (images.some((image) => !image.getAttribute('src'))) {
    if (performance.now() - started > RENDER_WAIT_TIMEOUT_MS) {
      throw new Error('A card image is unavailable. Restore its browser artwork before exporting or saving its preview.');
    }
    await waitForFrame();
  }
  await Promise.all(images.map(async (image) => {
    try {
      await image.decode();
    } catch {
      throw new Error('A card image could not be loaded. Restore the missing image before exporting or saving its preview.');
    }
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error('A card image is empty. Restore the image before exporting or saving its preview.');
    }
  }));
};

const readBackgroundImages = async (element: HTMLElement) => {
  const entries = Array.from([element, ...element.querySelectorAll<HTMLElement>('*')]).flatMap((node) => {
    const style = getComputedStyle(node);
    return splitCssLayers(style.backgroundImage).flatMap((layer, index) => {
      const url = /^url\(["']?(.*?)["']?\)$/.exec(layer)?.[1];
      const vectorUrls: string[] = JSON.parse(node.dataset.vectorBackgroundUrls ?? '[]');
      return url ? [{ node, style, url, index, vector: vectorUrls.includes(url) }] : [];
    });
  });
  return Promise.all(entries.map(async (entry) => {
    const image = new Image();
    image.src = entry.url;
    try { await image.decode(); } catch { throw new Error('A card background image could not be loaded. Restore the missing image before exporting.'); }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('A card background image is empty. Restore it before exporting.');
    return { ...entry, image };
  }));
};

const waitForPreviewReady = async (element: HTMLElement) => {
  await waitForFrame();
  await waitForFrame();
  if ('fonts' in document) {
    await document.fonts.ready.catch(() => undefined);
  }
  const started = performance.now();
  while (element.querySelector('[data-export-assets-pending]')) {
    if (performance.now() - started > RENDER_WAIT_TIMEOUT_MS) throw new Error('A card background or frame asset is unavailable. Restore its browser artwork before exporting.');
    await waitForFrame();
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
  getSourceImageDetails: () => SourceImageDetail[];
  renderToBlob: (card: DisplayCard, face?: CardFace) => Promise<Blob>;
  renderToCanvas: (card: DisplayCard, face?: CardFace) => Promise<HTMLCanvasElement>;
  renderProductionToBlob: (card: DisplayCard, face?: CardFace) => Promise<Blob>;
  renderProductionToCanvas: (card: DisplayCard, face?: CardFace) => Promise<HTMLCanvasElement>;
  cleanup: () => void;
}

export interface CardProductionCanvasPlacement {
  trimWidthPx: number;
  trimHeightPx: number;
  bleedXPx: number;
  bleedYPx: number;
  trimOffsetXPx: number;
  trimOffsetYPx: number;
  productionWidthPx: number;
  productionHeightPx: number;
}

export const getCardProductionCanvasPlacement = (
  card: DisplayCard,
  face: CardFace,
  trimWidthPx: number,
  trimHeightPx: number,
): CardProductionCanvasPlacement => {
  const template = getCardFaceTemplate(card, face);
  const geometry = getTemplateProductionGeometryMm(template);
  const bleedXPx = Math.max(0, Math.round(
    trimWidthPx * geometry.bleedMm / Math.max(geometry.trimWidthMm, Number.EPSILON),
  ));
  const bleedYPx = Math.max(0, Math.round(
    trimHeightPx * geometry.bleedMm / Math.max(geometry.trimHeightMm, Number.EPSILON),
  ));
  return {
    trimWidthPx,
    trimHeightPx,
    bleedXPx,
    bleedYPx,
    trimOffsetXPx: bleedXPx,
    trimOffsetYPx: bleedYPx,
    productionWidthPx: trimWidthPx + bleedXPx * 2,
    productionHeightPx: trimHeightPx + bleedYPx * 2,
  };
};

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

const drawEdgeExtendedBleed = (
  context: CanvasRenderingContext2D,
  backgroundCanvas: HTMLCanvasElement,
  placement: CardProductionCanvasPlacement,
) => {
  const { trimWidthPx: width, trimHeightPx: height, bleedXPx, bleedYPx } = placement;
  if (bleedXPx > 0) {
    context.drawImage(backgroundCanvas, 0, 0, 1, height, 0, bleedYPx, bleedXPx, height);
    context.drawImage(backgroundCanvas, width - 1, 0, 1, height, bleedXPx + width, bleedYPx, bleedXPx, height);
  }

  if (bleedYPx > 0) {
    context.drawImage(backgroundCanvas, 0, 0, width, 1, bleedXPx, 0, width, bleedYPx);
    context.drawImage(backgroundCanvas, 0, height - 1, width, 1, bleedXPx, bleedYPx + height, width, bleedYPx);
  }

  if (bleedXPx > 0 && bleedYPx > 0) {
    context.drawImage(backgroundCanvas, 0, 0, 1, 1, 0, 0, bleedXPx, bleedYPx);
    context.drawImage(backgroundCanvas, width - 1, 0, 1, 1, bleedXPx + width, 0, bleedXPx, bleedYPx);
    context.drawImage(backgroundCanvas, 0, height - 1, 1, 1, 0, bleedYPx + height, bleedXPx, bleedYPx);
    context.drawImage(backgroundCanvas, width - 1, height - 1, 1, 1, bleedXPx + width, bleedYPx + height, bleedXPx, bleedYPx);
  }
};

export const clampProductionBackgroundRasterRounding = (
  card: DisplayCard,
  face: CardFace,
  backgroundCanvas: HTMLCanvasElement,
  widthPx: number,
  heightPx: number,
): void => {
  const template = getCardFaceTemplate(card, face);
  const { visualHeightPx } = getCardPreviewLayout({
    targetWidthPx: widthPx, aspectRatio: template.aspectRatio,
    canvas: getCardFaceCanvas(card, face), isPrintMode: true,
  });
  const physical = getCardPhysicalSizeMm({ ...card, template });
  // Physical width/height round independently, while the authored canvas scales
  // uniformly from width. Extend only that subpixel raster padding, not a
  // mismatched canvas or genuinely transparent source background.
  const padding = heightPx - visualHeightPx;
  const roundingLimit = .5 * (1 + physical.heightMm / physical.widthMm) + Number.EPSILON;
  if (padding <= 0 || padding > roundingLimit) return;
  const context = backgroundCanvas.getContext('2d');
  if (!context) throw new Error('Canvas rendering is unavailable for the print background.');
  const lastFullRow = Math.max(0, Math.floor(visualHeightPx * backgroundCanvas.height / heightPx) - 1);
  const edge = context.getImageData(0, lastFullRow, backgroundCanvas.width, 1);
  // Copy alpha too. Source-over painting could make a genuinely translucent
  // source edge appear opaque and evade the subsequent sufficiency check.
  for (let y = lastFullRow + 1; y < backgroundCanvas.height; y++) context.putImageData(edge, 0, y);
};

export const extendCardTrimCanvasToProductionBleed = (
  card: DisplayCard,
  face: CardFace,
  trimCanvas: HTMLCanvasElement,
  backgroundCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
): HTMLCanvasElement => {
  const placement = getCardProductionCanvasPlacement(card, face, trimCanvas.width, trimCanvas.height);
  if ([backgroundCanvas, maskCanvas].some((canvas) => canvas.width !== trimCanvas.width || canvas.height !== trimCanvas.height)) {
    throw new Error('The production background dimensions do not match the authored trim render.');
  }
  if (placement.bleedXPx > 0 || placement.bleedYPx > 0) {
    const backgroundContext = backgroundCanvas.getContext('2d');
    if (!backgroundContext) throw new Error('Canvas rendering is unavailable for the print background.');
    const { width, height } = backgroundCanvas;
    const edges = [[0, 0, width, 1], [0, height - 1, width, 1], [0, 0, 1, height], [width - 1, 0, 1, height]];
    for (const [x, y, w, h] of edges) {
      const pixels = backgroundContext.getImageData(x, y, w, h).data;
      for (let alpha = 3; alpha < pixels.length; alpha += 4) {
        if (pixels[alpha] !== 255) throw new Error('Print bleed needs an opaque authored background at every edge. Add a solid background or complete background artwork; no missing artwork was invented.');
      }
    }
  }

  const productionCanvas = document.createElement('canvas');
  productionCanvas.width = placement.productionWidthPx;
  productionCanvas.height = placement.productionHeightPx;
  const context = productionCanvas.getContext('2d');
  if (!context) throw new Error('Canvas rendering is unavailable for print bleed preparation.');

  drawEdgeExtendedBleed(context, backgroundCanvas, placement);
  const trimContext = trimCanvas.getContext('2d'), backgroundContext = backgroundCanvas.getContext('2d'), maskContext = maskCanvas.getContext('2d');
  if (!trimContext || !backgroundContext || !maskContext) throw new Error('Canvas rendering is unavailable for print corner preparation.');
  const trim = trimContext.getImageData(0, 0, trimCanvas.width, trimCanvas.height);
  const background = backgroundContext.getImageData(0, 0, trimCanvas.width, trimCanvas.height).data;
  const mask = maskContext.getImageData(0, 0, trimCanvas.width, trimCanvas.height).data;
  for (let i = 0; i < trim.data.length; i += 4) {
    const alpha = trim.data[i + 3];
    if (alpha === 255 || mask[i + 3] === 255) continue;
    // Add only the complementary outer-mask coverage, not a second copy of
    // intrinsically translucent interior content. Cap at uncovered alpha so
    // already-painted borders/shadows outside the mask remain intact too.
    const addedAlpha = Math.min(background[i + 3] * (255 - mask[i + 3]) / 255, 255 - alpha);
    if (!addedAlpha) continue;
    const totalAlpha = alpha + addedAlpha;
    for (let channel = 0; channel < 3; channel++) {
      trim.data[i + channel] = Math.round((trim.data[i + channel] * alpha + background[i + channel] * addedAlpha) / totalAlpha);
    }
    trim.data[i + 3] = Math.round(totalAlpha);
  }
  context.putImageData(trim, placement.trimOffsetXPx, placement.trimOffsetYPx);
  return productionCanvas;
};

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
  const sourceDetails = new Map<string, SourceImageDetail>();
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

  const renderPreview = async (card: DisplayCard, face: CardFace = 'front', productionLayer?: 'background' | 'mask') => {
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
      productionLayer,
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
    const backgrounds = await readBackgroundImages(element);
    if (exportProfile.mode === 'physical') {
      const geometry = getTemplateProductionGeometryMm(getCardFaceTemplate(card, face));
      const rootStyle = getComputedStyle(element);
      const rootWidth = parseFloat(rootStyle.width);
      const rootHeight = parseFloat(rootStyle.height);
      Array.from(element.querySelectorAll('img')).forEach((image, index) => {
        // SVG has no finite raster resolution. Blob-backed formats remain
        // conservatively measured unless their source declares vector content.
        if (image.dataset.sourceMimeType === 'image/svg+xml' || /^data:image\/svg\+xml|\.svg(?:[?#]|$)/i.test(image.currentSrc || image.src)) return;
        const style = getComputedStyle(image);
        let matrix = new DOMMatrix();
        for (let node: HTMLElement | null = image; node && node !== element; node = node.parentElement) {
          const transform = getComputedStyle(node).transform;
          if (transform !== 'none') matrix = new DOMMatrix(transform).multiply(matrix);
        }
        const box = transformedImageDimensions(parseFloat(style.width), parseFloat(style.height), matrix);
        const scope = `card:${card.uniqueId}:${face}:image:${index + 1}`;
        const detail = measureSourceImageDetail({ scope, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
          boxWidthMm: box.width / rootWidth * geometry.trimWidthMm,
          boxHeightMm: box.height / rootHeight * geometry.trimHeightMm,
          objectFit: style.objectFit });
        if (detail) sourceDetails.set(scope, detail);
      });
      backgrounds.forEach(({ node, style, url, index, image, vector }, backgroundIndex) => {
        if (vector || /^data:image\/svg\+xml|\.svg(?:[?#]|$)/i.test(url)) return;
        const sizes = splitCssLayers(style.backgroundSize);
        const origins = splitCssLayers(style.backgroundOrigin);
        const origin = origins[index % origins.length];
        let width = parseFloat(style.width), height = parseFloat(style.height);
        const borderX = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
        const borderY = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
        const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        if (style.boxSizing !== 'border-box') { width += paddingX + borderX; height += paddingY + borderY; }
        if (origin !== 'border-box') { width -= borderX; height -= borderY; }
        if (origin === 'content-box') { width -= paddingX; height -= paddingY; }
        const placed = backgroundImageDimensions(image.naturalWidth, image.naturalHeight, width, height, sizes[index % sizes.length]);
        let matrix = new DOMMatrix();
        for (let current: HTMLElement | null = node; current && current !== element; current = current.parentElement) {
          const transform = getComputedStyle(current).transform;
          if (transform !== 'none') matrix = new DOMMatrix(transform).multiply(matrix);
        }
        const box = transformedImageDimensions(placed.width, placed.height, matrix);
        const scope = `card:${card.uniqueId}:${face}:background:${backgroundIndex + 1}`;
        const detail = measureSourceImageDetail({ scope, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
          boxWidthMm: box.width / rootWidth * geometry.trimWidthMm, boxHeightMm: box.height / rootHeight * geometry.trimHeightMm, objectFit: 'fill' });
        if (!detail) throw new Error('A card background image has an unsupported physical size. Use pixels, percentages, cover or contain before exporting.');
        sourceDetails.set(scope, detail);
      });
    }
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

  const renderProductionToCanvas = async (card: DisplayCard, face: CardFace = 'front') => {
    const trimCanvas = await renderToCanvas(card, face);
    const { element, widthPx, heightPx } = await renderPreview(card, face, 'background');
    const backgroundCanvas = await toCanvas(element, {
      pixelRatio: exportProfile.canvasPixelRatio, width: widthPx, height: heightPx,
      skipFonts: false, fetchRequestInit: { mode: 'cors' },
    });
    clampProductionBackgroundRasterRounding(card, face, backgroundCanvas, widthPx, heightPx);
    const { element: maskElement } = await renderPreview(card, face, 'mask');
    const maskCanvas = await toCanvas(maskElement, {
      pixelRatio: exportProfile.canvasPixelRatio, width: widthPx, height: heightPx,
      skipFonts: false, fetchRequestInit: { mode: 'cors' },
    });
    return extendCardTrimCanvasToProductionBleed(card, face, trimCanvas, backgroundCanvas, maskCanvas);
  };

  return {
    getSourceImageDetails: () => [...sourceDetails.values()],
    renderToBlob: async (card, face = 'front') => canvasToPngBlob(await renderToCanvas(card, face)),
    renderToCanvas,
    renderProductionToBlob: async (card, face = 'front') => canvasToPngBlob(await renderProductionToCanvas(card, face)),
    renderProductionToCanvas,
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

export async function renderCardProductionPngBlob(
  card: DisplayCard,
  exportDpi: number,
  face: CardFace = 'front',
  highlightColor = DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR,
  watermark?: CardExportWatermark,
): Promise<Blob> {
  const renderer = createCardFaceExportRenderer(
    getExportProfile('physical', exportDpi),
    highlightColor,
    watermark,
  );
  try {
    return await renderer.renderProductionToBlob(card, face);
  } finally {
    renderer.cleanup();
  }
}
