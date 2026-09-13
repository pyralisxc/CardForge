import type { CardSet } from '@/domain/cards';
import { extractTemplateFieldDefinitions, materializeTemplateFieldBindings, type TCGCardTemplate } from '@/domain/templates';
import { requireAccountToolCapability, type AccountToolAccess } from '@/features/account/server';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import { getStudioDocumentRetentionHours } from './studioDocumentAccess';
import { getStudioDocument } from './studioDocumentStore';

const requireSet = (sets: CardSet[], setId: string): CardSet => {
  const set = sets.find((candidate) => candidate.id === setId);
  if (!set) {
    throw new StudioDocumentStoreError(
      'That card set is not part of the current working design. Reload preview_card_set and retry with the current set id.',
      404,
    );
  }
  return set;
};

export const getWorkingCardSetSnapshot = async ({
  access,
  documentId,
  setId,
}: {
  access: AccountToolAccess;
  documentId: string;
  setId: string;
}) => {
  requireAccountToolCapability(access, 'studio.ai.create');
  const document = await getStudioDocument(
    access.user.id,
    documentId,
    await getStudioDocumentRetentionHours(access.entitlement),
  );
  const set = requireSet(document.document.cardSets, setId);
  const templates = document.document.userTemplates.map(materializeTemplateFieldBindings);
  const cards = document.document.storedCards.filter((card) => card.setId === set.id);
  return { document, set, templates, cards };
};

export const getTemplateImageFields = (template: TCGCardTemplate | null | undefined) => (
  template
    ? extractTemplateFieldDefinitions(template).filter((field) => !field.isStaticBaseText && field.isImage)
    : []
);