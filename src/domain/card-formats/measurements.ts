import { resolveTemplateCardFormat } from './registry';
import type {
  CardFormat,
  CardFormatMeasurement,
  CardMeasurementUnit,
  TemplateCardFormatSource,
} from './types';

const round = (value: number, precision: number): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const millimetersToUnit = (valueMm: number, unit: Exclude<CardMeasurementUnit, 'px'>): number => {
  if (unit === 'in') return round(valueMm / 25.4, 2);
  if (unit === 'cm') return round(valueMm / 10, 2);
  return valueMm;
};

export const getCardFormatMeasurement = (
  format: CardFormat,
  unit: CardMeasurementUnit,
): CardFormatMeasurement => {
  if (unit === 'px') {
    return {
      width: format.canvasWidthPx,
      height: format.canvasHeightPx,
      suffix: 'px',
      label: `${format.canvasWidthPx} × ${format.canvasHeightPx} px`,
    };
  }

  const width = millimetersToUnit(format.widthMm, unit);
  const height = millimetersToUnit(format.heightMm, unit);
  return {
    width,
    height,
    suffix: unit,
    label: `${width} × ${height} ${unit}`,
  };
};

export const getTemplateCardMeasurement = (
  template: TemplateCardFormatSource,
  unit: CardMeasurementUnit,
): CardFormatMeasurement => {
  const resolved = resolveTemplateCardFormat(template);
  if (unit === 'px') {
    return {
      width: resolved.canvasWidthPx,
      height: resolved.canvasHeightPx,
      suffix: 'px',
      label: `${resolved.canvasWidthPx} × ${resolved.canvasHeightPx} px`,
    };
  }
  const width = millimetersToUnit(resolved.widthMm, unit);
  const height = millimetersToUnit(resolved.heightMm, unit);
  return { width, height, suffix: unit, label: `${width} × ${height} ${unit}` };
};
