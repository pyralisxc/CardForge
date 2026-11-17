"use client";

import { useMemo, useState } from 'react';
import { ArrowRight, LayoutTemplate, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { CardSet } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import type { TCGCardTemplate } from '@/domain/templates';
import { useToast } from '@/components/ui/use-toast';
import { isTemplateUpdateSource, openSetTemplateUpdateReview, type OpenTemplateUpdateReview } from '@/features/project/client/workspace';
import { TemplateUpdateReviewDialog } from './TemplateUpdateReviewDialog';
import { CardPreview, getTemplateAccent } from '@/features/card-rendering/client';
import styles from './SetTemplates.module.css';

interface SetTemplatesProps {
  set: CardSet;
  cards: DisplayCard[];
  templates: TCGCardTemplate[];
  onDesign: (templateId: string) => void;
}

export function SetTemplates({ set, cards, templates: allTemplates, onDesign }: SetTemplatesProps) {
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<OpenTemplateUpdateReview | null>(null);
  const [selectedSources, setSelectedSources] = useState<Record<string, string>>({});
  const { toast } = useToast();
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
      const sources = allTemplates.filter((candidate) => isTemplateUpdateSource(template, candidate))
        .sort((left, right) => Number(right.templateRevision ?? 0) - Number(left.templateRevision ?? 0));
      return [{ template, cardIds, sources }];
    });
  }, [allTemplates, cards, set.templateIds]);

  if (!entries.length) return null;
  const beginReview = (templateId: string, sourceId: string) => {
    try {
      const next = openSetTemplateUpdateReview(set.id, templateId, sourceId);
      setOpen(false); setReview(next);
    } catch (cause) { toast({ title: 'Review unavailable', description: cause instanceof Error ? cause.message : 'The source snapshot could not be read. Nothing was changed.', variant: 'destructive' }); }
  };
  return <><Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" size="sm" variant="ghost">Templates · {entries.length}</Button></PopoverTrigger>
    <PopoverContent align="start" className={`${styles.templates} w-[min(32rem,calc(100vw-2rem))]`} aria-label="Templates in this Set">
      <div className={styles.heading}><strong>Designs in this Set</strong><span>This Set owns its working designs. Related revisions are reviewed explicitly.</span></div>
      <div className={styles.items}>
        {entries.map(({ template, cardIds, sources }) => {
          const update = sources.find((candidate) => candidate.id === selectedSources[template.id!]) ?? sources[0];
          const reviews = (set.updateReviews ?? []).filter((entry) => entry.templateId === template.id);
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
                <span className="inline-flex items-center gap-1.5 font-medium text-[var(--cf-accent-strong)]"><TriangleAlert className="h-3.5 w-3.5" />Related revision available</span>
                <span className="text-[var(--cf-text-muted)]">Your saved revision remains active until you choose.</span>
              </div>
              <label className="my-2 block text-xs">Related revision
                <select className="mt-1 block w-full rounded border bg-background p-2 text-sm" value={update.id!}
                  onChange={(event) => setSelectedSources((current) => ({ ...current, [template.id!]: event.target.value }))}>
                  {sources.map((candidate) => <option key={candidate.id} value={candidate.id!}>{candidate.name} · {candidate.templateRevisionId}</option>)}
                </select>
              </label>
              {preview && updatePreview ? <div className="mt-2 flex items-center gap-2" aria-label={`Preview ${template.name} before and after update`}>
                <div className="space-y-1"><small className="text-[10px] text-[var(--cf-text-muted)]">Current</small><CardPreview card={preview} face="front" targetWidthPx={72} /></div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--cf-text-muted)]" aria-hidden="true" />
                <div className="space-y-1"><small className="text-[10px] text-[var(--cf-text-muted)]">Available</small><CardPreview card={updatePreview} face="front" targetWidthPx={72} /></div>
              </div> : null}
              <div className="mt-2 flex justify-end"><Button type="button" size="sm" onClick={() => beginReview(template.id!, update.id!)}>Review Update</Button></div>
            </div> : <p className="text-xs text-muted-foreground">No other exact related snapshot is available here. Missing history cannot be compared.</p>}
            {reviews.length ? <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Recorded reviews · {reviews.length}</summary>
              <ul className="mt-2 space-y-2">{reviews.map((entry) => <li key={`${entry.sourceLineageId}:${entry.sourceRevisionId}`} className="break-all">
                {entry.sourceRevisionId} — {entry.outcome === 'reviewed' ? 'Reviewed' : 'Deferred'} · {entry.decisions.filter((choice) => choice.decision === 'keep').length} kept, {entry.decisions.filter((choice) => choice.decision === 'use').length} used, {entry.decisions.filter((choice) => choice.decision === 'defer').length} deferred
              </li>)}</ul>
            </details> : null}
          </div>;
        })}
      </div>
    </PopoverContent>
  </Popover>
    {review && review.setId === set.id ? <TemplateUpdateReviewDialog key={`${review.current.id}:${review.incoming.id}`} review={review} onClose={() => setReview(null)} /> : null}
  </>;
}