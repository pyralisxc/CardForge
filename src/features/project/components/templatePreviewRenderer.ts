import type { ReactNode } from 'react';
import type { DisplayCard } from '@/domain/rendering';

export type TemplatePreviewRenderer = (
  card: DisplayCard,
  face: 'front' | 'back',
  targetWidthPx: number,
  highlightedElementId?: string,
) => ReactNode;
