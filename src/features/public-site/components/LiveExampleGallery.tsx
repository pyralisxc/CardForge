"use client";

import { useEffect, useState } from 'react';

import type { TCGCardTemplate } from '@/domain/templates';
import { CARDFORGE_EXAMPLES } from '../model/examples';
import { ExampleHeroProof } from './ExampleHeroProof';

interface TemplatesPayload {
  defaults?: TCGCardTemplate[];
}

export function LiveExampleGallery() {
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
    return (
      <div role="status" className="rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-surface)] p-5 text-base text-[var(--public-muted-text)]">
        Live card rendering is temporarily unavailable. The Studio screenshots and workflow remain available above.
      </div>
    );
  }

  if (!templates) {
    return <p role="status" className="min-h-40 text-base text-[var(--public-muted-text)]">Loading the live CardForge examples…</p>;
  }

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
