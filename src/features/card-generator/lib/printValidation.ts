import { extractTemplateFieldDefinitions } from '@/domain/templates';
import { validateCardDataAgainstFieldContracts } from '@/domain/templates';
import {
  AVAILABLE_FONTS,
  getCardExportDimensionsPx,
  getCardFaceCanvas,
  hasCardBacking,
} from '@/domain/rendering';
import type { DisplayCard, ExportMode } from '@/domain/rendering';

export type { ExportMode } from '@/domain/rendering';

export interface ExportProfile {
  mode: ExportMode;
  label: string;
  dpi: number;
  renderWidthPx: number;
  canvasPixelRatio: number;
  colorSpace: 'rgb';
  recommendedFormat: 'png';
}

export interface ExportValidationResult {
  critical: string[];
  warnings: string[];
}

export interface RasterExportDimensionsPx {
  widthPx: number;
  heightPx: number;
  effectivePixelsPerInch: number;
}

export interface RasterExportQualityOption {
  value: number;
  label: string;
  description: string;
}

const EXPORT_PROFILES: Record<ExportMode, ExportProfile> = {
  physical: {
    mode: 'physical',
    label: 'Physical Print',
    dpi: 300,
    renderWidthPx: 744,
    canvasPixelRatio: 3,
    colorSpace: 'rgb',
    recommendedFormat: 'png',
  },
  virtual: {
    mode: 'virtual',
    label: 'Virtual Export',
    dpi: 150,
    renderWidthPx: 420,
    canvasPixelRatio: 2,
    colorSpace: 'rgb',
    recommendedFormat: 'png',
  },
};

export const RASTER_EXPORT_QUALITY_OPTIONS: RasterExportQualityOption[] = [
  {
    value: 150,
    label: 'Standard',
    description: 'Smaller files for ordinary card-size printing and digital use.',
  },
  {
    value: 300,
    label: 'High detail',
    description: 'Larger lossless images for close inspection and downstream editing.',
  },
  {
    value: 600,
    label: 'Maximum',
    description: 'Very large raster files for workflows that can handle the extra memory and storage.',
  },
];

const clampDpi = (dpi: number): number => {
  if (!Number.isFinite(dpi)) return 300;
  return Math.min(1200, Math.max(72, Math.round(dpi)));
};

const computeRenderWidthPx = (dpi: number): number => {
  const inches = 63 / 25.4;
  return Math.max(280, Math.round(inches * dpi));
};

const computeCanvasPixelRatio = (dpi: number): number => {
  if (dpi >= 300) return 3;
  if (dpi >= 150) return 2;
  return 1;
};

const KNOWN_FONT_VALUES = new Set(AVAILABLE_FONTS.map((font) => font.value));
const PHYSICAL_SAFE_AREA_RATIO = 0.04;

const isKnownFontValue = (fontFamily: string): boolean =>
  KNOWN_FONT_VALUES.has(fontFamily) || fontFamily.startsWith('font-dev-');

const isLikelyImageSource = (value: string): boolean => {
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  );
};

const isPlaceholderImage = (value: string): boolean => {
  const lower = value.toLowerCase();
  return lower.includes('placehold.co') || lower.includes('placeholder');
};

export const getExportProfile = (mode: ExportMode, dpiOverride?: number): ExportProfile => {
  const base = EXPORT_PROFILES[mode] || EXPORT_PROFILES.physical;
  const dpi = clampDpi(dpiOverride ?? base.dpi);
  return {
    ...base,
    dpi,
    renderWidthPx: computeRenderWidthPx(dpi),
    canvasPixelRatio: computeCanvasPixelRatio(dpi),
  };
};

export const getRasterExportQualityOption = (value: number): RasterExportQualityOption =>
  RASTER_EXPORT_QUALITY_OPTIONS.find((option) => option.value === value)
  ?? {
    value,
    label: 'Custom',
    description: 'Custom raster render setting.',
  };

export const getRasterExportDimensionsPx = (
  card: DisplayCard,
  mode: ExportMode,
  dpiOverride?: number
): RasterExportDimensionsPx => {
  const profile = getExportProfile(mode, dpiOverride);
  const baseDimensions = getCardExportDimensionsPx(card, profile.dpi);
  return {
    widthPx: baseDimensions.widthPx * profile.canvasPixelRatio,
    heightPx: baseDimensions.heightPx * profile.canvasPixelRatio,
    effectivePixelsPerInch: profile.dpi * profile.canvasPixelRatio,
  };
};

export const validateCardExportQuality = (card: DisplayCard, mode: ExportMode, dpiOverride?: number): ExportValidationResult => {
  const critical: string[] = [];
  const warnings: string[] = [];
  const fieldDefinitions = extractTemplateFieldDefinitions(card.template);
  const exportProfile = getExportProfile(mode, dpiOverride);
  const effectivePixelsPerInch = exportProfile.dpi * exportProfile.canvasPixelRatio;

  if (mode === 'physical' && effectivePixelsPerInch < 300) {
    warnings.push('Physical print exports should contain at least 300 pixels per inch at the intended card size.');
  }

  if (mode === 'virtual' && effectivePixelsPerInch < 96) {
    warnings.push('Virtual exports below 96 pixels per inch at the intended card size may look soft on common displays.');
  }

  if (mode === 'physical') {
    [
      { label: 'front', canvas: getCardFaceCanvas(card, 'front') },
      { label: 'back', canvas: hasCardBacking(card) ? getCardFaceCanvas(card, 'back') : undefined },
    ].forEach(({ label, canvas }) => {
      if (!canvas) return;
      const safeX = canvas.width * PHYSICAL_SAFE_AREA_RATIO;
      const safeY = canvas.height * PHYSICAL_SAFE_AREA_RATIO;
      (canvas.elements || [])
        .filter((element) => element.type === 'text' || element.type === 'icon')
        .forEach((element) => {
          const tooClose =
            element.x < safeX ||
            element.y < safeY ||
            element.x + element.width > canvas.width - safeX ||
            element.y + element.height > canvas.height - safeY;

          if (tooClose) {
            warnings.push(
              `${label === 'back' ? 'Back' : 'Front'} ${element.type} element "${element.name || element.id}" is inside the print safe area. Keep important text and icons at least 4% away from trim edges, or confirm the placement intentionally bleeds.`
            );
          }
        });
    });
  }

  const contractValidation = validateCardDataAgainstFieldContracts(fieldDefinitions, card.data);
  warnings.push(...contractValidation.issues);
  warnings.push(...contractValidation.warnings);

  fieldDefinitions.forEach((field) => {
    const value = String(card.data[field.key] ?? '').trim();

    if (!field.isImage) return;

    if (value.length === 0) {
      return;
    }

    if (!isLikelyImageSource(value)) {
      return;
    }

    if (isPlaceholderImage(value)) {
      if (mode === 'physical') {
        critical.push(`Image field ${field.key} is using a placeholder source.`);
      } else {
        warnings.push(`Image field ${field.key} is using a placeholder source.`);
      }
    }
  });

  const customFontClasses = new Set(
    [
      ...(card.template.freeformCanvas?.elements || []),
      ...(card.backingTemplate?.freeformCanvas?.elements || []),
    ]
      .map((element) => element.fontFamily)
      .filter((fontFamily): fontFamily is string => !!fontFamily && fontFamily.trim().length > 0)
      .filter((fontFamily) => !isKnownFontValue(fontFamily))
  );

  if (customFontClasses.size > 0) {
    warnings.push(
      `Custom font classes detected (${Array.from(customFontClasses).join(', ')}). Ensure fonts are available before exporting.`
    );
  }

  return { critical, warnings };
};
