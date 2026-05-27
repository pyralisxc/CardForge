"use client";

import type { CSSProperties, DragEvent, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { MousePointer2 } from 'lucide-react';

import { CardPreview } from '@/components/card-forge/CardPreview';
import type { CardData, CardFace, FreeformCanvas, FreeformCardElement, TCGCardTemplate } from '@/types';

const RULER_WIDTH = 28;
const CANVAS_GUTTER = 96;

const rulerTickBackground = (axis: 'x' | 'y', gridSize: number, zoom: number): CSSProperties => ({
  backgroundImage: axis === 'x'
    ? 'repeating-linear-gradient(90deg, transparent 0 19px, rgba(213,173,84,0.48) 19px 20px), repeating-linear-gradient(90deg, transparent 0 99px, rgba(213,173,84,0.9) 99px 100px)'
    : 'repeating-linear-gradient(0deg, transparent 0 19px, rgba(213,173,84,0.48) 19px 20px), repeating-linear-gradient(0deg, transparent 0 99px, rgba(213,173,84,0.9) 99px 100px)',
  backgroundSize: axis === 'x'
    ? `${gridSize * zoom}px 100%, ${gridSize * 5 * zoom}px 100%`
    : `100% ${gridSize * zoom}px, 100% ${gridSize * 5 * zoom}px`,
});

const buildRulerLabels = ({
  axis,
  canvasLength,
  gridSize,
  zoom,
}: {
  axis: 'x' | 'y';
  canvasLength: number;
  gridSize: number;
  zoom: number;
}) => {
  const labelStep = gridSize * 5;
  const rawStep = labelStep * zoom;
  let screenStep = rawStep;
  while (screenStep < 24) screenStep *= 2;

  const totalLength = CANVAS_GUTTER + canvasLength * zoom + CANVAS_GUTTER;
  const minN = Math.floor(-CANVAS_GUTTER / screenStep);
  const maxN = Math.ceil((canvasLength * zoom + CANVAS_GUTTER) / screenStep);
  const labels: ReactNode[] = [];

  for (let n = minN; n <= maxN; n++) {
    const position = CANVAS_GUTTER + n * screenStep;
    if (position < 0 || position > totalLength) continue;

    const value = Math.round(n * screenStep / zoom);
    labels.push(
      <span
        key={n}
        style={{
          position: 'absolute',
          ...(axis === 'x' ? { left: position + 2, top: 14 } : { top: position - 5, right: 3 }),
          fontSize: 7,
          lineHeight: 1,
          color: n === 0 ? 'rgba(213,173,84,0.9)' : n < 0 ? 'rgba(213,173,84,0.4)' : 'rgba(213,173,84,0.65)',
          userSelect: 'none',
          pointerEvents: 'none',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>,
    );
  }

  return labels;
};

interface TemplateCanvasStageProps {
  activeFace: CardFace;
  canvas: FreeformCanvas;
  canvasFrameStyle: CSSProperties;
  canvasRef: { current: HTMLDivElement | null };
  canvasStyle: CSSProperties;
  currentTemplate: TCGCardTemplate;
  gridSize: number;
  livePreviewData: CardData;
  previewMode: boolean;
  selectedElement: FreeformCardElement | null;
  showGrid: boolean;
  stageRef: { current: HTMLDivElement | null };
  zoom: number;
  onCanvasKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onClearDepthSelection: () => void;
  onDeselectCanvas: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  renderEditableElement: (element: FreeformCardElement) => ReactNode;
}

export function TemplateCanvasStage({
  activeFace,
  canvas,
  canvasFrameStyle,
  canvasRef,
  canvasStyle,
  currentTemplate,
  gridSize,
  livePreviewData,
  previewMode,
  selectedElement,
  showGrid,
  stageRef,
  zoom,
  onCanvasKeyDown,
  onClearDepthSelection,
  onDeselectCanvas,
  onDrop,
  onPointerMove,
  onPointerUp,
  renderEditableElement,
}: TemplateCanvasStageProps) {
  return (
    <section className="min-w-0 overflow-hidden bg-[#05080c] lg:min-h-[760px]">
      <div className="flex items-center justify-between border-b border-[#252b35] bg-[#080c12] px-3 py-1.5 text-[11px] text-[#8f95a3]">
        <span className="flex items-center gap-2"><MousePointer2 className="h-3.5 w-3.5 text-[#d5ad54]" /> Drag, snap, resize, layer, and tune every card surface.</span>
        <span className="font-mono text-[#d5ad54]">{Math.round(zoom * 100)}% / {canvas.width} x {canvas.height}</span>
      </div>
      <div
        ref={(stage) => {
          stageRef.current = stage;
        }}
        data-cardforge-stage="true"
        className="relative flex h-[calc(100vh-238px)] min-h-[720px] justify-center overflow-auto bg-[#05080c] p-8"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
      >
        <div
          className="relative"
          style={{
            paddingLeft: RULER_WIDTH + CANVAS_GUTTER,
            paddingTop: RULER_WIDTH + CANVAS_GUTTER,
            width: RULER_WIDTH + CANVAS_GUTTER + canvas.width * zoom + CANVAS_GUTTER,
            height: RULER_WIDTH + CANVAS_GUTTER + canvas.height * zoom + CANVAS_GUTTER,
          }}
        >
          <div aria-hidden="true" className="absolute left-0 top-0 border-b border-r border-[#3b3324] bg-[#090d13]" style={{ width: RULER_WIDTH, height: RULER_WIDTH }} />

          <div
            aria-hidden="true"
            className="absolute top-0 border-b border-[#3b3324] bg-[#090d13] shadow-[inset_0_-1px_0_rgba(213,173,84,0.18)]"
            style={{
              left: RULER_WIDTH,
              height: RULER_WIDTH,
              width: CANVAS_GUTTER + canvas.width * zoom + CANVAS_GUTTER,
              overflow: 'visible',
              ...rulerTickBackground('x', gridSize, zoom),
            }}
          >
            {buildRulerLabels({ axis: 'x', canvasLength: canvas.width, gridSize, zoom })}
          </div>
          <div aria-hidden="true" style={{ position: 'absolute', left: RULER_WIDTH + CANVAS_GUTTER, top: 0, width: 1, height: RULER_WIDTH, background: 'rgba(213,173,84,0.9)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', left: RULER_WIDTH + CANVAS_GUTTER + canvas.width * zoom, top: 0, width: 1, height: RULER_WIDTH, background: 'rgba(213,173,84,0.5)' }} />

          <div
            aria-hidden="true"
            className="absolute left-0 border-r border-[#3b3324] bg-[#090d13] shadow-[inset_-1px_0_0_rgba(213,173,84,0.18)]"
            style={{
              top: RULER_WIDTH,
              width: RULER_WIDTH,
              height: CANVAS_GUTTER + canvas.height * zoom + CANVAS_GUTTER,
              overflow: 'visible',
              ...rulerTickBackground('y', gridSize, zoom),
            }}
          >
            {buildRulerLabels({ axis: 'y', canvasLength: canvas.height, gridSize, zoom })}
          </div>
          <div aria-hidden="true" style={{ position: 'absolute', top: RULER_WIDTH + CANVAS_GUTTER, left: 0, height: 1, width: RULER_WIDTH, background: 'rgba(213,173,84,0.9)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', top: RULER_WIDTH + CANVAS_GUTTER + canvas.height * zoom, left: 0, height: 1, width: RULER_WIDTH, background: 'rgba(213,173,84,0.5)' }} />

          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: RULER_WIDTH,
              top: RULER_WIDTH,
              width: CANVAS_GUTTER + canvas.width * zoom + CANVAS_GUTTER,
              height: CANVAS_GUTTER + canvas.height * zoom + CANVAS_GUTTER,
              backgroundImage: showGrid
                ? [
                    'linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
                    'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)',
                    'linear-gradient(90deg, rgba(213,173,84,0.12) 1px, transparent 1px)',
                    'linear-gradient(rgba(213,173,84,0.12) 1px, transparent 1px)',
                  ].join(', ')
                : undefined,
              backgroundSize: [
                `${gridSize * zoom}px ${gridSize * zoom}px`,
                `${gridSize * zoom}px ${gridSize * zoom}px`,
                `${gridSize * 5 * zoom}px ${gridSize * 5 * zoom}px`,
                `${gridSize * 5 * zoom}px ${gridSize * 5 * zoom}px`,
              ].join(', '),
              backgroundPosition: `${CANVAS_GUTTER}px ${CANVAS_GUTTER}px`,
              pointerEvents: 'none',
            }}
          />

          <p id="maker-canvas-help" className="sr-only">
            Template canvas editor. Select an element, then use arrow keys to move it. Hold Shift to move by grid size. Use Delete or Backspace to remove the selected element.
          </p>
          <p id="maker-selection-status" className="sr-only" role="status" aria-live="polite">
            {selectedElement ? `Selected ${selectedElement.name || selectedElement.type} element.` : 'No element selected.'}
          </p>
          <div
            ref={(node) => {
              canvasRef.current = node;
            }}
            data-cardforge-canvas="true"
            tabIndex={0}
            role="region"
            aria-label="Template canvas"
            aria-describedby="maker-canvas-help maker-selection-status maker-shortcuts-help"
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Delete Backspace Escape"
            className="relative shadow-[0_24px_70px_rgba(0,0,0,0.75),0_0_0_1px_rgba(213,173,84,0.2)] focus:outline-none focus:ring-2 focus:ring-[#d5ad54]"
            style={previewMode ? canvasFrameStyle : canvasStyle}
            onKeyDown={onCanvasKeyDown}
            onPointerDown={() => {
              if (previewMode) return;
              onClearDepthSelection();
              onDeselectCanvas();
            }}
          >
            {previewMode ? (
              <CardPreview
                card={{ template: currentTemplate, data: livePreviewData, uniqueId: `${currentTemplate.id || 'unsaved'}-${activeFace}-editor-preview` }}
                face={activeFace}
                isEditorPreview
                targetWidthPx={canvas.width}
              />
            ) : (
              [...canvas.elements].sort((a, b) => a.zIndex - b.zIndex).map(renderEditableElement)
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
