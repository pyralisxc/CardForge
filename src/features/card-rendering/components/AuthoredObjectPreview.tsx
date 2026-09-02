"use client";

import type { DisplayCard } from '@/domain/rendering';
import type { CardFace } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import { cn } from '@/shared/classNames';
import { Boxes } from 'lucide-react';

import { CardPreview } from './CardPreview';
import styles from './AuthoredObjectPreview.module.css';

export interface AuthoredObjectPreviewProps {
  cards?: readonly DisplayCard[];
  template?: TCGCardTemplate | null;
  label: string;
  size?: 'compact' | 'standard' | 'large';
  className?: string;
  emptyLabel?: string;
  face?: CardFace;
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
}: AuthoredObjectPreviewProps) {
  const renderedCards = cards.slice(0, 3);
  const explicitlyEmpty = renderedCards.length === 0 && Boolean(emptyLabel);
  const fallbackCard = !explicitlyEmpty && renderedCards.length === 0 && template
    ? previewCardFromTemplate(template, label)
    : null;
  const visualCards = fallbackCard ? [fallbackCard] : renderedCards;

  if (visualCards.length === 0) {
    return (
      <span className={cn(styles.fallback, className)} data-size={size} aria-label={explicitlyEmpty ? `${label} ${emptyLabel}` : `${label} preview unavailable`}>
        <Boxes aria-hidden="true" />
        {explicitlyEmpty ? <span className={styles.emptyBadge}>{emptyLabel}</span> : null}
      </span>
    );
  }

  return (
    <span className={cn(styles.stack, className)} data-size={size} aria-label={`${label} preview`}>
      {visualCards.map((card, index) => (
        <span key={card.uniqueId} className={styles.card} data-card-position={index} aria-hidden="true">
          <CardPreview card={card} face={face} targetWidthPx={widthBySize[size]} isEditorPreview />
        </span>
      ))}
    </span>
  );
}
