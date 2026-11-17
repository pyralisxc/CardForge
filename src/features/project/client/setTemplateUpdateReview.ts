import type { SetUpdateDecision } from '@/domain/cards/setUpdateReview';
import { createTemplateUpdateComparison, resolveTemplateUpdateReview, retainSetUpdateReview, templateUpdateContentText, type TemplateUpdateComparison } from '../model/templateUpdateReview';
import { getProjectPersistenceScope } from '../persistence/projectPersistenceScope';
import { selectAllTemplates } from '../store/selectors';
import { createProjectWorkspaceDraft, useProjectStore } from '../store/workspaceStore';

export interface OpenTemplateUpdateReview extends TemplateUpdateComparison {
  persistenceScope: ReturnType<typeof getProjectPersistenceScope>;
}

export const openSetTemplateUpdateReview = (setId: string, templateId: string, sourceTemplateId: string): OpenTemplateUpdateReview => {
  const state = useProjectStore.getState();
  const source = selectAllTemplates(state).find((template) => template.id === sourceTemplateId);
  if (!source) throw new Error('The source snapshot is unavailable. Nothing was changed.');
  return { ...createTemplateUpdateComparison(state, setId, templateId, source), persistenceScope: getProjectPersistenceScope() };
};

export const commitSetTemplateUpdateReview = async (
  comparison: OpenTemplateUpdateReview,
  choices: Readonly<Record<string, SetUpdateDecision>>,
  signal?: AbortSignal,
) => {
  signal?.throwIfAborted();
  const state = useProjectStore.getState();
  if (comparison.persistenceScope !== getProjectPersistenceScope()) throw new Error('The active account changed. Reopen the review; nothing was applied.');
  const source = selectAllTemplates(state).find((template) => template.id === comparison.incoming.id);
  if (!source) throw new Error('The source snapshot is unavailable. Nothing was changed.');
  const bytes = new TextEncoder().encode(templateUpdateContentText(source));
  const sourceFingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  signal?.throwIfAborted();
  const resolved = resolveTemplateUpdateReview(state, comparison, source, choices, sourceFingerprint);
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
