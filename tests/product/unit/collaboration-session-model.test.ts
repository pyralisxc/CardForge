import { describe, expect, it } from 'vitest';

import {
  getCollaborationRole,
  getCollaborationTopic,
  hasCollaborationCheckpointConflict,
} from '@/features/collaboration/server';

describe('collaboration session model', () => {
  it('requires download permission and preserves native Drive edit capability', () => {
    expect(getCollaborationRole({ canDownload: false, canEdit: true, canModifyContent: true })).toBeNull();
    expect(getCollaborationRole({ canDownload: true, canEdit: false, canModifyContent: false })).toBe('viewer');
    expect(getCollaborationRole({ canDownload: true, canEdit: true, canModifyContent: true })).toBe('editor');
    expect(getCollaborationRole({ canDownload: true, canEdit: true, canModifyContent: false })).toBe('viewer');
  });

  it('treats either provider or package revision drift as an external checkpoint conflict', () => {
    const checkpoint = { providerRevision: 'head:a', projectRevision: 'sha-a' };
    expect(hasCollaborationCheckpointConflict(checkpoint, checkpoint)).toBe(false);
    expect(hasCollaborationCheckpointConflict(checkpoint, { ...checkpoint, providerRevision: 'head:b' })).toBe(true);
    expect(hasCollaborationCheckpointConflict(checkpoint, { ...checkpoint, projectRevision: 'sha-b' })).toBe(true);
  });

  it('uses a private room topic derived only from the server-created session id', () => {
    expect(getCollaborationTopic('123e4567-e89b-12d3-a456-426614174000'))
      .toBe('cardforge-collaboration:123e4567-e89b-12d3-a456-426614174000');
  });
});
