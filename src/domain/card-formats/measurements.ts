import type { CardFormat, CardFormatMeasurement, CardMeasurementUnit } from './types';

const round = (value: number, precision: number): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
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

  const width = unit === 'in' ? round(format.widthMm / 25.4, 2) : format.widthMm;
  const height = unit === 'in' ? round(format.heightMm / 25.4, 2) : format.heightMm;
  return {
    width,
    height,
    suffix: unit,
    label: `${width} × ${height} ${unit}`,
  };
};
