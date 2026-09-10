import { afterEach, describe, expect, it, vi } from 'vitest';

import { pickGoogleDriveItems } from '@/features/project/client/googleDrivePicker';

describe('Google Drive Picker browser bridge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes the restricted API key through Google Picker setDeveloperKey', async () => {
    let callback: ((response: { action?: string; docs?: Array<{ id?: string; name?: string; mimeType?: string }> }) => void) | null = null;
    const builder = {} as Record<string, ReturnType<typeof vi.fn>>;
    builder.addView = vi.fn(() => builder);
    builder.enableFeature = vi.fn(() => builder);
    builder.setOAuthToken = vi.fn(() => builder);
    builder.setDeveloperKey = vi.fn(() => builder);
    builder.setAppId = vi.fn(() => builder);
    builder.setTitle = vi.fn(() => builder);
    builder.setCallback = vi.fn((nextCallback) => {
      callback = nextCallback as typeof callback;
      return builder;
    });
    builder.build = vi.fn(() => ({
      setVisible: vi.fn(() => callback?.({
        action: 'picked',
        docs: [{ id: 'drive-file-12345', name: 'Selected project', mimeType: 'application/vnd.cardforge.project+zip' }],
      })),
    }));

    class DocsView {
      setIncludeFolders() { return this; }
      setSelectFolderEnabled() { return this; }
      setMimeTypes() { return this; }
      setMode() { return this; }
      setParent() { return this; }
    }

    function PickerBuilder() {
      return builder;
    }

    vi.stubGlobal('window', {
      google: {
        picker: {
          DocsView,
          PickerBuilder,
          DocsViewMode: { LIST: 'list' },
          Feature: { MULTISELECT_ENABLED: 'multiselect' },
          Action: { PICKED: 'picked', CANCEL: 'cancel', ERROR: 'error' },
        },
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      accessToken: 'drive-access-token',
      contributorKey: 'restricted-picker-key',
      appId: '1234567890',
      initialFolderId: null,
    })));

    await expect(pickGoogleDriveItems({ title: 'Choose Drive project' })).resolves.toEqual([
      { id: 'drive-file-12345', name: 'Selected project', mimeType: 'application/vnd.cardforge.project+zip' },
    ]);
    expect(builder.setDeveloperKey).toHaveBeenCalledWith('restricted-picker-key');
    expect(builder.setOAuthToken).toHaveBeenCalledWith('drive-access-token');
    expect(builder.setAppId).toHaveBeenCalledWith('1234567890');
  });
});
