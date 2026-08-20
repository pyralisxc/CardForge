import type { DisplayCard } from '@/domain/rendering';
import type { TCGCardTemplate } from '@/domain/templates';
import type { ProjectState } from './types';

export const selectAllTemplates = (
  state: Pick<ProjectState, 'defaultTemplates' | 'userTemplates'>,
): TCGCardTemplate[] => {
  const templates: TCGCardTemplate[] = [];
  const positionById = new Map<string, number>();

  [...state.defaultTemplates, ...state.userTemplates].forEach((template) => {
    const id = template.id?.trim();
    if (!id) {
      templates.push(template);
      return;
    }

    const existingPosition = positionById.get(id);
    if (existingPosition === undefined) {
      positionById.set(id, templates.length);
      templates.push(template);
      return;
    }

    templates[existingPosition] = template;
  });

  return templates;
};

export const resolveGeneratorFrontTemplateId = (
  templates: readonly TCGCardTemplate[],
  selectedTemplateId: string | null,
): string | null => (
  templates.some((template) => (
    template.id === selectedTemplateId
    && template.templateUsage !== 'back-preset'
  ))
    ? selectedTemplateId
    : (templates.find((template) => template.templateUsage !== 'back-preset')?.id ?? null)
);

export const selectAllGeneratedDisplayCards = (state: ProjectState): DisplayCard[] => {
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
        backingData: storedCard.backingData,
        setId: storedCard.setId,
        setName: storedCard.setName,
        data: storedCard.data,
      });
    }
    return acc;
  }, []);
};

export const selectGeneratedDisplayCards = (state: ProjectState): DisplayCard[] => {
  const activeSetId = state.activeCardSet?.id;
  return selectAllGeneratedDisplayCards(state).filter((card) => (
    !activeSetId || !card.setId || card.setId === activeSetId
  ));
};

export const selectEditingCard = (state: ProjectState): DisplayCard | null => {
  if (!state.editingCardUniqueId || !state.isEditDialogOpen) return null;

  const allDisplayCards = selectAllGeneratedDisplayCards(state);
  return allDisplayCards.find((card) => card.uniqueId === state.editingCardUniqueId) || null;
};
