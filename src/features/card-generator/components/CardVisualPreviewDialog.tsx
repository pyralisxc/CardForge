"use client";

import { useState } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CardPreview, CardWatermarkOverlay } from '@/features/card-rendering/client';
import type { CardFace } from '@/domain/cards';
import { hasCardBacking, type DisplayCard } from '@/domain/rendering';

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 2.25;
const ZOOM_STEP = 0.2;
const BASE_PREVIEW_WIDTH = 360;

const clampZoom = (value: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));

export function CardVisualPreviewDialog({
  card,
  open,
  onOpenChange,
  richTextHighlightColor,
  showWatermark,
}: {
  card: DisplayCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  richTextHighlightColor: string;
  showWatermark: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [face, setFace] = useState<CardFace>('front');
  const hasBack = card ? hasCardBacking(card) : false;
  const visibleFace: CardFace = hasBack ? face : 'front';

  if (!card) return null;

  const title = String(card.data.cardName ?? card.data.name ?? card.data.title ?? card.template.name ?? 'Card preview');

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setZoom(1);
          setFace('front');
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="flex h-[min(92dvh,58rem)] max-h-[92dvh] w-[min(96vw,72rem)] max-w-[72rem] min-h-0 flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-[var(--cf-border-subtle)] px-4 py-3 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Visual inspection only. Zoom in, then scroll in any direction to inspect the rendered card closely.</DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] px-3 py-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Zoom out"
            onClick={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}
            disabled={zoom <= MIN_ZOOM}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="min-w-14 text-center font-mono text-xs text-[var(--cf-text-muted)]">{Math.round(zoom * 100)}%</span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Zoom in"
            onClick={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}
            disabled={zoom >= MAX_ZOOM}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setZoom(1)}>
            <Maximize2 className="mr-1.5 h-4 w-4" /> 100%
          </Button>

          {hasBack ? (
            <div className="ml-auto flex items-center rounded border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-0.5" role="group" aria-label="Preview card face">
              {(['front', 'back'] as const).map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={visibleFace === option ? 'secondary' : 'ghost'}
                  aria-pressed={visibleFace === option}
                  className="h-8 capitalize"
                  onClick={() => setFace(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto overscroll-contain bg-[var(--cf-editor-canvas)] p-6 [scrollbar-gutter:stable]">
          <div className="grid min-h-full min-w-full place-items-center">
            <div className="relative w-fit shrink-0">
              <CardPreview
                card={card}
                face={visibleFace}
                highlightColor={richTextHighlightColor}
                targetWidthPx={Math.round(BASE_PREVIEW_WIDTH * zoom)}
              />
              {showWatermark ? <CardWatermarkOverlay testId={`visual-preview-watermark-${card.uniqueId}`} /> : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
