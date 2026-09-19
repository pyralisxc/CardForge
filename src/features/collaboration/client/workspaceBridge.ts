"use client";

import type * as Y from 'yjs';

import { ensureCardSetTemplateReferences, normalizeCardTagIds, type StoredDisplayCard } from '@/domain/cards';
import { reconstructMinimalTemplateObject, type TCGCardTemplate } from '@/domain/templates';
import {
  selectAllTemplates,
  useProjectStore,
  type ProjectState,
} from '@/features/project/client/workspace';

import type { CollaborationAuthoredDocument } from '../yjsAuthoredDocument';
import {
  applyCollaborationUpdate,
  readCollaborationAuthoredDocument,
  syncCollaborationAuthoredDocument,
} from '../yjsAuthoredDocument';

const LOCAL_ORIGIN = Symbol('cardforge-collaboration-local');
const REMOTE_ORIGIN = Symbol('cardforge-collaboration-remote');

const isCardInSet = (
  card: StoredDisplayCard,
  setId: string,
  firstSetId: string | undefined,
) => card.setId === setId || (!card.setId && firstSetId === setId);

const templateFingerprint = (template: TCGCardTemplate) => JSON.stringify(template);

export const captureCollaborationAuthoredDocumentFromState = (
  state: ProjectState,
  setId: string,
): CollaborationAuthoredDocument => {
  const set = state.cardSets.find((candidate) => candidate.id === setId);
  if (!set) throw new Error('The collaborative Set is no longer available in this browser workspace.');
  const firstSetId = state.cardSets[0]?.id;
  const cards = state.storedCards
    .filter((card) => isCardInSet(card, setId, firstSetId))
    .map((card) => ({
      ...structuredClone(card),
      setId,
      setName: set.name,
    }));
  const templateIds = new Set([
    ...(set.templateIds ?? []),
    ...cards.flatMap((card) => [card.templateId, card.backingTemplateId]),
  ].filter((id): id is string => Boolean(id)));
  const templates = selectAllTemplates(state)
    .filter((template) => Boolean(template.id && templateIds.has(template.id)))
    .map((template) => structuredClone(template));
  return {
    version: 1,
    set: structuredClone(set),
    cards,
    templates,
  };
};

export interface CollaborationWorkspacePatch {
  cardSets: ProjectState['cardSets'];
  activeCardSet: ProjectState['activeCardSet'];
  storedCards: ProjectState['storedCards'];
  userTemplates: ProjectState['userTemplates'];
}

export const buildCollaborationWorkspacePatch = (
  current: ProjectState,
  authored: CollaborationAuthoredDocument,
): CollaborationWorkspacePatch => {
  const setId = authored.set.id;
  if (!setId || authored.cards.some((card) => card.setId && card.setId !== setId)) {
    throw new Error('Live collaboration attempted to cross a CardForge Set boundary.');
  }

  const cards = authored.cards.map((card) => ({
    ...structuredClone(card),
    setId,
    setName: authored.set.name,
    ...(normalizeCardTagIds(card.tagIds).length ? { tagIds: normalizeCardTagIds(card.tagIds) } : { tagIds: undefined }),
  }));
  const normalizedSet = ensureCardSetTemplateReferences({
    cardSets: [structuredClone(authored.set)],
    storedCards: cards,
  })[0];
  if (!normalizedSet) throw new Error('Live collaboration did not contain its CardForge Set.');

  const currentTemplates = selectAllTemplates(current);
  const userTemplates = [...current.userTemplates];
  authored.templates.forEach((incoming) => {
    if (!incoming.id?.trim()) throw new Error('Live collaboration contains a Template without stable identity.');
    const currentTemplate = currentTemplates.find((template) => template.id === incoming.id);
    if (currentTemplate && templateFingerprint(currentTemplate) === templateFingerprint(incoming)) return;
    const normalized = reconstructMinimalTemplateObject({
      ...structuredClone(incoming),
      templateSource: 'user',
    });
    const index = userTemplates.findIndex((template) => template.id === normalized.id);
    if (index >= 0) userTemplates[index] = normalized;
    else userTemplates.push(normalized);
  });

  const availableTemplateIds = new Set([
    ...current.defaultTemplates.map((template) => template.id),
    ...userTemplates.map((template) => template.id),
  ].filter((id): id is string => Boolean(id)));
  const missingReference = cards.find((card) => (
    !availableTemplateIds.has(card.templateId)
    || Boolean(card.backingTemplateId && !availableTemplateIds.has(card.backingTemplateId))
  ));
  if (missingReference) {
    throw new Error('Live collaboration references a Template that is not available in this Set snapshot.');
  }

  const firstSetId = current.cardSets[0]?.id;
  const storedCards = [
    ...current.storedCards.filter((card) => !isCardInSet(card, setId, firstSetId)),
    ...cards,
  ];
  const existingIndex = current.cardSets.findIndex((set) => set.id === setId);
  const cardSets = [...current.cardSets];
  if (existingIndex >= 0) cardSets[existingIndex] = normalizedSet;
  else cardSets.push(normalizedSet);

  return {
    userTemplates,
    storedCards,
    cardSets,
    activeCardSet: current.activeCardSet?.id === setId
      ? normalizedSet
      : current.activeCardSet,
  };
};

