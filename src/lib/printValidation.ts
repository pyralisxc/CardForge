import type { DisplayCard } from '@/types';
import { extractTemplateFieldDefinitions } from '@/lib/templateFields';
import { AVAILABLE_FONTS } from '@/lib/constants';
import { validateCardDataAgainstFieldContracts } from '@/lib/fieldContracts';

export type ExportMode = 'physical' | 'virtual';

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

export const validateCardExportQuality = (card: DisplayCard, mode: ExportMode, dpiOverride?: number): ExportValidationResult => {
  const critical: string[] = [];
  const warnings: string[] = [];
  const fieldDefinitions = extractTemplateFieldDefinitions(card.template);
  const exportProfile = getExportProfile(mode, dpiOverride);

  if (mode === 'physical' && exportProfile.dpi < 300) {
    warnings.push('Physical print exports should use at least 300 DPI for standard print workflows.');
  }

  if (mode === 'virtual' && exportProfile.dpi < 96) {
    warnings.push('Virtual exports below 96 DPI may look soft on common displays.');
  }

  if (mode === 'physical') {
    warnings.push('Physical ZIP exports produce individual front/back card-face PNGs. Use Save as PDF when you need the selected paper size, cut lines, and sheet layout.');
    warnings.push('Browser exports are RGB. If your print vendor requires CMYK, spot colors, bleed boxes, or PDF/X, convert the exported PNG/PDF in a prepress tool before final production.');

    [
      { label: 'front', canvas: card.template.freeformCanvas },
      { label: 'back', canvas: card.template.backCanvas },
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
      ...(card.template.backCanvas?.elements || []),
    ]
      .map((element) => element.fontFamily)
      .filter((fontFamily): fontFamily is string => !!fontFamily && fontFamily.trim().length > 0)
      .filter((fontFamily) => !KNOWN_FONT_VALUES.has(fontFamily))
  );

  if (customFontClasses.size > 0) {
    warnings.push(
      `Custom font classes detected (${Array.from(customFontClasses).join(', ')}). Ensure fonts are available before exporting.`
    );
  }

  return { critical, warnings };
};
