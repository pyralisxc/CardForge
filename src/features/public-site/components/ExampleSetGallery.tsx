"use client";

import type { TCGCardTemplate } from '@/domain/templates';
import type { CardForgeExample } from '../model/examples';
import { ExampleCardSet } from './ExampleCardSet';

interface ExampleSetGalleryProps {
  examples: readonly CardForgeExample[];
  templates: readonly TCGCardTemplate[];
}

export function ExampleSetGallery({ examples, templates }: ExampleSetGalleryProps) {
  const templatesById = new Map(templates.map((template) => [template.id, template]));

  return (
    <div className="space-y-8">
      {examples.map((example) => {
        const frontTemplate = templatesById.get(example.frontTemplateId);
        const backTemplate = example.backTemplateId
          ? templatesById.get(example.backTemplateId)
          : undefined;
        const missingTemplate = !frontTemplate || (example.backTemplateId && !backTemplate);

        if (missingTemplate) {
          return (
            <section key={example.slug} aria-labelledby={`${example.slug}-unavailable`} className="rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--public-surface)] p-6">
              <h2 id={`${example.slug}-unavailable`} className="font-serif text-2xl text-[var(--public-ivory)]">{example.name}</h2>
              <p role="status" className="mt-3 text-base text-[var(--public-muted-text)]">
                This example preview is unavailable because a referenced shipped template could not be loaded.
              </p>
            </section>
          );
        }

        return (
          <ExampleCardSet
            key={example.slug}
            example={example}
            frontTemplate={frontTemplate}
            backTemplate={backTemplate}
          />
        );
      })}
    </div>
  );
}
