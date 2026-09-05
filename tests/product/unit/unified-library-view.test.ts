import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { useUnifiedLibraryView } from '@/features/storage-management/hooks/useUnifiedLibraryView';
import type { AccountLibraryItem } from '@/features/storage-management/model/accountLibrary';
import { projectPublishedLibraryObjects } from '@/features/storage-management/hooks/useLibrarySharedProjection';
import { createLibraryDetailRecord } from '@/features/storage-management/components/LibraryObjectPresentation';

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
  it.each(['business card', 'business-card', 'networking'])('keeps published usage guidance and classification visible and searchable: %s', (query) => {
    const publishedItems = projectPublishedLibraryObjects({
      access: 'free', templates: { defaults: [] }, fonts: { fonts: [] }, sets: { items: [] },
      assets: { templates: [{ id: 'name-card', kind: 'template', name: 'Name Card Theme', url: '/api/templates#name-card', accessTier: 'free' }], imageAssets: [], textures: [], dividers: [], icons: [], elementPresets: [] },
      pipeline: { items: [{ id: 'name-card', lineageId: 'original', description: 'A contact card for networking.', specialtyTags: ['business'], useCaseTags: ['business-card'] }] },
    } as never);
    const capture: { current?: ReturnType<typeof useUnifiedLibraryView> } = {};
    function Harness() {
      capture.current = useUnifiedLibraryView({
        activeScope: 'pipeline', pipelineAccess: false,
        projection: { items: [], visibleItems: [], query, sort: 'name', failures: [], isLoading: false } as never,
        shared: { publishedItems, pipelineItems: [] } as never, sharedType: 'all',
      });
      return null;
    }
    renderToStaticMarkup(createElement(Harness));
    expect(capture.current?.viewItems).toHaveLength(1);
    const detail = createLibraryDetailRecord(capture.current!.viewItems[0]);
    expect(detail.summary).toBe('A contact card for networking.');
    expect(detail.meta).toContainEqual(['Specialties', 'Business']);
    expect(detail.meta).toContainEqual(['Use cases', 'Business Card']);
  });

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
