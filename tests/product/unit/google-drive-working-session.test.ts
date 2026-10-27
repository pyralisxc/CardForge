import { describe, expect, it } from 'vitest';

import { ApiClientError } from '@/infrastructure/http/clientResponses';
import {
  GOOGLE_DRIVE_SHARED_FILE_REFRESH_INTERVAL_MS,
  shouldApplyGoogleDriveRemoteProbe,
  shouldPauseGoogleDriveAutosaveAfterRevalidation,
  shouldPauseGoogleDriveAutosaveForError,
  shouldOfferGoogleDriveReconciliation,
} from '@/features/project/client/googleDriveWorkingSession';
import { GoogleDriveSaveLinkageError, GoogleDriveUnknownCommitError, getGoogleDriveSaveBarrier, clearConfirmedGoogleDriveLinkBarrier, serializeGoogleDriveTargetSave } from '@/features/project/client/googleDriveProjectTransfer';
import { getScopedProjectStorageNamespace } from '@/features/project/persistence/projectPersistenceScope';

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

describe('shared browser Drive target serialization and recovery', () => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const file = (suffix: string) => ({ fileId: `test-drive-target-${suffix}` });

  it('serializes two callers for the same provider file, but not independent files', async () => {
    const target = file('sequential');
    const events: string[] = [];
    let release!: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    const first = serializeGoogleDriveTargetSave(namespace, target, async () => {
      events.push('first-start');
      await wait;
      events.push('first-end');
      return 'first';
    });
    const second = serializeGoogleDriveTargetSave(namespace, target, async () => {
      events.push('second-start');
      return 'second';
    });
    const other = await serializeGoogleDriveTargetSave(namespace, file('unrelated'), async () => 'unrelated');
    expect(other).toBe('unrelated');
    expect(events).toEqual(['first-start']);
    release();
    expect(await Promise.all([first, second])).toEqual(['first', 'second']);
    expect(events).toEqual(['first-start', 'first-end', 'second-start']);
  });

  it('does not retry an uncertain upload on the same file after a metadata recheck', async () => {
    const target = file('uncertain');
    const unknown = new GoogleDriveUnknownCommitError();
    await expect(serializeGoogleDriveTargetSave(namespace, target, async () => { throw unknown; })).rejects.toBe(unknown);
    expect(getGoogleDriveSaveBarrier(target, namespace)).toBe(unknown);
    let writes = 0;
    await expect(serializeGoogleDriveTargetSave(namespace, target, async () => { writes += 1; })).rejects.toBe(unknown);
    expect(writes).toBe(0);
    expect(await serializeGoogleDriveTargetSave(namespace, file('new-independent'), async () => 'copy')).toBe('copy');
  });

  it('keeps an exact committed-linkage receipt until a matching repair is confirmed', async () => {
    const receipt = {
      ...file('linkage'), name: 'Set', providerRevision: 'head:abc', projectRevision: 'a'.repeat(64),
      lastSavedAt: '2026-10-26T00:00:00.000Z', webViewLink: null, workId: 'set-1', accountId: 'google-user-1',
    };
    const failure = new GoogleDriveSaveLinkageError(receipt, new Error('local persistence failed'));
    await expect(serializeGoogleDriveTargetSave(namespace, receipt, async () => { throw failure; })).rejects.toBe(failure);
    clearConfirmedGoogleDriveLinkBarrier({ ...receipt, providerRevision: 'head:different' }, namespace);
    expect(getGoogleDriveSaveBarrier(receipt, namespace)).toBe(failure);
    clearConfirmedGoogleDriveLinkBarrier(receipt, namespace);
    expect(getGoogleDriveSaveBarrier(receipt, namespace)).toBeNull();
    expect(await serializeGoogleDriveTargetSave(namespace, receipt, async () => 'safe')).toBe('safe');
  });
});
