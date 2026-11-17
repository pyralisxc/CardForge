import { authoredPlanValuesEqual } from '@/domain/cards';
import type { SetUpdateDecision, SetUpdateReview } from '@/domain/cards/setUpdateReview';
import { createTemplateUpdateComparison, getTemplateUpdateReviewChoices, resolveTemplateUpdateReview, retainSetUpdateReview, templateUpdateContentText, type TemplateUpdateComparison } from '../model/templateUpdateReview';
import { getProjectPersistenceScope } from '../persistence/projectPersistenceScope';
import { selectAllTemplates } from '../store/selectors';
import { createProjectWorkspaceDraft, useProjectStore } from '../store/workspaceStore';

export interface OpenTemplateUpdateReview extends TemplateUpdateComparison {
  expectedReview: SetUpdateReview | undefined;
  initialChoices: Record<string, SetUpdateDecision>;
  sourceFingerprint: string;
  persistenceScope: ReturnType<typeof getProjectPersistenceScope>;
}

const fingerprintSource = async (comparison: TemplateUpdateComparison): Promise<string> => {
  const bytes = new TextEncoder().encode(templateUpdateContentText(comparison.incoming));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const openSetTemplateUpdateReview = async (setId: string, templateId: string, sourceTemplateId: string, signal?: AbortSignal): Promise<OpenTemplateUpdateReview> => {
  signal?.throwIfAborted();
  const persistenceScope = getProjectPersistenceScope();
  const state = useProjectStore.getState();
  const source = selectAllTemplates(state).find((template) => template.id === sourceTemplateId);
  if (!source) throw new Error('The source snapshot is unavailable. Nothing was changed.');
  const comparison = createTemplateUpdateComparison(state, setId, templateId, source);
  const expectedReview = state.cardSets.find((set) => set.id === setId)?.updateReviews?.find((review) => (
    review.templateId === templateId && review.sourceLineageId === source.templateLineageId
    && review.sourceRevisionId === source.templateRevisionId
  ));
  const sourceFingerprint = await fingerprintSource(comparison);
  signal?.throwIfAborted();
  if (persistenceScope !== getProjectPersistenceScope()) throw new Error('The active account changed. Reopen the review; nothing was applied.');
  return {
    ...comparison,
    expectedReview: expectedReview ? structuredClone(expectedReview) : undefined,
    initialChoices: getTemplateUpdateReviewChoices(comparison, expectedReview, sourceFingerprint),
    sourceFingerprint,
    persistenceScope,
  };
};

export const commitSetTemplateUpdateReview = async (
  comparison: OpenTemplateUpdateReview,
  choices: Readonly<Record<string, SetUpdateDecision>>,
  signal?: AbortSignal,
) => {
  signal?.throwIfAborted();
  const initialState = useProjectStore.getState();
  if (comparison.persistenceScope !== getProjectPersistenceScope()) throw new Error('The active account changed. Reopen the review; nothing was applied.');
  const source = selectAllTemplates(initialState).find((template) => template.id === comparison.incoming.id);
  if (!source) throw new Error('The source snapshot is unavailable. Nothing was changed.');
  const sourceFingerprint = await fingerprintSource(comparison);
  signal?.throwIfAborted();
  if (comparison.persistenceScope !== getProjectPersistenceScope()) throw new Error('The active account changed. Reopen the review; nothing was applied.');
  const state = useProjectStore.getState();
  const currentSource = selectAllTemplates(state).find((template) => template.id === comparison.incoming.id);
  if (!currentSource) throw new Error('The source snapshot is unavailable. Nothing was changed.');
  const currentReview = state.cardSets.find((set) => set.id === comparison.setId)?.updateReviews?.find((review) => (
    review.templateId === comparison.current.id && review.sourceLineageId === comparison.incoming.templateLineageId
    && review.sourceRevisionId === comparison.incoming.templateRevisionId
  ));
  if (!authoredPlanValuesEqual(currentReview, comparison.expectedReview)) {
    throw new Error('The Set Update Review record changed while this comparison was open. Reopen the review; existing work was kept.');
  }
  const resolved = resolveTemplateUpdateReview(state, comparison, currentSource, choices, sourceFingerprint);
  const draft = createProjectWorkspaceDraft(state);
  if (resolved.changesTemplate) draft.getState().commitTemplateChange({
    template: resolved.template, source: 'user', sourceTemplateId: comparison.current.id,
    expectedSourceRevisionId: comparison.current.templateRevisionId ?? null,
    setId: comparison.setId, deferEditorSelectionUntilReceipt: true,
  });
  const next = draft.getState();
  const cardSets = next.cardSets.map((set) => set.id === comparison.setId ? { ...set, updateReviews: retainSetUpdateReview(set, resolved.review) } : set);
  draft.setState({ cardSets, activeCardSet: cardSets.find((set) => set.id === next.activeCardSet?.id) ?? null });
  await draft.commit([], signal);
  return { outcome: resolved.review.outcome, changesTemplate: resolved.changesTemplate };
};
