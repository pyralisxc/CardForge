import type { CardSet, SetUpdateReview } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import { createTemplateUpdateComparison, isTemplateUpdateReviewComplete, isTemplateUpdateSource } from '../model/templateUpdateReview';
import { getCardSetTemplateIds, type SetTemplateState } from '../model/setTemplateOwnership';
import { updateNoticeKey } from '../model/updateNotices';
import { fingerprintTemplateUpdateSource } from './setTemplateUpdateReview';

export interface WorkspaceTemplateUpdate {
  key: string;
  setId: string;
  template: TCGCardTemplate;
  source: TCGCardTemplate;
  origin: 'workspace' | 'published';
  reviewed: boolean;
  error?: string;
}

export interface SetUpdateProjection {
  set: CardSet;
  items: WorkspaceTemplateUpdate[];
  unavailable: Array<{ key: string; review: SetUpdateReview }>;
  pending: number;
}

const sourceKey = (source: TCGCardTemplate) => JSON.stringify([source.templateLineageId, source.templateRevisionId]);

export const inspectWorkspaceUpdates = async (state: SetTemplateState, published: TCGCardTemplate[], signal?: AbortSignal): Promise<SetUpdateProjection[]> => {
  const sources = new Map<string, { source: TCGCardTemplate; origin: WorkspaceTemplateUpdate['origin'] }>();
  for (const source of state.userTemplates) if (source.id && source.templateLineageId && source.templateRevisionId) sources.set(sourceKey(source), { source, origin: 'workspace' });
  for (const source of published) if (source.id && source.templateLineageId && source.templateRevisionId) sources.set(sourceKey(source), { source, origin: 'published' });
  const fingerprints = new Map<TCGCardTemplate, Promise<string>>();
  const fingerprint = (source: TCGCardTemplate, snapshot: TCGCardTemplate) => {
    if (!fingerprints.has(source)) fingerprints.set(source, fingerprintTemplateUpdateSource(snapshot));
    return fingerprints.get(source)!;
  };
  return Promise.all(state.cardSets.map(async (set) => {
    const owned = new Set(getCardSetTemplateIds(state, set.id));
    const candidates = state.userTemplates.filter((template) => template.id && owned.has(template.id)).flatMap((template) => (
      [...sources.values()].filter(({ source }) => isTemplateUpdateSource(template, source)).map((candidate) => ({ template, ...candidate }))
    ));
    const items = await Promise.all(candidates.map(async ({ template, source, origin }): Promise<WorkspaceTemplateUpdate> => {
      signal?.throwIfAborted();
      const base = { setId: set.id, template, source, origin };
      const keyFor = (hash: string) => updateNoticeKey(set.id, template.id!, source.templateLineageId!, source.templateRevisionId!, hash);
      try {
        const comparison = createTemplateUpdateComparison(state, set.id, template.id!, source);
        const hash = await fingerprint(source, comparison.incoming);
        signal?.throwIfAborted();
        const record = set.updateReviews?.find((review) => review.templateId === template.id && review.sourceLineageId === source.templateLineageId && review.sourceRevisionId === source.templateRevisionId);
        return { ...base, key: keyFor(hash), reviewed: (comparison.changes.length === 0 && record?.outcome !== 'deferred') || isTemplateUpdateReviewComplete(comparison, record, hash) };
      } catch (error) {
        signal?.throwIfAborted();
        return { ...base, key: keyFor(await fingerprintTemplateUpdateSource(source)), reviewed: false, error: error instanceof Error ? error.message : 'This source cannot be compared right now.' };
      }
    }));
    const unavailable = (set.updateReviews ?? []).filter((review) => review.outcome === 'deferred' && !items.some((item) => (
      item.template.id === review.templateId && item.source.templateLineageId === review.sourceLineageId && item.source.templateRevisionId === review.sourceRevisionId
    ))).map((review) => ({ review, key: updateNoticeKey(set.id, review.templateId, review.sourceLineageId, review.sourceRevisionId, review.sourceFingerprint) }));
    return { set, items, unavailable, pending: items.filter((item) => !item.reviewed).length + unavailable.length };
  }));
};
