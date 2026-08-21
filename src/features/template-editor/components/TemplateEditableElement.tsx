"use client";

import type { CSSProperties, PointerEvent } from 'react';

import type { CardData } from '@/domain/cards';
import {
  getImageFieldKeyForElement,
  resolveImageElementOverrides,
} from '@/domain/rendering';
import type { FreeformCardElement } from '@/domain/templates';
import { cn } from '@/shared/classNames';
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
  element: FreeformCardElement;
  livePreviewData: CardData;
  selected: boolean;
  zoom: number;
  onElementContextAction: (element: FreeformCardElement) => void;
  onElementEdit: (element: FreeformCardElement) => void;
  onElementPointerDown: (
    event: PointerEvent<HTMLDivElement>,
    element: FreeformCardElement,
    onElementContextAction: (element: FreeformCardElement) => void,
  ) => void;
  onResizePointerDown: (event: PointerEvent<HTMLButtonElement>, element: FreeformCardElement, handle: ResizeHandle) => void;
}

export function TemplateEditableElement({
  element,
  livePreviewData,
  selected,
  zoom,
  onElementContextAction,
  onElementEdit,
  onElementPointerDown,
  onResizePointerDown,
}: TemplateEditableElementProps) {
  if (element.visible === false) return null;

  const imageResolution = element.type === 'image'
    ? resolveImageElementOverrides(element, livePreviewData, getImageFieldKeyForElement(element))
    : null;
  const interactionElement = imageResolution?.element ?? element;
  const layerTransform = [
    `rotate(${interactionElement.rotation || 0}deg)`,
    interactionElement.flipX ? 'scaleX(-1)' : null,
    interactionElement.flipY ? 'scaleY(-1)' : null,
  ].filter(Boolean).join(' ');
  const overlayStyle: CSSProperties = {
    position: 'absolute',
    left: interactionElement.x,
    top: interactionElement.y,
    width: interactionElement.width,
    height: interactionElement.height,
    transform: layerTransform,
    transformOrigin: 'center',
    zIndex: interactionElement.zIndex,
    boxSizing: 'border-box',
    cursor: interactionElement.locked ? 'not-allowed' : 'move',
    background: 'transparent',
  };
  const resizeHandleSize = Math.round(Math.min(
    Math.max(RESIZE_HANDLE_SCREEN_SIZE / Math.max(zoom, CANVAS_ZOOM.min), RESIZE_HANDLE_MIN_CANVAS_SIZE),
    RESIZE_HANDLE_MAX_CANVAS_SIZE,
  ));

  return (
    <div
      data-freeform-element-id={element.id}
      data-cardforge-editor-overlay="true"
      data-selected={selected ? 'true' : 'false'}
      data-element-locked={interactionElement.locked ? 'true' : 'false'}
      className={cn(
        selected && 'outline outline-2 outline-offset-2 outline-[#d5ad54]',
        interactionElement.locked && 'cursor-not-allowed'
      )}
      style={overlayStyle}
      onPointerDown={(event) => onElementPointerDown(event, element, onElementContextAction)}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onDoubleClick={() => {
        if (element.type === 'text') onElementEdit(element);
      }}
    >
      {selected && !interactionElement.locked ? (
        <>
          {RESIZE_HANDLES.map((resizeHandle) => (
            <button
              key={resizeHandle.handle}
              type="button"
              aria-label={resizeHandle.label}
              data-cardforge-resize-handle="true"
              className={cn(
                'absolute border-0 bg-transparent shadow-none before:absolute before:inset-[30%] before:rounded-[2px] before:border before:border-[#d5ad54] before:bg-[#090b0f] before:shadow-[0_0_12px_rgba(213,173,84,0.45)]',
                resizeHandle.className
              )}
              style={{ cursor: resizeHandle.cursor, height: resizeHandleSize, width: resizeHandleSize }}
              onPointerDown={(event) => onResizePointerDown(event, element, resizeHandle.handle)}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}
