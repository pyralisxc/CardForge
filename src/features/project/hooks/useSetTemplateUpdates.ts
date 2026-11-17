"use client";

import { useEffect, useMemo, useState } from 'react';
import type { TCGCardTemplate } from '@/domain/templates';
import { isTemplateUpdateReviewComplete, isTemplateUpdateSource } from '../model/templateUpdateReview';
import { openSetTemplateUpdateReview } from '../client/setTemplateUpdateReview';
import { selectAllGeneratedDisplayCards, selectAllTemplates } from '../store/selectors';
import { useProjectStore } from '../store/workspaceStore';

export interface SetTemplateUpdate {
  template: TCGCardTemplate;
  source: TCGCardTemplate;
  reviewed: boolean;
  error?: string;
}

export function useSetTemplateUpdates(setId: string) {
  const cardSets = useProjectStore((state) => state.cardSets);
  const userTemplates = useProjectStore((state) => state.userTemplates);
  const defaultTemplates = useProjectStore((state) => state.defaultTemplates);
  const storedCards = useProjectStore((state) => state.storedCards);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ inputs: unknown[]; items: SetTemplateUpdate[] } | null>(null);
  const set = cardSets.find((candidate) => candidate.id === setId);
  const templates = useMemo(() => selectAllTemplates({ userTemplates, defaultTemplates }), [userTemplates, defaultTemplates]);
  const cards = useMemo(() => {
    const state = useProjectStore.getState();
    return selectAllGeneratedDisplayCards({ ...state, cardSets, defaultTemplates, storedCards, userTemplates })
      .filter((card) => (card.setId ?? cardSets[0]?.id) === setId);
  }, [cardSets, defaultTemplates, storedCards, userTemplates, setId]);
  const owned = useMemo(() => {
    const ids = new Set(set?.templateIds ?? []);
    cards.forEach((card) => { if (card.template.id) ids.add(card.template.id); if (card.backingTemplate?.id) ids.add(card.backingTemplate.id); });
    return templates.filter((template) => template.id && ids.has(template.id));
  }, [set?.templateIds, cards, templates]);
  const inputs = useMemo(() => [setId, set, owned, templates, storedCards, refresh], [setId, set, owned, templates, storedCards, refresh]);
  useEffect(() => {
    const controller = new AbortController();
    const candidates = owned.flatMap((template) => templates.filter((source) => isTemplateUpdateSource(template, source)).map((source) => ({ template, source })));
    void Promise.all(candidates.map(async ({ template, source }): Promise<SetTemplateUpdate> => {
      try {
        const review = await openSetTemplateUpdateReview(setId, template.id!, source.id!, controller.signal);
        const reviewed = isTemplateUpdateReviewComplete(review, review.expectedReview, review.sourceFingerprint);
        return { template, source, reviewed };
      } catch (error) {
        return { template, source, reviewed: false, error: error instanceof Error ? error.message : 'This source cannot be compared right now.' };
      }
    })).then((items) => { if (!controller.signal.aborted) setResult({ inputs, items }); });
    return () => controller.abort();
  }, [inputs, owned, templates, setId]);
  const checking = result?.inputs !== inputs;
  const items = checking ? [] : result.items;
  const unavailable = (set?.updateReviews ?? []).filter((review) => review.outcome === 'deferred' && !items.some((item) => (
    item.template.id === review.templateId && item.source.templateLineageId === review.sourceLineageId && item.source.templateRevisionId === review.sourceRevisionId
  )));
  return { set, cards, items, unavailable, checking, pending: items.filter((item) => !item.reviewed).length + unavailable.length, refresh: () => setRefresh((value) => value + 1) };
}
