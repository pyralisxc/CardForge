import type { CardSet } from '@/domain/cards';
import {
  composeCanonicalContactSheet,
  createStudioRenderArtifactDescriptor,
  readRenderArtifact,
  renderCanonicalBrowserImages,
  type RenderArtifact,
  writeRenderArtifact,
} from '@/features/render-artifacts/server';
import type { StudioDocument } from '@/features/studio-documents/model';
import { consumeRateLimit } from '@/infrastructure/security/abuseProtection';

import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import { createStudioDocumentPreviewToken } from './studioDocumentPreviewToken';

export const MAX_CANONICAL_SET_PREVIEW_CARDS = 12;
const PREVIEW_PROFILE = 'virtual-150';
const CONTACT_SHEET_PROFILE = 'virtual-150-contact-sheet-3col';

const consumeUncachedRenderBudget = async (ownerUserId: string) => {
  const result = await consumeRateLimit({
    action: 'studio-ai-render',
    identity: ownerUserId,
    limit: 60,
    windowSeconds: 3600,
  });
  if (!result.allowed) {
    throw new StudioDocumentStoreError(
      'Too many uncached CardForge renders were requested. Reuse the current revision or try again later.',
      429,
    );
  }
};

const previewToken = (document: StudioDocument, ownerUserId: string) => createStudioDocumentPreviewToken({
  documentId: document.id,
  ownerUserId,
  revision: document.revision,
});

export const ensureTemplatePreviewArtifact = async ({
  ownerUserId,
  document,
  publicOrigin,
}: {
  ownerUserId: string;
  document: StudioDocument;
  publicOrigin: string;
}): Promise<RenderArtifact> => {
  const template = document.document.userTemplates[0];
  if (!template?.id) throw new StudioDocumentStoreError('This working document does not contain a renderable Template.', 409);
  const descriptor = createStudioRenderArtifactDescriptor({
    sourceId: document.id,
    sourceRevision: document.revision,
    kind: 'template-preview',
    subjectId: template.id,
    face: 'front',
    profile: PREVIEW_PROFILE,
  });
  const cached = await readRenderArtifact({ ownerUserId, descriptor });
  if (cached) return cached;
  await consumeUncachedRenderBudget(ownerUserId);
  const token = previewToken(document, ownerUserId);
  const images = await renderCanonicalBrowserImages({
    publicOrigin,
    renderUrl: `${publicOrigin}/mcp-template-preview?token=${encodeURIComponent(token)}&revision=${document.revision}`,
    selector: 'img[data-cardforge-render-artifact="template-preview"]',
    expectedCount: 1,
  });
  const rendered = images[0];
  if (!rendered) throw new StudioDocumentStoreError('CardForge did not produce the canonical Template preview.', 500);
  return writeRenderArtifact({ ownerUserId, descriptor, bytes: rendered.bytes });
};

const getSet = (document: StudioDocument, setId: string): CardSet => {
  const set = document.document.cardSets.find((candidate) => candidate.id === setId);
  if (!set) throw new StudioDocumentStoreError('That Set is not part of this working document.', 404);
  return set;
};

export const ensureSetContactSheetArtifact = async ({
  ownerUserId,
  document,
  setId,
  publicOrigin,
}: {
  ownerUserId: string;
  document: StudioDocument;
  setId: string;
  publicOrigin: string;
}): Promise<{ artifact: RenderArtifact | null; previewSampleCount: number }> => {
  const set = getSet(document, setId);
  const cards = document.document.storedCards.filter((card) => card.setId === set.id).slice(0, MAX_CANONICAL_SET_PREVIEW_CARDS);
  if (cards.length === 0) return { artifact: null, previewSampleCount: 0 };
  const contactDescriptor = createStudioRenderArtifactDescriptor({
    sourceId: document.id,
    sourceRevision: document.revision,
    kind: 'set-contact-sheet',
    subjectId: set.id,
    face: 'front',
    profile: CONTACT_SHEET_PROFILE,
  });
  const cachedContact = await readRenderArtifact({ ownerUserId, descriptor: contactDescriptor });
  if (cachedContact) return { artifact: cachedContact, previewSampleCount: cards.length };
  const cardDescriptors = cards.map((card) => createStudioRenderArtifactDescriptor({
    sourceId: document.id,
    sourceRevision: document.revision,
    kind: 'card-preview',
    subjectId: card.uniqueId,
    face: 'front',
    profile: PREVIEW_PROFILE,
  }));
  const cardArtifacts = await Promise.all(cardDescriptors.map((descriptor) => readRenderArtifact({ ownerUserId, descriptor })));
  if (cardArtifacts.some((artifact) => artifact === null)) {
    await consumeUncachedRenderBudget(ownerUserId);
    const token = previewToken(document, ownerUserId);
    const renderedImages = await renderCanonicalBrowserImages({
      publicOrigin,
      renderUrl: `${publicOrigin}/mcp-card-set-preview?token=${encodeURIComponent(token)}&setId=${encodeURIComponent(set.id)}&revision=${document.revision}`,
      selector: 'img[data-cardforge-render-artifact="card-preview"]',
      expectedCount: cards.length,
    });
    const renderedById = new Map(renderedImages.map((image) => [image.subjectId, image.bytes]));
    for (let index = 0; index < cards.length; index += 1) {
      if (cardArtifacts[index]) continue;
      const card = cards[index]!;
      const bytes = renderedById.get(card.uniqueId);
      if (!bytes) throw new StudioDocumentStoreError(`CardForge did not produce the canonical render for card ${card.uniqueId}.`, 500);
      cardArtifacts[index] = await writeRenderArtifact({ ownerUserId, descriptor: cardDescriptors[index]!, bytes });
    }
  }
  const completeArtifacts = cardArtifacts.filter((artifact): artifact is RenderArtifact => artifact !== null);
  if (completeArtifacts.length !== cards.length) throw new StudioDocumentStoreError('CardForge could not complete the canonical Set render artifacts.', 500);
  const contactBytes = await composeCanonicalContactSheet(completeArtifacts.map((artifact) => artifact.bytes));
  const artifact = await writeRenderArtifact({ ownerUserId, descriptor: contactDescriptor, bytes: contactBytes });
  return { artifact, previewSampleCount: cards.length };
};
