"use client";

import { useMemo, useState } from 'react';
import { ArrowRight, LayoutTemplate, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { CardSet } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import { getTemplateLineageId, type TCGCardTemplate } from '@/domain/templates';
import { CardPreview, getTemplateAccent } from '@/features/card-rendering/client';
import styles from './SetTemplates.module.css';

interface SetTemplatesProps {
  set: CardSet;
  cards: DisplayCard[];
  templates: TCGCardTemplate[];
  onDesign: (templateId: string) => void;
  onAdoptRevision: (fromTemplateId: string, toTemplateId: string) => void;
}

const findNewerRevision = (
  current: TCGCardTemplate,
  templates: readonly TCGCardTemplate[],
): TCGCardTemplate | null => {
  const lineageId = getTemplateLineageId(current);
  if (!lineageId || !current.id) return null;
  const sameLineage = templates.filter((candidate) => (
    candidate.id
    && candidate.id !== current.id
    && candidate.templateUsage === current.templateUsage
    && getTemplateLineageId(candidate) === lineageId
  ));
  if (!sameLineage.length) return null;

  const byRevisionId = new Map(templates.flatMap((candidate) => (
    candidate.templateRevisionId ? [[candidate.templateRevisionId, candidate] as const] : []
  )));
  const isDescendant = (candidate: TCGCardTemplate) => {
    if (!current.templateRevisionId) {
      return Number(candidate.templateRevision ?? 0) > Number(current.templateRevision ?? 0);
    }
    let parentId = candidate.templateParentRevisionId;
    const visited = new Set<string>();
    while (parentId && !visited.has(parentId)) {
      if (parentId === current.templateRevisionId) return true;
      visited.add(parentId);
      parentId = byRevisionId.get(parentId)?.templateParentRevisionId;
    }
    return false;
  };
  return sameLineage
    .filter(isDescendant)
    .sort((left, right) => Number(right.templateRevision ?? 0) - Number(left.templateRevision ?? 0))[0] ?? null;
};

export function SetTemplates({ set, cards, templates: allTemplates, onDesign, onAdoptRevision }: SetTemplatesProps) {
  const [open, setOpen] = useState(false);
  const entries = useMemo(() => {
    const referencedIds = new Set(set.templateIds ?? []);
    cards.forEach((card) => {
      if (card.template.id) referencedIds.add(card.template.id);
      if (card.backingTemplate?.id) referencedIds.add(card.backingTemplate.id);
    });
    return [...referencedIds].flatMap((templateId) => {
      const template = allTemplates.find((candidate) => candidate.id === templateId);
      if (!template?.id) return [];
      const cardIds = new Set(cards.filter((card) => (
        card.template.id === templateId || card.backingTemplate?.id === templateId
      )).map((card) => card.uniqueId));
      return [{ template, cardIds, update: findNewerRevision(template, allTemplates) }];
    });
  }, [allTemplates, cards, set.templateIds]);

  if (!entries.length) return null;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" size="sm" variant="ghost">Templates · {entries.length}</Button></PopoverTrigger>
    <PopoverContent align="start" className={`${styles.templates} w-[min(32rem,calc(100vw-2rem))]`} aria-label="Templates in this Set">
      <div className={styles.heading}><strong>Designs in this Set</strong><span>Templates are reusable. Saved Sets keep the exact revisions they use.</span></div>
      <div className={styles.items}>
        {entries.map(({ template, cardIds, update }) => {
          const representative = template.templateUsage === 'back-preset'
            ? cards.find((card) => card.backingTemplate?.id === template.id)
            : cards.find((card) => card.template.id === template.id);
          const preview = representative && template.templateUsage !== 'back-preset'
            ? { ...representative, template }
            : null;
          const updatePreview = preview && update
            ? { ...preview, template: update }
            : null;
          return <div key={template.id} className="space-y-2 rounded-md border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-2">
            <button
              type="button"
              className={`${styles.template} w-full`}
              style={{ borderColor: getTemplateAccent(template.id!) }}
              data-set-template={template.id}
              onClick={() => { setOpen(false); onDesign(template.id!); }}
              aria-label={`Design ${template.templateUsage === 'back-preset' ? 'back Template' : 'Template'} ${template.name}, ${cardIds.size ? `used by ${cardIds.size} ${cardIds.size === 1 ? 'Artifact' : 'Artifacts'}` : 'prepared for this Set'}`}
              title="Edit this reusable Template in Studio."
            >
              <LayoutTemplate size={20} aria-hidden="true" />
              <span><small>{template.templateUsage === 'back-preset' ? 'Back Template' : 'Template'} · {cardIds.size ? `${cardIds.size} ${cardIds.size === 1 ? 'Artifact' : 'Artifacts'}` : 'Prepared'}</small><strong>{template.name}</strong></span>
            </button>
            {update ? <div className="rounded border border-[var(--cf-border-strong)] bg-[var(--cf-canvas)] p-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-[var(--cf-accent-strong)]"><TriangleAlert className="h-3.5 w-3.5" />Update available{update.templateRevision ? ` · revision ${update.templateRevision}` : ''}</span>
                <span className="text-[var(--cf-text-muted)]">Your saved revision remains active until you choose.</span>
              </div>
              {preview && updatePreview ? <div className="mt-2 flex items-center gap-2" aria-label={`Preview ${template.name} before and after update`}>
                <div className="space-y-1"><small className="text-[10px] text-[var(--cf-text-muted)]">Current</small><CardPreview card={preview} face="front" targetWidthPx={72} /></div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--cf-text-muted)]" aria-hidden="true" />
                <div className="space-y-1"><small className="text-[10px] text-[var(--cf-text-muted)]">Available</small><CardPreview card={updatePreview} face="front" targetWidthPx={72} /></div>
              </div> : null}
              <div className="mt-2 flex justify-end"><Button type="button" size="sm" onClick={() => onAdoptRevision(template.id!, update.id!)}>Use available revision</Button></div>
            </div> : null}
          </div>;
        })}
      </div>
    </PopoverContent>
  </Popover>;
}