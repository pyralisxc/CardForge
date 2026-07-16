"use client";

import type { CSSProperties, PointerEvent } from 'react';
import * as LucideIcons from 'lucide-react';
import { Sparkles } from 'lucide-react';

import { VectorShapeElement } from '@/features/card-rendering/client';
import { appearanceToStyle, normalizeAppearanceForElement } from '@/features/card-rendering/client';
import { CardTextContent } from '@/features/card-rendering/client';
import { isDividerElement } from '@/domain/templates';
import { borderWidthClassToPixels, borderWidthClassToStyle, radiusClassToCss, resolveFreeformImageUrl } from '@/features/card-rendering/client';
import { resolveImageElementOverrides } from '@/domain/rendering';
import { getImageFieldKeyForElement, replacePlaceholdersLocal } from '@/domain/rendering';
import { buildTextElementStyle } from '@/features/card-rendering/client';
import { cn } from '@/shared/classNames';
import { canRenderVectorShape } from '@/domain/rendering';
import type { CardData } from '@/domain/cards';
import type { FreeformCardElement, TCGCardTemplate } from '@/domain/templates';
import type { ResizeHandle } from '@/features/template-editor/hooks/useCanvasPointerInteractions';
import {
  CANVAS_ZOOM,
  RESIZE_HANDLE_MAX_CANVAS_SIZE,
  RESIZE_HANDLE_MIN_CANVAS_SIZE,
  RESIZE_HANDLE_SCREEN_SIZE,
} from '@/features/template-editor/lib/canvasViewportConfig';

