import {
  getStudioDocument,
  getStudioDocumentAssetDownloads,
  readStudioDocumentPreviewToken,
  StudioDocumentStoreError,
} from '@/features/studio-documents/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

const parseRequestedCardIds = (value: string | null): string[] | null => {
  if (!value) return null;
  const ids = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (ids.length === 0 || ids.length > 12 || ids.some((id) => id.length > 255) || new Set(ids).size !== ids.length) return [];
  return ids;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  const setId = url.searchParams.get('setId')?.trim() ?? '';
  const requestedCardIds = parseRequestedCardIds(url.searchParams.get('cardIds'));
  const payload = readStudioDocumentPreviewToken(token);
  if (!payload || !setId || requestedCardIds?.length === 0) {
    return createApiErrorResponse(
      404,
      'studio_document_not_found',
      'This CardForge Set preview link has expired or is invalid. Return to ChatGPT and ask CardForge to render the latest Set preview again.',
    );
  }

  try {
    const document = await getStudioDocument(payload.ownerUserId, payload.documentId);
    if (document.revision !== payload.revision || document.creationSource !== 'gpt') {
      return createApiErrorResponse(409, 'studio_document_conflict', 'This Set has a newer agent revision. Ask CardForge to render the latest Set preview.');
    }
    const set = document.document.cardSets.find((candidate) => candidate.id === setId);
    if (!set) {
      return createApiErrorResponse(404, 'studio_document_not_found', 'This Set is no longer part of the current agent working revision.');
    }
    const setCards = document.document.storedCards.filter((card) => card.setId === set.id);
    const cardsById = new Map(setCards.map((card) => [card.uniqueId, card]));
    const cards = requestedCardIds
      ? requestedCardIds.map((cardId) => cardsById.get(cardId)).filter((card): card is typeof setCards[number] => Boolean(card))
      : setCards;
    if (requestedCardIds && cards.length !== requestedCardIds.length) {
      return createApiErrorResponse(404, 'studio_document_not_found', 'One or more requested stable card ids are no longer part of this Set.');
    }
    const requiredTemplateIds = new Set<string>();
    if (set.frontTemplateId) requiredTemplateIds.add(set.frontTemplateId);
    if (set.backingTemplateId) requiredTemplateIds.add(set.backingTemplateId);
    cards.forEach((card) => {
      if (card.templateId) requiredTemplateIds.add(card.templateId);
      if (card.backingTemplateId) requiredTemplateIds.add(card.backingTemplateId);
    });
    const templates = document.document.userTemplates.filter((template) => template.id && requiredTemplateIds.has(template.id));
    const customFonts = document.document.customFonts ?? [];
    const previewValue = { cards, templates, customFonts };
    const assets = await getStudioDocumentAssetDownloads({
      ownerUserId: payload.ownerUserId,
      documentId: payload.documentId,
      value: previewValue,
    });
    return createNoStoreJsonResponse({
      title: document.title,
      revision: document.revision,
      set,
      cards,
      templates,
      customFonts,
      assets,
    });
  } catch (error) {
    if (error instanceof StudioDocumentStoreError) {
      return createApiErrorResponse(
        error.status === 404 ? 404 : 503,
        error.status === 404 ? 'studio_document_not_found' : 'studio_document_unavailable',
        error.status === 404
          ? 'This CardForge Set preview is no longer available. Return to ChatGPT and render a fresh preview if the agent working document still exists.'
          : error.message,
      );
    }
    console.error('Unable to render Studio Set preview:', error);
    return createApiErrorResponse(500, 'studio_document_unavailable', 'Unable to render the CardForge Set preview.');
  }
}
