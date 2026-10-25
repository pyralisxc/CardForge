import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { useUnifiedLibraryView } from '@/features/storage-management/hooks/useUnifiedLibraryView';
import type { AccountLibraryItem } from '@/features/storage-management/model/accountLibrary';
import { projectPublishedLibraryObjects } from '@/features/storage-management/hooks/useLibrarySharedProjection';
import { createLibraryDetailRecord, getPipelineRevisionLabel, getSharedLibraryActions } from '@/features/storage-management/components/LibraryObjectPresentation';

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
  organization: { workflow: 'card-set', type: null, tags: [], source: 'none', publicationState: 'working' },
};

describe('unified Library view', () => {
  it('does not invent revision 1 for legacy rows and keeps their immutable ids distinguishable', () => {
    expect(getPipelineRevisionLabel({ id: 'legacy-first-identity', revisionNumber: null })).toBe('Legacy revision · legacy-f');
    expect(getPipelineRevisionLabel({ id: 'legacy-second-identity', revisionNumber: null })).toBe('Legacy revision · legacy-s');
    expect(getPipelineRevisionLabel({ id: 'known', revisionNumber: 3 })).toBe('Revision 3');
  });

  it.each([
    'business card', 'business-card', 'networking', 'front template', 'foundry sigils', 'print', 'format', 'poker',
  ])('keeps authored descriptions and published semantic metadata separate and searchable: %s', (query) => {
    const publishedItems = projectPublishedLibraryObjects({
      access: 'free', templates: { defaults: [] }, fonts: { fonts: [] }, sets: { items: [] },
      assets: { templates: [{ id: 'name-card', kind: 'template', name: 'Name Card Theme', url: '/api/templates#name-card', accessTier: 'free' }], imageAssets: [], textures: [], dividers: [], icons: [], elementPresets: [] },
      pipeline: { items: [{
        id: 'name-card', lineageId: 'original', description: 'A contact card for networking.',
        specialtyTags: ['business'], useCaseTags: ['business-card'],
        semanticRole: 'template-front', visualFamily: 'Foundry Sigils',
        variantKind: 'format', variantLabel: 'Poker', compatibilityTags: ['front', 'print'],
      }] },
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
    expect(detail.meta).toContainEqual(['Semantic role', 'Front Template']);
    expect(detail.meta).toContainEqual(['Visual family', 'Foundry Sigils']);
    expect(detail.meta).toContainEqual(['Variant', 'Format · Poker']);
    expect(detail.meta).toContainEqual(['Compatibility', 'Front · Print']);
    expect(capture.current?.sharedTypes).toEqual(expect.arrayContaining([
      'Role: Front Template', 'Family: Foundry Sigils', 'Variant: Format', 'Compatible: Print',
    ]));
  });

  it('filters published items by a semantic facet without changing their descriptions', () => {
    const publishedItems = projectPublishedLibraryObjects({
      access: 'free', templates: { defaults: [] }, fonts: { fonts: [] }, sets: { items: [] },
      assets: { templates: [{ id: 'card-front', kind: 'template', name: 'Card Front', url: '/api/templates#card-front', accessTier: 'free' },
        { id: 'card-back', kind: 'template', name: 'Card Back', url: '/api/templates#card-back', accessTier: 'free' }], imageAssets: [], textures: [], dividers: [], icons: [], elementPresets: [] },
      pipeline: { items: [
        { id: 'card-front', semanticRole: 'template-front', lineageId: null, description: 'A card front.' },
        { id: 'card-back', semanticRole: 'template-back', lineageId: null, description: 'A card back.' },
      ] },
    } as never);
    const capture: { current?: ReturnType<typeof useUnifiedLibraryView> } = {};
    function Harness() {
      capture.current = useUnifiedLibraryView({
        activeScope: 'pipeline', pipelineAccess: false,
        projection: { items: [], visibleItems: [], query: '', sort: 'name', failures: [], isLoading: false } as never,
        shared: { publishedItems, pipelineItems: [] } as never, sharedType: 'Role: Front Template',
      });
      return null;
    }
    renderToStaticMarkup(createElement(Harness));
    expect(capture.current?.viewItems.map((item) => item.name)).toEqual(['Card Front']);
    expect(createLibraryDetailRecord(capture.current!.viewItems[0]).summary).toBe('A card front.');
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

  it('describes generic published assets by their contextual Studio placement without a dead open action', () => {
    const [published] = projectPublishedLibraryObjects({
      access: 'free', templates: { defaults: [] }, fonts: { fonts: [] }, sets: { items: [] },
      assets: {
        templates: [], textures: [], dividers: [], icons: [], elementPresets: [],
        imageAssets: [{
          id: 'portrait-foundation',
          kind: 'image',
          name: 'Portrait Foundation',
          url: 'https://assets.example/portrait.webp',
          studioDestinations: ['image.frame.front'],
        }],
      },
      pipeline: { items: [] },
    } as never);
    const item = {
      id: published.id,
      scope: 'published' as const,
      name: published.name,
      kindLabel: published.kindLabel,
      sourceLabel: published.sourceLabel,
      statusLabel: 'Published',
      summary: published.description,
      updatedAt: null,
      sizeBytes: published.sizeBytes,
      previewUrl: published.previewUrl,
      fontFamily: published.fontFamily,
      published,
    };

    expect(createLibraryDetailRecord(item).meta).toContainEqual(['Studio placement', 'Front foundations']);
    expect(createLibraryDetailRecord(item).meta).toContainEqual(['Design access', 'Available through contextual Design pickers']);
    expect(getSharedLibraryActions(item)).toEqual([]);
  });
});
