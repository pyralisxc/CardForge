"use client";

import { getCardFaceCanvas, getCardFaceTemplate, getCardPreviewLayout, type DisplayCard } from '@/domain/rendering';
import type { CardFace } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import { cn } from '@/shared/classNames';
import { Boxes } from 'lucide-react';

import { ArtifactSlot, useArtifactFaces } from './ArtifactScene';
import styles from './AuthoredObjectPreview.module.css';

export interface AuthoredObjectPreviewProps {
  cards?: readonly DisplayCard[];
  template?: TCGCardTemplate | null;
  label: string;
  size?: 'compact' | 'standard' | 'large';
  className?: string;
  emptyLabel?: string;
  face?: CardFace;
  setId?: string;
  sceneHidden?: boolean;
}

const widthBySize = {
  compact: 58,
  standard: 86,
  large: 138,
} as const;

const previewCardFromTemplate = (template: TCGCardTemplate, label: string): DisplayCard => ({
  template,
  data: template.templatePreviewData ?? {},
  uniqueId: `authored-object-preview-${template.id ?? template.name}-${label}`,
});

/**
 * Canonical visual identity for authored CardForge work.
 *
 * Real card output wins. A caller can mark a container explicitly empty so it
 * stays visually neutral instead of borrowing a Template it does not own.
 * Template objects may still render their own preview data.
 */
export function AuthoredObjectPreview({
  cards = [],
  template,
  label,
  size = 'standard',
  className,
  emptyLabel,
  face = 'front',
  setId,
  sceneHidden = false,
}: AuthoredObjectPreviewProps) {
  const [faces] = useArtifactFaces();
  const renderedCards = cards.slice(0, 5);
  const explicitlyEmpty = renderedCards.length === 0 && Boolean(emptyLabel);
  const fallbackCard = !explicitlyEmpty && renderedCards.length === 0 && template
    ? previewCardFromTemplate(template, label)
    : null;
  const visualCards = fallbackCard ? [fallbackCard] : renderedCards;
  const width = widthBySize[size];
  // Transforms do not reserve layout space. Keep the fan clear of its Set label.
  const fanClearance = visualCards.length > 1 ? Math.max(...visualCards.map((card) => {
    const visibleFace = faces[card.uniqueId] ?? face;
    const geometry = getCardPreviewLayout({ targetWidthPx: width, aspectRatio: getCardFaceTemplate(card, visibleFace).aspectRatio, canvas: getCardFaceCanvas(card, visibleFace), isPrintMode: false });
    return geometry.visualHeightPx * 0.18 + width * 0.25 + 8;
  })) : 0;

  if (visualCards.length === 0) {
    return (
      <span className={cn(styles.fallback, className)} data-size={size} aria-label={explicitlyEmpty ? `${label} ${emptyLabel}` : `${label} preview unavailable`}>
        <Boxes aria-hidden="true" />
        {explicitlyEmpty ? <span className={styles.emptyBadge}>{emptyLabel}</span> : null}
      </span>
    );
  }

  return (
    <span className={cn(styles.stack, className)} style={{ paddingBlockEnd: fanClearance }} data-size={size} data-scene-hidden={sceneHidden} aria-label={`${label} preview`}>
      {visualCards.map((card, index) => (
        <span key={card.uniqueId} className={styles.card} data-card-position={index} data-preview-artifact-id={card.uniqueId} aria-hidden="true">
          <ArtifactSlot card={card} face={face} width={width} depth="stack" setId={setId} rotation={[0, -7, 7, -14, 14][index]} order={5 - index} />
        </span>
      ))}
    </span>
  );
}
