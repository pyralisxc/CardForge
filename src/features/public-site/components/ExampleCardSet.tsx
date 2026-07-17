"use client";

import { useMemo } from 'react';

import { extractTemplateFieldDefinitions, type TCGCardTemplate } from '@/domain/templates';
import { createBulkDisplayCards } from '@/features/card-generator/client';
import { CardPreview } from '@/features/card-rendering/client';
import type { CardForgeExample } from '../model/examples';

interface ExampleCardSetProps {
  example: CardForgeExample;
  frontTemplate: TCGCardTemplate;
  backTemplate?: TCGCardTemplate;
}

const buildBulkRows = (example: CardForgeExample): string[][] => {
  const headers = Array.from(new Set(example.rows.flatMap((row) => Object.keys(row))));
  return [
    headers,
    ...example.rows.map((row) => headers.map((header) => row[header] ?? '')),
  ];
};

export function ExampleCardSet({ example, frontTemplate, backTemplate }: ExampleCardSetProps) {
  const cards = useMemo(() => {
    const rows = buildBulkRows(example);
    const headers = rows[0] ?? [];
    return createBulkDisplayCards({
      template: frontTemplate,
      backingTemplate: backTemplate,
      fieldDefinitions: extractTemplateFieldDefinitions(frontTemplate),
      rows,
      columnMapping: Object.fromEntries(headers.map((header) => [header, header])),
      createId: (rowNumber) => `${example.slug}-${rowNumber}`,
    });
  }, [backTemplate, example, frontTemplate]);

  const captionId = `${example.slug}-caption`;

  return (
    <figure aria-labelledby={captionId} className="overflow-hidden rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-surface)] shadow-[var(--public-shadow)]">
      <div className="p-5 md:p-6">
      <figcaption id={captionId} className="max-w-3xl">
        <p className="text-base font-semibold text-[var(--public-brass)]">
          {example.systemType}
        </p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-[var(--public-ivory)]">
          {example.name}
        </h2>
        <p className="mt-3 text-base leading-7 text-[var(--public-muted-text)]">{example.description}</p>
      </figcaption>

      <div className="mt-7">
        <h3 className="text-base font-semibold text-[var(--public-ivory)]">The finished cards</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {cards.map((card, index) => (
            <div
              key={card.uniqueId}
              role="img"
              aria-label={`${example.altText.rows[index]} Card ${index + 1} of ${cards.length}.`}
              className="flex justify-center overflow-hidden rounded-[var(--public-radius)] border border-[#3e2d1a] bg-[#100d09] p-2"
            >
              <CardPreview card={card} face="front" targetWidthPx={180} />
            </div>
          ))}
        </div>
      </div>

      {backTemplate && cards[0] && example.altText.back ? (
        <div className="mt-7">
          <h3 className="text-base font-semibold text-[var(--public-ivory)]">The shared back</h3>
          <div
            role="img"
            aria-label={example.altText.back}
            className="mt-3 flex w-fit justify-center overflow-hidden rounded-[var(--public-radius)] border border-[#3e2d1a] bg-[#100d09] p-2"
          >
            <CardPreview card={cards[0]} face="back" targetWidthPx={180} />
          </div>
          <p className="mt-2 text-base text-[var(--public-muted-text)]">One shared back for all {example.cardCount} cards.</p>
        </div>
      ) : null}

      <div className="mt-7 border-t border-[var(--public-border)] pt-5">
        <h3 className="text-lg font-semibold text-[var(--public-ivory)]">What CardForge handled</h3>
        <p className="mt-2 text-base leading-7 text-[var(--public-muted-text)]">{example.caseStudy.summary}</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-base text-[var(--public-muted-text)]">
          {example.caseStudy.workflow.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </div>
      </div>

      <details className="border-t border-[var(--public-border)] bg-[#100d09] px-5 py-4 md:px-6">
        <summary className="min-h-11 cursor-pointer font-bold text-[var(--public-brass)]">Technical details</summary>
        <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-2 text-base text-[var(--public-muted-text)]">
          <div><dt className="inline font-semibold text-[var(--public-ivory)]">Source: </dt><dd className="inline">{example.sourceFormat}</dd></div>
          <div><dt className="inline font-semibold text-[var(--public-ivory)]">Count: </dt><dd className="inline">{example.cardCount} cards</dd></div>
          <div><dt className="inline font-semibold text-[var(--public-ivory)]">Downloads: </dt><dd className="inline">{example.outputFormats.join(', ')}</dd></div>
        </dl>
      </details>
    </figure>
  );
}
