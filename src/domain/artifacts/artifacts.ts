import type { StoredDisplayCard } from '@/domain/cards';

import type { ArtifactMetadata, AuthoredArtifact, CardArtifact } from './types';

export const createCardArtifact = (card: StoredDisplayCard): CardArtifact => ({
  artifactId: card.uniqueId,
  artifactType: 'card',
  setId: card.setId ?? '',
  card,
});

export const getCardFromArtifact = (artifact: AuthoredArtifact): StoredDisplayCard => artifact.card;

export const groupArtifactsBySet = <TArtifact extends ArtifactMetadata>(
  artifacts: readonly TArtifact[],
): ReadonlyMap<string, TArtifact[]> => {
  const grouped = new Map<string, TArtifact[]>();
  for (const artifact of artifacts) {
    const members = grouped.get(artifact.setId);
    if (members) members.push(artifact);
    else grouped.set(artifact.setId, [artifact]);
  }
  return grouped;
};
