import { describe, expect, it } from 'vitest';

import {
  createCardArtifact,
  getCardFromArtifact,
  groupArtifactsBySet,
  type ArtifactMetadata,
  type AuthoredArtifact,
} from '@/domain/artifacts';
import type { StoredDisplayCard } from '@/domain/cards';

const card: StoredDisplayCard = {
  uniqueId: 'card-1',
  templateId: 'template-1',
  setId: 'set-1',
  data: { title: 'First card' },
};

describe('authored Artifact contract', () => {
  it('specializes cards without introducing a second identity', () => {
    const artifact = createCardArtifact(card);

    expect(artifact).toMatchObject({
      artifactId: 'card-1',
      artifactType: 'card',
      setId: 'set-1',
    });
    expect(getCardFromArtifact(artifact)).toBe(card);
  });

  it('projects Set membership from the generic Artifact relation', () => {
    const artifacts: AuthoredArtifact[] = [
      createCardArtifact(card),
      createCardArtifact({ ...card, uniqueId: 'card-2', setId: 'set-2' }),
      createCardArtifact({ ...card, uniqueId: 'card-3', setId: 'set-1' }),
    ];

    expect(groupArtifactsBySet(artifacts).get('set-1')?.map((artifact) => artifact.artifactId))
      .toEqual(['card-1', 'card-3']);
  });

  it('describes heterogeneous Artifact metadata without exposing another creatable type', () => {
    const metadata: ArtifactMetadata[] = [
      createCardArtifact(card),
      { artifactId: 'future-token-1', artifactType: 'token', setId: 'set-1' },
      { artifactId: 'future-board-1', artifactType: 'board', setId: 'set-2' },
    ];

    expect(groupArtifactsBySet(metadata).get('set-1')).toEqual([
      expect.objectContaining({ artifactId: 'card-1', artifactType: 'card' }),
      expect.objectContaining({ artifactId: 'future-token-1', artifactType: 'token' }),
    ]);
    expect(groupArtifactsBySet(metadata).get('set-2')?.[0]?.artifactType).toBe('board');
  });
});
