import {
  getCardFaceTemplate,
  getTemplateProductionGeometryMm,
  hasCardBacking,
} from '@/domain/rendering';
import type { DisplayCard } from '@/domain/rendering';
import type { SourceImageDetail } from './sourceImageDetail';

import {
  getExportProfile,
  validateCardExportQuality,
} from './printValidation';

export type PrintProductionPreflightSeverity = 'blocker' | 'warning' | 'standards-gap';

export interface PrintProductionPreflightIssue {
  code: string;
  severity: PrintProductionPreflightSeverity;
  scope: string;
  message: string;
}

export interface PrintProductionPreflightGeometry {
  trimWidthMm: number;
  trimHeightMm: number;
  bleedMm: number;
  safeMarginMm: number;
  productionWidthMm: number;
  productionHeightMm: number;
}

export interface PrintProductionPreflightReport {
  format: 'cardforge-print-preflight-v1';
  cardCount: number;
  faceCount: number;
  requestedDpi: number;
  effectivePixelsPerInch: number;
  sourceImageDetail: { measured: boolean; coverage: 'rendered-image-elements-and-backgrounds'; images: SourceImageDetail[] };
  productionPrepared: boolean;
  pressReady: boolean;
  colorManagement: {
    sourceColorSpace: 'rgb';
    outputIntent: { condition: string; sha256: string } | null;
    pressStandard: 'PDF/X-4' | null;
  };
  issueSummary: {
    blockers: number;
    warnings: number;
    standardsGaps: number;
  };
  geometries: PrintProductionPreflightGeometry[];
  issues: PrintProductionPreflightIssue[];
}

const nearlyEqual = (left: number, right: number): boolean => (
  Math.abs(left - right) <= 0.001
);

const validGeometry = (geometry: PrintProductionPreflightGeometry): boolean => (
  [
    geometry.trimWidthMm,
    geometry.trimHeightMm,
    geometry.productionWidthMm,
    geometry.productionHeightMm,
  ].every((value) => Number.isFinite(value) && value > 0)
  && [geometry.bleedMm, geometry.safeMarginMm]
    .every((value) => Number.isFinite(value) && value >= 0)
  && geometry.productionWidthMm >= geometry.trimWidthMm
  && geometry.productionHeightMm >= geometry.trimHeightMm
);

const sameDuplexGeometry = (
  front: PrintProductionPreflightGeometry,
  back: PrintProductionPreflightGeometry,
): boolean => (
  nearlyEqual(front.trimWidthMm, back.trimWidthMm)
  && nearlyEqual(front.trimHeightMm, back.trimHeightMm)
  && nearlyEqual(front.bleedMm, back.bleedMm)
);

const geometryKey = (geometry: PrintProductionPreflightGeometry): string => (
  [
    geometry.trimWidthMm,
    geometry.trimHeightMm,
    geometry.bleedMm,
    geometry.safeMarginMm,
    geometry.productionWidthMm,
    geometry.productionHeightMm,
  ].join(':')
);

const normalizeGeometry = (
  geometry: ReturnType<typeof getTemplateProductionGeometryMm>,
): PrintProductionPreflightGeometry => ({
  trimWidthMm: geometry.trimWidthMm,
  trimHeightMm: geometry.trimHeightMm,
  bleedMm: geometry.bleedMm,
  safeMarginMm: geometry.safeMarginMm,
  productionWidthMm: geometry.productionWidthMm,
  productionHeightMm: geometry.productionHeightMm,
});

