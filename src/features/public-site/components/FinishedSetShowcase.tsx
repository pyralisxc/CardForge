"use client";

import { useEffect, useMemo, useState } from 'react';

import { extractTemplateFieldDefinitions, type TCGCardTemplate } from '@/domain/templates';
import { createBulkDisplayCards } from '@/features/card-generator/client';
import { CardPreview } from '@/features/card-rendering/client';
import { loadCardForgeCatalog } from '@/features/pipeline/client/catalog';
import type { HomepageShowcaseExample } from '../model/examples';
import { useSiteContent } from './PublicSitePresentationContext';

const buildRows = (example: HomepageShowcaseExample): string[][] => {
  const headers = Array.from(new Set(example.rows.flatMap((row) => Object.keys(row))));
  return [headers, ...example.rows.map((row) => headers.map((header) => row[header] ?? ''))];
};

export function FinishedSetShowcase({ example }: { example: HomepageShowcaseExample }) {
  const siteContent = useSiteContent();
  const [templates, setTemplates] = useState<readonly TCGCardTemplate[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void loadCardForgeCatalog()
      .then((payload) => {
        if (!controller.signal.aborted) {
          setTemplates(Array.isArray(payload.templates.defaults) ? payload.templates.defaults : []);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadFailed(true);
      });
    return () => controller.abort();
  }, []);

  const frontTemplate = templates?.find((template) => template.id === example.frontTemplateId)
    ?? (example.frontTemplateName
      ? templates?.find((template) => template.name === example.frontTemplateName)
      : undefined);
  const backTemplate = example.backTemplateId
    ? templates?.find((template) => template.id === example.backTemplateId)
      ?? (example.backTemplateName
        ? templates?.find((template) => template.name === example.backTemplateName)
        : undefined)
    : undefined;
  const cards = useMemo(() => {
    if (!frontTemplate) return [];
    const rows = buildRows(example);
    const headers = rows[0] ?? [];
    return createBulkDisplayCards({
      template: frontTemplate,
      backingTemplate: backTemplate,
      fieldDefinitions: extractTemplateFieldDefinitions(frontTemplate),
      rows,
      columnMapping: Object.fromEntries(headers.map((header) => [header, header])),
      createId: (rowNumber) => `${example.slug}-showcase-${rowNumber}`,
    });
  }, [backTemplate, example, frontTemplate]);

  if (loadFailed) {
    return (
      <div role="status" className="grid min-h-[25rem] place-items-center text-center text-base text-[var(--public-muted-text)]">
        The finished-set preview is temporarily unavailable. You can still explore the Studio walkthrough above.
      </div>
    );
  }

  if (!templates) {
    return (
      <div role="status" className="grid min-h-[25rem] place-items-center text-base text-[var(--public-muted-text)]">
        Loading the real CardForge templates…
      </div>
    );
  }

  if (!frontTemplate) {
    return (
      <div role="status" className="grid min-h-[25rem] place-items-center text-center text-base text-[var(--public-muted-text)]">
        This example is temporarily unavailable because its published Pipeline template could not be found.
      </div>
    );
  }

  return (
    <figure className="min-h-[27rem] border border-[#3b2b19] bg-[#0d0b08] p-4">
      <figcaption className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--public-brass)]">{siteContent['landing.showcase.finished.eyebrow']}</p>
          <h3 className="mt-1 font-[var(--public-font-display)] text-2xl font-semibold text-[var(--public-ivory)]">{example.name}</h3>
        </div>
        <p className="text-base text-[var(--public-muted-text)]">{siteContent['landing.showcase.finished.summary'].replaceAll('{count}', String(cards.length))}</p>
      </figcaption>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.slice(0, 4).map((card, index) => (
          <div key={card.uniqueId} role="img" aria-label={`${example.altText[index] ?? `${example.name} sample card ${index + 1}.`} Finished card ${index + 1}.`} className="flex min-w-0 justify-center rounded-[var(--public-radius)] bg-[var(--cf-surface-raised)] p-2">
            <CardPreview card={card} face="front" targetWidthPx={190} />
          </div>
        ))}
      </div>
    </figure>
  );
}
