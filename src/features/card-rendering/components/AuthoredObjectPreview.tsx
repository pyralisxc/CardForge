"use client";

import type { DisplayCard } from '@/domain/rendering';
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
 * Real card output wins. An empty Set renders its selected Template with the
 * Template's own preview data. The generic work mark is reserved for remote or
 * unreadable work whose package has not been materialized on this device.
 */
export function AuthoredObjectPreview({
  cards = [],
  template,
  label,
  size = 'standard',
  className,
}: AuthoredObjectPreviewProps) {
  const renderedCards = cards.slice(0, 3);
  const fallbackCard = renderedCards.length === 0 && template
    ? previewCardFromTemplate(template, label)
    : null;
  const visualCards = fallbackCard ? [fallbackCard] : renderedCards;

  if (visualCards.length === 0) {
    return (
      <span className={cn(styles.fallback, className)} data-size={size} aria-label={`${label} preview unavailable`}>
        <Boxes aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className={cn(styles.stack, className)} data-size={size} aria-label={`${label} preview`}>
      {visualCards.map((card, index) => (
        <span key={card.uniqueId} className={styles.card} data-card-position={index} aria-hidden="true">
          <CardPreview card={card} targetWidthPx={widthBySize[size]} isEditorPreview />
        </span>
      ))}
    </span>
  );
}
