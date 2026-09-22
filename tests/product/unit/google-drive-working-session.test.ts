import { describe, expect, it } from 'vitest';

import { ApiClientError } from '@/infrastructure/http/clientResponses';
import {
  GOOGLE_DRIVE_SHARED_FILE_REFRESH_INTERVAL_MS,
  shouldApplyGoogleDriveRemoteProbe,
  shouldPauseGoogleDriveAutosaveAfterRevalidation,
  shouldPauseGoogleDriveAutosaveForError,
  shouldOfferGoogleDriveReconciliation,
} from '@/features/project/client/googleDriveWorkingSession';
import { GoogleDriveSaveLinkageError, GoogleDriveUnknownCommitError } from '@/features/project/client/googleDriveProjectTransfer';

const driveError = (kind: ConstructorParameters<typeof ApiClientError>[3], retryable = false) => new ApiClientError(
  'Drive request failed.',
  409,
  `google_drive_${kind}`,
  kind,
  retryable,
  null,
);

describe('Google Drive working-session safety', () => {
  it('uses a bounded shared-file refresh cadence', () => {
    expect(GOOGLE_DRIVE_SHARED_FILE_REFRESH_INTERVAL_MS).toBe(30_000);
  });

  it.each([
    ['current', true, true, false],
    ['current', false, false, false],
    ['current', true, false, true],
    ['current', false, true, true],
    ['changed', true, true, true],
    ['missing', true, true, true],
    ['unlinked', null, true, true],
  ] as const)('applies a remote metadata probe only when provider state or write capability changes: %s', (kind, currentWritable, nextWritable, expected) => {
    expect(shouldApplyGoogleDriveRemoteProbe(kind, currentWritable, nextWritable)).toBe(expected);
  });

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
    ['limit', true],
    ['invalid', false],
  ] as const)('does not automatically retry an error that needs explicit creator recovery: %s', (kind, expected) => {
    expect(shouldPauseGoogleDriveAutosaveForError(driveError(kind))).toBe(expected);
  });

  it('backs off retryable provider unavailability until the metadata reconciliation loop succeeds', () => {
    expect(shouldPauseGoogleDriveAutosaveForError(driveError('unavailable', true))).toBe(true);
  });

  it('pauses an unknown provider commit until Drive is revalidated', () => {
    expect(shouldPauseGoogleDriveAutosaveForError(new GoogleDriveUnknownCommitError())).toBe(true);
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