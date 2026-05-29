"use client";

import type { CSSProperties, PointerEvent } from 'react';
import * as LucideIcons from 'lucide-react';
import { Sparkles } from 'lucide-react';

import { VectorShapeElement } from '@/components/card-forge/VectorShapeElement';
import { appearanceToStyle, normalizeAppearanceForElement } from '@/lib/appearance';
import { CardTextContent } from '@/lib/cardTextRender';
import { isDividerElement } from '@/lib/elementCapabilities';
import { borderWidthClassToPixels, borderWidthClassToStyle, radiusClassToCss, resolveFreeformImageUrl } from '@/lib/freeformElementRender';
import { replacePlaceholdersLocal } from '@/lib/textBindings';
import { buildTextElementStyle } from '@/lib/textTools';
import { cn } from '@/lib/utils';
import { canRenderVectorShape } from '@/lib/vectorShapes';
import type { CardData, FreeformCardElement, TCGCardTemplate } from '@/types';
import type { ResizeHandle } from '@/features/template-editor/hooks/useCanvasPointerInteractions';

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

  const borderWidth = borderWidthClassToPixels(element.borderWidth);
  const resolvedBg = element.backgroundImageUrl ? replacePlaceholdersLocal(element.backgroundImageUrl, livePreviewData, false) : '';
  const structuredAppearanceStyle = appearanceToStyle(normalizeAppearanceForElement(element));
  const elementIsDivider = isDividerElement(element);
  const baseStyle: CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    transform: `rotate(${element.rotation || 0}deg)${element.appearance?.assetFlipX ? ' scaleX(-1)' : ''}`,
    transformOrigin: 'center',
    opacity: element.opacity ?? 1,
    zIndex: element.zIndex,
    color: element.textColor || currentTemplate.baseTextColor || undefined,
    backgroundColor: element.backgroundColor || 'transparent',
    backgroundImage: resolvedBg && (resolvedBg.startsWith('linear-gradient') || resolvedBg.startsWith('radial-gradient'))
      ? resolvedBg
      : resolvedBg && (resolvedBg.startsWith('http') || resolvedBg.startsWith('data:'))
        ? `url(${resolvedBg})`
        : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    borderStyle: borderWidth > 0 ? 'solid' : undefined,
    borderColor: element.borderColor || currentTemplate.defaultElementBorderColor || undefined,
    borderRadius: radiusClassToCss(element.borderRadius) || element.borderRadius || undefined,
    ...borderWidthClassToStyle(element.borderWidth),
    boxSizing: 'border-box',
    overflow: 'hidden',
    cursor: previewMode || element.locked ? 'default' : 'move',
    ...structuredAppearanceStyle,
  };

  let body;
  if (element.type === 'image') {
    const imageUrl = resolveFreeformImageUrl(element, livePreviewData, 'Artwork');
    body = <img src={imageUrl} alt={element.name} className="block h-full w-full max-h-full max-w-full" style={{ minWidth: 0, minHeight: 0, objectFit: element.imageObjectFit || 'cover', objectPosition: 'center', borderRadius: 'inherit' }} draggable={false} />;
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
  const resizeHandleSize = Math.round(Math.min(Math.max(20 / Math.max(zoom, 0.16), 18), 120));

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