export const applyCollaborationAuthoredDocumentToWorkspace = (
  authored: CollaborationAuthoredDocument,
) => {
  useProjectStore.setState((current) => buildCollaborationWorkspacePatch(current, authored));
};

export interface CollaborationWorkspaceBridge {
  applyRemoteUpdate: (update: Uint8Array) => void;
  syncFromWorkspace: () => void;
  destroy: () => void;
}

export const createCollaborationWorkspaceBridge = ({
  document,
  setId,
  onLocalUpdate,
  toSharedIdentity = (authored) => authored,
  fromSharedIdentity = (authored) => authored,
}: {
  document: Y.Doc;
  setId: string;
  onLocalUpdate: (update: Uint8Array) => void | Promise<void>;
  toSharedIdentity?: (authored: CollaborationAuthoredDocument) => CollaborationAuthoredDocument;
  fromSharedIdentity?: (authored: CollaborationAuthoredDocument) => CollaborationAuthoredDocument;
}): CollaborationWorkspaceBridge => {
  let destroyed = false;
  let applyingRemote = false;
  let lastFingerprint = '';

  const captureLocal = () => captureCollaborationAuthoredDocumentFromState(useProjectStore.getState(), setId);
  const captureShared = () => toSharedIdentity(captureLocal());

  const syncFromWorkspace = () => {
    if (destroyed || applyingRemote) return;
    const local = captureLocal();
    const authored = toSharedIdentity(local);
    const fingerprint = JSON.stringify(authored);
    if (fingerprint === lastFingerprint) return;
    syncCollaborationAuthoredDocument(document, authored, LOCAL_ORIGIN);

    // Yjs may have merged remote text/entity changes with this local edit.
    // Project that canonical merged state back into the native workspace now,
    // rather than leaving the UI behind the room until another remote event.
    const mergedShared = readCollaborationAuthoredDocument(document);
    const mergedLocal = fromSharedIdentity(mergedShared);
    lastFingerprint = JSON.stringify(mergedShared);
    if (JSON.stringify(mergedLocal) !== JSON.stringify(local)) {
      applyingRemote = true;
      try {
        applyCollaborationAuthoredDocumentToWorkspace(mergedLocal);
      } finally {
        applyingRemote = false;
      }
    }
  };

  const handleDocumentUpdate = (update: Uint8Array, origin: unknown) => {
    if (destroyed) return;
    if (origin === REMOTE_ORIGIN) {
      applyingRemote = true;
      try {
        const shared = readCollaborationAuthoredDocument(document);
        const authored = fromSharedIdentity(shared);
        applyCollaborationAuthoredDocumentToWorkspace(authored);
        lastFingerprint = JSON.stringify(shared);
      } finally {
        applyingRemote = false;
      }
      return;
    }
    if (origin === LOCAL_ORIGIN) void onLocalUpdate(update.slice());
  };

  document.on('update', handleDocumentUpdate);
  const unsubscribe = useProjectStore.subscribe(() => syncFromWorkspace());
  lastFingerprint = JSON.stringify(captureShared());
  syncFromWorkspace();

  return {
    syncFromWorkspace,
    applyRemoteUpdate: (update) => {
      if (destroyed) return;
      applyCollaborationUpdate(document, update, REMOTE_ORIGIN);
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      document.off('update', handleDocumentUpdate);
    },
  };
};
