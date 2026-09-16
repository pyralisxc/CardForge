import { describe, expect, it } from 'vitest';

import { ApiClientError } from '@/infrastructure/http/clientResponses';
import {
  shouldPauseGoogleDriveAutosaveAfterRevalidation,
  shouldPauseGoogleDriveAutosaveForError,
  shouldOfferGoogleDriveReconciliation,
} from '@/features/project/client/googleDriveWorkingSession';
import { GoogleDriveSaveLinkageError } from '@/features/project/client/googleDriveProjectTransfer';

const driveError = (kind: ConstructorParameters<typeof ApiClientError>[3]) => new ApiClientError(
  'Drive request failed.',
  409,
  `google_drive_${kind}`,
  kind,
  false,
  null,
);

describe('Google Drive working-session safety', () => {
  it.each([
    ['unlinked', false, false],
    ['current', false, false],
    ['current', true, false],
    ['changed', false, false],
    ['changed', true, true],
    ['missing', false, true],
    ['missing', true, true],
  ] as const)('pauses automatic saves only for revalidation states that require recovery: %s / dirty=%s', (kind, dirty, expected) => {
    expect(shouldPauseGoogleDriveAutosaveAfterRevalidation(kind, dirty)).toBe(expected);
  });

  it.each([
    ['conflict', true],
    ['authorization', true],
    ['authentication', true],
    ['not_found', true],
    ['unavailable', false],
    ['limit', false],
    ['invalid', false],
  ] as const)('does not automatically retry an error that needs explicit creator recovery: %s', (kind, expected) => {
    expect(shouldPauseGoogleDriveAutosaveForError(driveError(kind))).toBe(expected);
  });

  it('does not pause unknown local errors as if Drive state were authoritative', () => {
    expect(shouldPauseGoogleDriveAutosaveForError(new Error('local render failure'))).toBe(false);
  });

  it('never replays a Drive save whose provider receipt was confirmed but whose local link failed', () => {
    const error = new GoogleDriveSaveLinkageError({
      fileId: 'drive_file_12345',
      name: 'Confirmed Set.cardforge',
      providerRevision: 'head:abc',
      projectRevision: 'a'.repeat(64),
      lastSavedAt: '2026-09-16T00:00:00.000Z',
      webViewLink: null,
      workId: 'set-1',
    }, new Error('IndexedDB unavailable'));

    expect(shouldPauseGoogleDriveAutosaveForError(error)).toBe(true);
  });

  it.each([
    ['remote-changed', true],
    ['read-only', true],
    ['error', true],
    ['offline', false],
    ['recovery-required', false],
    ['clean', false],
  ] as const)('keeps a visible recheck path for recoverable Drive states: %s', (phase, expected) => {
    expect(shouldOfferGoogleDriveReconciliation(phase)).toBe(expected);
  });
});
