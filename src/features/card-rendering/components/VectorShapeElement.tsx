"use client";
import { AppearanceSurface } from './AppearanceSurface';
import { textureLayerStyle } from '../model/appearance';

import { useId } from 'react';
import type { CSSProperties, SVGProps } from 'react';

import { canRenderVectorShape, getVectorShapeDefinition } from '@/domain/rendering';
import type { FreeformCardElement } from '@/domain/templates';
import { useProjectBinaryAssetValue } from '@/features/project/client/useProjectBinaryAssetUrl';
import { borderWidthClassToPixels } from '../model/elementStyles';

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
  const backgroundImage = useProjectBinaryAssetValue(
    typeof style?.backgroundImage === 'string' ? style.backgroundImage : undefined,
  );

  if (!canRenderVectorShape(element) || !definition) return null;

  const strokeWidth = element.appearance?.border?.kind === 'none' || style?.borderStyle === 'none'
    ? 0 : getShapeStrokeWidth(element, style, strokeScale);
  const doubleStroke = element.appearance?.border?.kind === 'double' || style?.borderStyle === 'double';
  const strokeMaskId = `${clipId}-double`;
  const authoredRadius = element.appearance?.border?.radius;
  const radius = authoredRadius === undefined ? undefined : Math.max(0, Math.min(authoredRadius, element.width * 0.48, element.height * 0.48));
  const strokeColor = element.strokeColor
    || element.borderColor
    || (typeof style?.borderColor === 'string' ? style.borderColor : undefined)
    || 'transparent';
  const fillColor = element.fillColor
    || element.backgroundColor
    || (typeof style?.backgroundColor === 'string' ? style.backgroundColor : undefined)
    || 'transparent';
  const glow = element.appearance?.effects?.glow ?? 0;
  const glowColor = element.appearance?.border?.secondaryColor || element.appearance?.border?.color || strokeColor;
  const surfaceStyle: CSSProperties = {
    ...textureLayerStyle(style),
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
  const geometry = (props: Omit<SVGProps<SVGElement>, 'ref'> = {}) => definition.kind === 'rect'
    ? <rect x="2" y="2" width="96" height="96"
        rx={radius === undefined ? definition.rx ?? 4 : radius * 100 / element.width}
        ry={radius === undefined ? definition.rx ?? 4 : radius * 100 / element.height} {...props} />
    : definition.kind === 'ellipse'
      ? <ellipse cx="50" cy="50" rx="48" ry="48" {...props} />
      : definition.kind === 'polygon'
        ? <polygon points={definition.points} {...props} />
        : <path d={definition.d} fillRule={definition.fillRule} {...props} />;
  const strokeProps = { fill: 'none', stroke: strokeColor, strokeWidth,
    strokeLinejoin: 'round' as const, vectorEffect: 'non-scaling-stroke' as const };

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false" style={svgStyle}>
      {backgroundImage && (
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            {geometry()}
          </clipPath>
        </defs>
      )}
      {backgroundImage && (
        <g clipPath={`url(#${clipId})`}>
          {/* Fit backgrounds in authored coordinates before projecting into the normalized shape. */}
          <foreignObject x="0" y="0" width={element.width} height={element.height} transform={`scale(${100 / element.width} ${100 / element.height})`}>
            <AppearanceSurface style={surfaceStyle} />
          </foreignObject>
        </g>
      )}
      {geometry({ fill: backgroundImage ? 'transparent' : fillColor })}
      {doubleStroke && strokeWidth > 0 && <defs>
        <mask id={strokeMaskId} maskUnits="userSpaceOnUse" x="-100" y="-100" width="300" height="300" style={{ maskType: 'luminance' }}>
          <rect x="-100" y="-100" width="300" height="300" fill="white" />
          {geometry({ ...strokeProps, stroke: 'black', strokeWidth: strokeWidth / 3 })}
        </mask>
      </defs>}
      {strokeWidth > 0 && geometry({ ...strokeProps, mask: doubleStroke ? `url(#${strokeMaskId})` : undefined })}
    </svg>
  );
}
