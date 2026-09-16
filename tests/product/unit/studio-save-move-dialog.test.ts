import { describe, expect, it } from 'vitest';

import { ApiClientError } from '@/infrastructure/http/clientResponses';
import {
  describeGoogleDriveLibraryFailure,
  resolveGoogleDriveConflictMessage,
} from '@/features/project/components/StudioSaveMoveDialog';

describe('Studio Save & move Drive conflict safety', () => {
  it('allows an unchanged browser copy to refresh its newer Drive revision', async () => {
    await expect(resolveGoogleDriveConflictMessage(async () => false)).resolves.toBeNull();
  });

  it('blocks a known dirty browser copy from overwriting a newer Drive revision', async () => {
    await expect(resolveGoogleDriveConflictMessage(async () => true)).resolves.toContain('Save as new');
  });

  it('blocks an overwrite when browser-change verification itself is unavailable', async () => {
    await expect(resolveGoogleDriveConflictMessage(async () => {
      throw new Error('IndexedDB unavailable');
    })).resolves.toContain('could not verify');
  });

  it('does not reduce an unavailable Drive provider to a disconnected account', () => {
    expect(describeGoogleDriveLibraryFailure(new Error('network down'))).toContain('temporarily unavailable');
  });

  it('keeps a provider-authentication action visible when Drive cannot be listed', () => {
    const error = new ApiClientError('Reconnect Google Drive.', 401, 'google_drive_authentication', 'authentication', false, null, 'Reconnect Google Drive.');
    expect(describeGoogleDriveLibraryFailure(error)).toBe('Reconnect Google Drive.');
  });
});
