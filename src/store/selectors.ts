import type { AppState } from '@/store/appStore';
import type { DisplayCard } from '@/domain/rendering';

export const selectAllTemplates = (state: Pick<AppState, 'defaultTemplates' | 'userTemplates'>) => [
  ...state.defaultTemplates,
  ...state.userTemplates,
];

export const selectGeneratedDisplayCards = (state: AppState): DisplayCard[] => {
  const templates = selectAllTemplates(state);
  return state.storedCards.reduce((acc: DisplayCard[], storedCard) => {
    const template = templates.find((candidate) => candidate.id === storedCard.templateId);
    if (template) {
      const backingTemplate = storedCard.backingTemplateId
        ? templates.find((candidate) => candidate.id === storedCard.backingTemplateId && candidate.templateUsage === 'back-preset')
        : null;
      acc.push({
        uniqueId: storedCard.uniqueId,
        template,
        backingTemplateId: storedCard.backingTemplateId ?? null,
        backingTemplate,
        setId: storedCard.setId,
        setName: storedCard.setName,
        data: storedCard.data,
      });
    }
    return acc;
  }, []);
};

export const selectEditingCard = (state: AppState): DisplayCard | null => {
  if (!state.editingCardUniqueId || !state.isEditDialogOpen) return null;

  const allDisplayCards = selectGeneratedDisplayCards(state);
  return allDisplayCards.find((card) => card.uniqueId === state.editingCardUniqueId) || null;
};
