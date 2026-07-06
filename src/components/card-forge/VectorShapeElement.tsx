"use client";

import { useId } from 'react';
import type { CSSProperties } from 'react';

import { borderWidthClassToPixels } from '@/lib/freeformElementRender';
import { canRenderVectorShape, getVectorShapeDefinition } from '@/lib/vectorShapes';
import type { FreeformCardElement } from '@/types';

interface VectorShapeElementProps {
  element: FreeformCardElement;
  style?: CSSProperties;
  strokeScale?: number;
}

const toCssLength = (value: CSSProperties['borderWidth']): number | undefined => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getShapeStrokeWidth = (
  element: FreeformCardElement,
  style: CSSProperties | undefined,
  strokeScale: number,
): number => {
  const width = element.strokeWidth
    ?? toCssLength(style?.borderWidth)
    ?? borderWidthClassToPixels(element.borderWidth)
    ?? 0;
  return Math.max(0, Math.round(width * strokeScale * 100) / 100);
};

export function VectorShapeElement({ element, style, strokeScale = 1 }: VectorShapeElementProps) {
  const rawId = useId();
  const clipId = `cardforge-shape-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const definition = getVectorShapeDefinition(element.shapeKind);

  if (!canRenderVectorShape(element) || !definition) return null;

  const strokeWidth = getShapeStrokeWidth(element, style, strokeScale);
  const strokeColor = element.strokeColor
    || element.borderColor
    || (typeof style?.borderColor === 'string' ? style.borderColor : undefined)
    || 'transparent';
  const backgroundImage = typeof style?.backgroundImage === 'string' ? style.backgroundImage : undefined;
  const fillColor = element.fillColor
    || element.backgroundColor
    || (typeof style?.backgroundColor === 'string' ? style.backgroundColor : undefined)
    || 'transparent';
  const glow = element.appearance?.effects?.glow ?? 0;
  const glowColor = element.appearance?.border?.secondaryColor || element.appearance?.border?.color || strokeColor;
  const surfaceStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: typeof style?.backgroundColor === 'string' ? style.backgroundColor : fillColor,
    backgroundImage,
    backgroundSize: style?.backgroundSize || (backgroundImage ? '100% 100%' : undefined),
    backgroundRepeat: style?.backgroundRepeat,
    backgroundPosition: style?.backgroundPosition || 'center',
    backgroundBlendMode: style?.backgroundBlendMode,
  };
  const svgStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    overflow: 'visible',
    filter: glow > 0 ? `drop-shadow(0 0 ${glow}px ${glowColor})` : undefined,
  };
  const commonShapeProps = {
    fill: backgroundImage ? 'transparent' : fillColor,
    stroke: strokeWidth > 0 ? strokeColor : 'transparent',
    strokeWidth,
    strokeLinejoin: 'round' as const,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  const shape = definition.kind === 'rect'
    ? <rect x="2" y="2" width="96" height="96" rx={definition.rx ?? 4} {...commonShapeProps} />
    : definition.kind === 'ellipse'
      ? <ellipse cx="50" cy="50" rx="48" ry="48" {...commonShapeProps} />
      : definition.kind === 'polygon'
        ? <polygon points={definition.points} {...commonShapeProps} />
        : <path d={definition.d} fillRule={definition.fillRule} {...commonShapeProps} />;

  const clipShape = definition.kind === 'rect'
    ? <rect x="2" y="2" width="96" height="96" rx={definition.rx ?? 4} />
    : definition.kind === 'ellipse'
      ? <ellipse cx="50" cy="50" rx="48" ry="48" />
      : definition.kind === 'polygon'
        ? <polygon points={definition.points} />
        : <path d={definition.d} fillRule={definition.fillRule} />;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false" style={svgStyle}>
      {backgroundImage && (
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            {clipShape}
          </clipPath>
        </defs>
      )}
      {backgroundImage && (
        <foreignObject x="0" y="0" width="100" height="100" clipPath={`url(#${clipId})`}>
          <div style={surfaceStyle} />
        </foreignObject>
      )}
      {shape}
    </svg>
  );
}