const RESIZE_HANDLES: Array<{ handle: ResizeHandle; className: string; cursor: string; label: string }> = [
  { handle: 'n', className: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'ns-resize', label: 'Resize selected element vertically from center' },
  { handle: 's', className: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', cursor: 'ns-resize', label: 'Resize selected element vertically from center' },
  { handle: 'e', className: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2', cursor: 'ew-resize', label: 'Resize selected element horizontally from center' },
  { handle: 'w', className: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize', label: 'Resize selected element horizontally from center' },
  { handle: 'nw', className: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'nwse-resize', label: 'Resize selected element from center' },
  { handle: 'ne', className: 'right-0 top-0 -translate-y-1/2 translate-x-1/2', cursor: 'nesw-resize', label: 'Resize selected element from center' },
  { handle: 'sw', className: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2', cursor: 'nesw-resize', label: 'Resize selected element from center' },
  { handle: 'se', className: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2', cursor: 'nwse-resize', label: 'Resize selected element from center' },
];

interface TemplateEditableElementProps {
  currentTemplate: TCGCardTemplate;
  element: FreeformCardElement;
  livePreviewData: CardData;
  previewMode: boolean;
  richTextHighlightColor: string;
  selected: boolean;
  zoom: number;
  onElementPointerDown: (event: PointerEvent<HTMLDivElement>, element: FreeformCardElement) => void;
  onResizePointerDown: (event: PointerEvent<HTMLButtonElement>, element: FreeformCardElement, handle: ResizeHandle) => void;
}

export function TemplateEditableElement({
  currentTemplate,
  element,
  livePreviewData,
  previewMode,
  richTextHighlightColor,
  selected,
  zoom,
  onElementPointerDown,
  onResizePointerDown,
}: TemplateEditableElementProps) {
  if (element.visible === false) return null;

  const imageResolution = element.type === 'image'
    ? resolveImageElementOverrides(element, livePreviewData, getImageFieldKeyForElement(element))
    : null;
  const renderElement = imageResolution?.element ?? element;
  const borderWidth = borderWidthClassToPixels(renderElement.borderWidth);
  const resolvedBg = renderElement.backgroundImageUrl ? replacePlaceholdersLocal(renderElement.backgroundImageUrl, livePreviewData, false) : '';
  const structuredAppearanceStyle = appearanceToStyle(normalizeAppearanceForElement(renderElement));
  const elementIsDivider = isDividerElement(renderElement);
  const layerTransform = [
    `rotate(${renderElement.rotation || 0}deg)`,
    renderElement.flipX ? 'scaleX(-1)' : null,
    renderElement.flipY ? 'scaleY(-1)' : null,
  ].filter(Boolean).join(' ');
  const baseStyle: CSSProperties = {
    position: 'absolute',
    left: renderElement.x,
    top: renderElement.y,
    width: renderElement.width,
    height: renderElement.height,
    transform: layerTransform,
    transformOrigin: 'center',
    opacity: renderElement.opacity ?? 1,
    zIndex: renderElement.zIndex,
    color: renderElement.textColor || currentTemplate.baseTextColor || undefined,
    backgroundColor: renderElement.backgroundColor || 'transparent',
    backgroundImage: resolvedBg && (resolvedBg.startsWith('linear-gradient') || resolvedBg.startsWith('radial-gradient'))
      ? resolvedBg
      : resolvedBg && (resolvedBg.startsWith('http') || resolvedBg.startsWith('data:'))
        ? `url(${resolvedBg})`
        : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    borderStyle: borderWidth > 0 ? 'solid' : undefined,
    borderColor: renderElement.borderColor || currentTemplate.defaultElementBorderColor || undefined,
    borderRadius: radiusClassToCss(renderElement.borderRadius) || renderElement.borderRadius || undefined,
    ...borderWidthClassToStyle(renderElement.borderWidth),
    boxSizing: 'border-box',
    overflow: 'hidden',
    cursor: previewMode || renderElement.locked ? 'default' : 'move',
    ...structuredAppearanceStyle,
  };

  let body;
  if (renderElement.type === 'image') {
    const imageUrl = resolveFreeformImageUrl(renderElement, livePreviewData, 'Artwork');
    body = (
      <img
        src={imageUrl}
        alt={renderElement.name}
        className="block h-full w-full max-h-full max-w-full"
        style={{
          minWidth: 0,
          minHeight: 0,
          objectFit: imageResolution?.imageStyle.objectFit || renderElement.imageObjectFit || 'cover',
          objectPosition: imageResolution?.imageStyle.objectPosition || `${renderElement.imageObjectPositionX || 'center'} ${renderElement.imageObjectPositionY || 'center'}`,
          transform: imageResolution?.imageStyle.transform,
          transformOrigin: 'center',
          borderRadius: 'inherit',
        }}
        draggable={false}
      />
    );
  } else if (element.type === 'icon') {
    const iconImageUrl = element.iconImageSource ? replacePlaceholdersLocal(element.iconImageSource, livePreviewData, false) : '';
    if (iconImageUrl && (iconImageUrl.startsWith('http') || iconImageUrl.startsWith('data:') || iconImageUrl.startsWith('/'))) {
      body = <img src={iconImageUrl} alt={element.name} className="block h-full w-full max-h-full max-w-full" style={{ minWidth: 0, minHeight: 0, objectFit: 'contain', objectPosition: 'center', borderRadius: 'inherit' }} draggable={false} />;
    } else {
      const IconComponent = (LucideIcons as unknown as Record<string, React.ElementType>)[element.iconName || 'Sparkles'] || Sparkles;
      body = <IconComponent size="78%" color={element.strokeColor || element.textColor || 'currentColor'} fill={element.fillColor || 'none'} strokeWidth={element.strokeWidth || 2} />;
    }
  } else if (element.type === 'shape') {
    if (elementIsDivider) {
      body = null;
      baseStyle.backgroundColor = element.fillColor || element.backgroundColor || 'transparent';
      baseStyle.borderColor = element.strokeColor || element.borderColor || undefined;
      baseStyle.borderWidth = element.strokeWidth !== undefined ? element.strokeWidth : baseStyle.borderWidth;
      baseStyle.borderRadius = element.shapeKind === 'capsule' ? '9999px' : baseStyle.borderRadius;
      baseStyle.height = Math.max(element.height || 0, element.strokeWidth || 2, 2);
      baseStyle.backgroundColor = 'transparent';
      baseStyle.borderWidth = 0;
      Object.assign(baseStyle, structuredAppearanceStyle);
    } else if (canRenderVectorShape(element)) {
      const vectorShapeStyle: CSSProperties = {
        ...structuredAppearanceStyle,
        backgroundColor: structuredAppearanceStyle.backgroundColor || element.fillColor || element.backgroundColor || baseStyle.backgroundColor,
        backgroundImage: structuredAppearanceStyle.backgroundImage || baseStyle.backgroundImage,
        backgroundSize: structuredAppearanceStyle.backgroundSize || baseStyle.backgroundSize,
        backgroundRepeat: structuredAppearanceStyle.backgroundRepeat || baseStyle.backgroundRepeat,
        backgroundPosition: structuredAppearanceStyle.backgroundPosition || baseStyle.backgroundPosition,
        backgroundBlendMode: structuredAppearanceStyle.backgroundBlendMode || baseStyle.backgroundBlendMode,
        borderColor: structuredAppearanceStyle.borderColor || element.strokeColor || element.borderColor || baseStyle.borderColor,
        borderWidth: element.strokeWidth !== undefined ? element.strokeWidth : structuredAppearanceStyle.borderWidth || baseStyle.borderWidth,
      };
      body = <VectorShapeElement element={element} style={vectorShapeStyle} />;
      baseStyle.backgroundColor = 'transparent';
      baseStyle.backgroundImage = undefined;
      baseStyle.borderColor = undefined;
      baseStyle.borderWidth = 0;
      baseStyle.borderStyle = 'none';
      baseStyle.borderRadius = undefined;
      baseStyle.boxShadow = undefined;
      baseStyle.overflow = 'visible';
    } else {
      body = null;
      baseStyle.backgroundColor = element.fillColor || element.backgroundColor || 'transparent';
      baseStyle.borderColor = element.strokeColor || element.borderColor || undefined;
      baseStyle.borderWidth = element.strokeWidth !== undefined ? element.strokeWidth : baseStyle.borderWidth;
      Object.assign(baseStyle, structuredAppearanceStyle);
    }
  } else {
    body = (
      <CardTextContent
        template={currentTemplate}
        element={element}
        data={livePreviewData}
        highlightColor={richTextHighlightColor}
        style={{ lineHeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', textDecoration: 'inherit', fontStyle: 'inherit' }}
      />
    );
  }

  const textElementStyle = element.type === 'text' ? buildTextElementStyle(element) : null;
  const renderedTextStyle = element.type === 'text' && textElementStyle
    ? { ...textElementStyle, fontSize: undefined as unknown as CSSProperties['fontSize'] }
    : null;
  const resizeHandleSize = Math.round(Math.min(
    Math.max(RESIZE_HANDLE_SCREEN_SIZE / Math.max(zoom, CANVAS_ZOOM.min), RESIZE_HANDLE_MIN_CANVAS_SIZE),
    RESIZE_HANDLE_MAX_CANVAS_SIZE,
  ));

  return (
    <div
      key={element.id}
      data-freeform-element-id={element.id}
      data-selected={selected ? 'true' : 'false'}
      data-element-locked={element.locked ? 'true' : 'false'}
      className={cn(
        element.type === 'text' && [element.padding || 'p-1', element.fontFamily || 'font-sans', element.fontWeight || 'font-normal'],
        element.type === 'text' && 'whitespace-pre-wrap break-words',
        element.type === 'icon' && 'flex items-center justify-center',
        selected && !previewMode && 'outline outline-2 outline-offset-2 outline-[#d5ad54]',
        element.locked && 'cursor-not-allowed'
      )}
      style={{
        ...baseStyle,
        ...renderedTextStyle,
      }}
      onPointerDown={(event) => onElementPointerDown(event, element)}
    >
      {body}
      {selected && !previewMode && !element.locked && (
        <>
          {RESIZE_HANDLES.map((resizeHandle) => (
            <button
              key={resizeHandle.handle}
              type="button"
              aria-label={resizeHandle.label}
              data-cardforge-resize-handle="true"
              className={cn(
                'absolute rounded-[2px] border border-[#d5ad54] bg-[#090b0f] shadow-[0_0_12px_rgba(213,173,84,0.45)]',
                resizeHandle.className
              )}
              style={{ cursor: resizeHandle.cursor, height: resizeHandleSize, width: resizeHandleSize }}
              onPointerDown={(event) => onResizePointerDown(event, element, resizeHandle.handle)}
            />
          ))}
        </>
      )}
    </div>
  );
}