const deduplicateIssues = (
  issues: PrintProductionPreflightIssue[],
): PrintProductionPreflightIssue[] => {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = [issue.code, issue.severity, issue.scope, issue.message].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const createPrintProductionPreflight = (
  cards: DisplayCard[],
  requestedDpi: number,
  sourceImageDetails?: SourceImageDetail[],
  pdfxOutputIntent?: { condition: string; sha256: string },
): PrintProductionPreflightReport => {
  const profile = getExportProfile('physical', requestedDpi);
  const effectivePixelsPerInch = profile.dpi * profile.canvasPixelRatio;
  const issues: PrintProductionPreflightIssue[] = [];
  const geometries = new Map<string, PrintProductionPreflightGeometry>();
  let faceCount = 0;

  if (cards.length === 0) {
    issues.push({
      code: 'set.empty',
      severity: 'blocker',
      scope: 'set',
      message: 'Add at least one card before creating a print production package.',
    });
  }

  if (effectivePixelsPerInch < 300) {
    issues.push({
      code: 'resolution.below_300_ppi',
      severity: 'blocker',
      scope: 'set',
      message: `Print production requires at least 300 effective pixels per inch; this export resolves to ${effectivePixelsPerInch} PPI.`,
    });
  }

  cards.forEach((card, cardIndex) => {
    const scope = `card:${cardIndex + 1}:${card.uniqueId}`;
    const frontGeometry = normalizeGeometry(
      getTemplateProductionGeometryMm(getCardFaceTemplate(card, 'front')),
    );
    geometries.set(geometryKey(frontGeometry), frontGeometry);
    faceCount += 1;

    if (!validGeometry(frontGeometry)) {
      issues.push({
        code: 'geometry.invalid',
        severity: 'blocker',
        scope: `${scope}:front`,
        message: 'Front production geometry is invalid and cannot be prepared deterministically.',
      });
    }

    if (hasCardBacking(card)) {
      const backGeometry = normalizeGeometry(
        getTemplateProductionGeometryMm(getCardFaceTemplate(card, 'back')),
      );
      geometries.set(geometryKey(backGeometry), backGeometry);
      faceCount += 1;

      if (!validGeometry(backGeometry)) {
        issues.push({
          code: 'geometry.invalid',
          severity: 'blocker',
          scope: `${scope}:back`,
          message: 'Back production geometry is invalid and cannot be prepared deterministically.',
        });
      } else if (!sameDuplexGeometry(frontGeometry, backGeometry)) {
        issues.push({
          code: 'geometry.duplex_mismatch',
          severity: 'blocker',
          scope,
          message: 'Front and back trim size or bleed do not match. A duplex production pair must use the same physical geometry.',
        });
      }
    }

    const quality = validateCardExportQuality(card, 'physical', requestedDpi);
    quality.critical.forEach((message) => {
      issues.push({
        code: 'content.export_blocker',
        severity: 'blocker',
        scope,
        message,
      });
    });
    quality.warnings.forEach((message) => {
      if (message.includes('at least 300 pixels per inch')) return;
      issues.push({
        code: 'content.review_warning',
        severity: 'warning',
        scope,
        message,
      });
    });
  });

  if (sourceImageDetails === undefined) issues.push({
    code: 'resolution.source_detail_unmeasured', severity: 'warning', scope: 'package',
    message: 'Source-image detail is measured during rendering. Export canvas density alone does not prove artwork detail.',
  });
  sourceImageDetails?.filter((detail) => detail.effectivePpi < 300).forEach((detail) => issues.push({
    code: 'resolution.source_below_300_ppi', severity: 'warning', scope: detail.scope,
    message: `Artwork has ${Math.floor(detail.effectivePpi)} effective source PPI at its placed size. A denser export cannot restore missing source detail.`,
  }));
  if ([...geometries.values()].some((geometry) => geometry.bleedMm > 0)) issues.push({
    code: 'bleed.edge_extension_review', severity: 'warning', scope: 'package',
    message: 'Bleed extends the rendered trim edges; inspect the full-bleed artwork before professional production. Edge extension does not prove authored artwork continuation.',
  });

  issues.push({
    code: pdfxOutputIntent ? 'standards.independent_validation_missing' : 'standards.output_intent_missing',
    severity: 'standards-gap',
    scope: 'package',
    message: pdfxOutputIntent
      ? 'PDF/X-4 candidate files have passed generator structural checks. Independent PDF/X preflight and destination acceptance are still required.'
      : 'CardForge production PNG and sheet PDF output is RGB raster without a printing-condition ICC output intent or PDF/X press standard.',
  });

  const uniqueIssues = deduplicateIssues(issues);
  const blockers = uniqueIssues.filter((issue) => issue.severity === 'blocker').length;
  const warnings = uniqueIssues.filter((issue) => issue.severity === 'warning').length;
  const standardsGaps = uniqueIssues.filter((issue) => issue.severity === 'standards-gap').length;
  const productionPrepared = blockers === 0;
  const pressReady = productionPrepared && standardsGaps === 0;

  return {
    format: 'cardforge-print-preflight-v1',
    cardCount: cards.length,
    faceCount,
    requestedDpi: profile.dpi,
    effectivePixelsPerInch,
    sourceImageDetail: { measured: sourceImageDetails !== undefined, coverage: 'rendered-image-elements-and-backgrounds', images: sourceImageDetails ?? [] },
    productionPrepared,
    pressReady,
    colorManagement: {
      sourceColorSpace: 'rgb',
      outputIntent: pdfxOutputIntent ?? null,
      pressStandard: pdfxOutputIntent ? 'PDF/X-4' : null,
    },
    issueSummary: {
      blockers,
      warnings,
      standardsGaps,
    },
    geometries: [...geometries.values()].sort((left, right) => (
      left.trimWidthMm - right.trimWidthMm
      || left.trimHeightMm - right.trimHeightMm
      || left.bleedMm - right.bleedMm
      || left.safeMarginMm - right.safeMarginMm
    )),
    issues: uniqueIssues,
  };
};
