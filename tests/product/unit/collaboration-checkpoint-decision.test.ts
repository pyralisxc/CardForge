import { describe, expect, it } from 'vitest';

import { decideCollaborationCheckpoint } from '@/features/collaboration/checkpointDecision';
import type { CollaborationAuthoredDocument } from '@/features/collaboration/yjsAuthoredDocument';

const authored = (title: string): CollaborationAuthoredDocument => ({
  version: 1,
  set: { id: 'set-1', name: 'Shared Set', templateIds: ['template-1'] },
  cards: [{
    uniqueId: 'card-1',
    templateId: 'template-1',
    setId: 'set-1',
    setName: 'Shared Set',
    data: { title },
  }],
  templates: [{
    id: 'template-1',
    name: 'Template',
    aspectRatio: '2.5/3.5',
    templateSource: 'user',
  }],
});

const recorded = { providerRevision: 'drive-a', projectRevision: 'project-a' };

describe('collaboration Drive checkpoint decision', () => {
  it('does nothing when Drive and room are already current', () => {
    expect(decideCollaborationCheckpoint({
      recorded,
      current: recorded,
      source: authored('same'),
      room: authored('same'),
    })).toBe('already-current');
  });

  it('writes the room when the recorded Drive revision is current but authored state changed', () => {
    expect(decideCollaborationCheckpoint({
      recorded,
      current: recorded,
      source: authored('source'),
      room: authored('room'),
    })).toBe('write-room-state');
  });

  it('adopts a newer provider receipt when Drive already contains the exact room state', () => {
    expect(decideCollaborationCheckpoint({
      recorded,
      current: { providerRevision: 'drive-b', projectRevision: 'project-b' },
      source: authored('same'),
      room: authored('same'),
    })).toBe('adopt-provider-receipt');
  });

  it('stops on a newer external Drive revision with different authored content', () => {
    expect(decideCollaborationCheckpoint({
      recorded,
      current: { providerRevision: 'drive-b', projectRevision: 'project-b' },
      source: authored('external'),
      room: authored('room'),
    })).toBe('external-conflict');
  });
});
