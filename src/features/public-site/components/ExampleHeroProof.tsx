"use client";

import { useMemo } from 'react';

import { extractTemplateFieldDefinitions, type TCGCardTemplate } from '@/domain/templates';
import { createBulkDisplayCards } from '@/features/card-generator/client';
import { CardPreview } from '@/features/card-rendering/client';
import type { CardForgeExample } from '../model/examples';

interface ExampleHeroProofProps {
  example: CardForgeExample;
  frontTemplate: TCGCardTemplate;
  backTemplate?: TCGCardTemplate;
}

export function ExampleHeroProof({ example, frontTemplate, backTemplate }: ExampleHeroProofProps) {
  const cards = useMemo(() => {
    const headers = Array.from(new Set(example.rows.flatMap((row) => Object.keys(row))));
    const rows = [
      headers,
      ...example.rows.map((row) => headers.map((header) => row[header] ?? '')),
    ];

    return createBulkDisplayCards({
      template: frontTemplate,
      backingTemplate: backTemplate,
      fieldDefinitions: extractTemplateFieldDefinitions(frontTemplate),
      rows,
      columnMapping: Object.fromEntries(headers.map((header) => [header, header])),
      createId: (rowNumber) => `${example.slug}-hero-${rowNumber}`,
    });
  }, [backTemplate, example, frontTemplate]);

  return (
    <figure className="rounded-[var(--public-radius)] border border-[#a48f6d] bg-[#f2e5cf] p-4 shadow-[var(--public-shadow)] md:p-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.slice(0, 4).map((card, index) => (
          <div
            key={card.uniqueId}
            role="img"
            aria-label={`${example.altText.rows[index]} Card ${index + 1} of ${cards.length}.`}
            className="flex min-w-0 justify-center overflow-hidden rounded-[var(--public-radius)] bg-white/55 p-1.5"
          >
            <CardPreview card={card} face="front" targetWidthPx={136} />
          </div>
        ))}
      </div>
      <figcaption className="mt-4 flex flex-wrap items-baseline justify-between gap-2 text-base text-[#5f5548]">
        <strong className="text-[var(--public-text)]">{example.name}</strong>
        <span>{example.cardCount} cards from one {example.sourceFormat.toLowerCase()} source</span>
      </figcaption>
    </figure>
  );
}
