import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { useUnifiedLibraryView } from '@/features/storage-management/hooks/useUnifiedLibraryView';
import type { AccountLibraryItem } from '@/features/storage-management/model/accountLibrary';

const localSet: AccountLibraryItem = {
  id: 'set:set-1',
  kind: 'set',
  name: 'First Set',
  locations: [{ source: 'device', status: 'available', label: 'This device' }],
  details: ['0 cards', 'Device only'],
  sizeBytes: null,
  revision: null,
  updatedAt: null,
  expiresAt: null,
  webViewLink: null,
  references: { localSetId: 'set-1' },
};

describe('unified Library view', () => {
  it.each([false, true])('preserves Personal items and search state when a source has failed: %s', (sourceFailed) => {
    const capture: { current?: ReturnType<typeof useUnifiedLibraryView> } = {};
    const failure = { id: 'google-drive', kind: 'authentication_required', code: 'drive_auth_required', message: 'Reconnect Google Drive.', retryable: false, correlationId: null };

    function Harness() {
      capture.current = useUnifiedLibraryView({
        activeScope: 'personal',
        pipelineAccess: false,
        projection: {
          items: [localSet],
          visibleItems: [],
          query: 'not present',
          source: 'all',
          kind: 'all',
          sort: 'recent',
          failures: sourceFailed ? [failure] : [],
          isLoading: false,
        } as never,
        shared: {
          publishedItems: [],
          pipelineItems: [],
        } as never,
        sharedType: 'all',
      });
      return null;
    }

    renderToStaticMarkup(createElement(Harness));
    const result = capture.current;

    expect(result).toMatchObject({
      activeStatus: sourceFailed ? { kind: 'partial', label: 'Some sources unavailable' } : { kind: 'ready', label: '1 object' },
    });
    expect(result?.activeFailure).toBe(sourceFailed ? failure : null);
    expect(result?.unfilteredScopeItemCount).toBe(1);
    expect(result?.scopeItems).toHaveLength(0);
    expect(result?.viewItems).toHaveLength(0);
  });
});
