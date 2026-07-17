"use client";

import { useEffect, useState } from 'react';

import type { TCGCardTemplate } from '@/domain/templates';
import { CARDFORGE_EXAMPLES } from '../model/examples';
import { ExampleHeroProof } from './ExampleHeroProof';
import { ExampleSetGallery } from './ExampleSetGallery';

interface TemplatesPayload {
  defaults?: TCGCardTemplate[];
}

export function LiveExampleGallery({ variant = 'full' }: { variant?: 'full' | 'hero' }) {
  const [templates, setTemplates] = useState<readonly TCGCardTemplate[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void fetch('/api/templates', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Template catalog returned ${response.status}.`);
        return response.json() as Promise<TemplatesPayload>;
      })
      .then((payload) => {
        setTemplates(Array.isArray(payload.defaults) ? payload.defaults : []);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadFailed(true);
      });

    return () => controller.abort();
  }, []);

  if (loadFailed) {
    if (variant === 'hero') {
      return (
        <div role="status" className="rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-surface)] p-5 text-base text-[var(--public-muted-text)]">
          Live card rendering is temporarily unavailable. The complete examples remain documented on the examples page.
        </div>
      );
    }

    return (
      <div role="status" className="rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-surface)] p-5 text-base text-[var(--public-muted-text)]">
        <p>The live previews are temporarily unavailable because the shipped template catalog could not be loaded.</p>
        <ul className="mt-4 space-y-3">
          {CARDFORGE_EXAMPLES.map((example) => (
            <li key={example.slug}>
              <strong className="text-[var(--public-ivory)]">{example.name}</strong>{' '}
              — {example.cardCount} reviewed {example.sourceFormat.toLowerCase()} generated with one reusable template.
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!templates) {
    return <p role="status" className="min-h-40 text-base text-[var(--public-muted-text)]">Loading the live CardForge examples…</p>;
  }

  if (variant === 'hero') {
    const example = CARDFORGE_EXAMPLES[0];
    const frontTemplate = templates.find((template) => template.id === example.frontTemplateId);
    const backTemplate = example.backTemplateId
      ? templates.find((template) => template.id === example.backTemplateId)
      : undefined;

    if (!frontTemplate || (example.backTemplateId && !backTemplate)) {
      return <p role="status" className="text-base text-[var(--public-muted-text)]">The live set preview is temporarily unavailable.</p>;
    }

    return <ExampleHeroProof example={example} frontTemplate={frontTemplate} backTemplate={backTemplate} />;
  }

  return <ExampleSetGallery examples={CARDFORGE_EXAMPLES} templates={templates} />;
}
