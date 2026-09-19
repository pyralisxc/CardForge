"use client";

import {
  mapProjectDocumentIdentity,
  type ProjectDocumentIdentityMap,
  type ProjectDocumentV1,
} from '@/features/project/client/workspace';

import {
  createCollaborationAuthoredDocument,
  type CollaborationAuthoredDocument,
} from '../yjsAuthoredDocument';

const toProjectDocument = (authored: CollaborationAuthoredDocument): ProjectDocumentV1 => ({
  version: 1,
  userTemplates: structuredClone(authored.templates),
  cardSets: [structuredClone(authored.set)],
  activeCardSetId: authored.set.id,
  storedCards: structuredClone(authored.cards),
  appearanceStyles: [],
  exportSettings: {},
  customAssets: {
    'cardforge-maker-custom-textures': [],
    'cardforge-maker-custom-dividers': [],
    'cardforge-maker-custom-icons': [],
    'cardforge-maker-custom-images': [],
  },
});

export const mapCollaborationAuthoredDocumentIdentity = (
  authored: CollaborationAuthoredDocument,
  identities: ProjectDocumentIdentityMap,
  direction: 'open' | 'save',
): CollaborationAuthoredDocument => (
  createCollaborationAuthoredDocument(
    mapProjectDocumentIdentity(toProjectDocument(authored), identities, direction),
  )
);
