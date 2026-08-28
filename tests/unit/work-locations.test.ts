import { describe, expect, it } from 'vitest';

import {
  canMoveWork,
  canTransferWork,
  getWorkLocationCapabilities,
  normalizeDefaultWorkLocation,
} from '@/features/storage-management/model/workLocations';

describe('work location policy', () => {
  it('uses the first available writable location when a stored default is unavailable', () => {
    const capabilities = getWorkLocationCapabilities({ signedIn: false, driveConnected: false, localFolderSupported: true });
    expect(normalizeDefaultWorkLocation('google-drive', capabilities)).toBe('device');
    expect(normalizeDefaultWorkLocation('local-folder', capabilities)).toBe('local-folder');
  });

  it('keeps copy and move distinct at the source boundary', () => {
    const capabilities = getWorkLocationCapabilities({ signedIn: true, driveConnected: true, localFolderSupported: true });
    expect(canTransferWork({ source: 'device', destination: 'google-drive', capabilities })).toBe(true);
    expect(canMoveWork({ source: 'device', destination: 'google-drive', capabilities })).toBe(true);
    expect(canTransferWork({ source: 'local-folder', destination: 'google-drive', capabilities })).toBe(true);
    expect(canMoveWork({ source: 'local-folder', destination: 'google-drive', capabilities })).toBe(false);
  });

  it('does not pretend an unconnected provider is writable', () => {
    const capabilities = getWorkLocationCapabilities({ signedIn: true, driveConnected: false, localFolderSupported: false });
    expect(canTransferWork({ source: 'device', destination: 'google-drive', capabilities })).toBe(false);
    expect(capabilities.find((capability) => capability.id === 'google-drive')?.reason).toContain('Connect Google Drive');
  });
});
