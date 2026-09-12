import { describe, expect, it } from 'vitest';
import { normalizeCardSet, type StoredDisplayCard } from '@/domain/cards';
import { DESK_METADATA_SEPARATOR, getDeskSourceFacets, getDeskToolCard, getDeskWorkKeyboardIntent, getWorkActions, joinDeskMetadata, matchesDeskTagFilters, matchesDeskViews, matchesSourceFilter, normalizeDeskOrder, preserveDeskOrder } from '@/features/desk/model/desk';
import { normalizeDeskViewPreferences } from '@/features/desk/hooks/useDeskViewPreferences';
import {
  collectDeskWorldItems,
  getDefaultDeskWorldPosition,
  getDeskCameraGeometry,
  getDeskWorldProjection,
  getDeskMarqueeSelection,
  moveDeskWorldSelection,
  normalizeDeskWorldGeometry,
  projectDeskWorldPosition,
} from '@/features/desk/model/deskSpatialGeometry';
import type { AccountLibraryItem } from '@/features/storage-management/model/accountLibrary';

describe('Desk tool template context', () => {
  const cards = [
    { uniqueId: 'first', templateId: 'set-front', backingTemplateId: 'set-back', data: {} },
    { uniqueId: 'selected', templateId: 'selected-front', data: {} },
    { uniqueId: 'focused', templateId: 'focused-front', data: {} },
  ] satisfies StoredDisplayCard[];

  it('uses the focused Artifact, then a selected Artifact, then the first card of the target Set', () => {
    expect(getDeskToolCard(cards, 'focused', ['selected'])?.templateId).toBe('focused-front');
    expect(getDeskToolCard(cards, 'foreign-card', ['selected'])?.templateId).toBe('selected-front');
    expect(getDeskToolCard([], null, [])).toBeUndefined();
  });

  it('preserves an explicit revision card before focused context, without needing loaded templates', () => {
    expect(getDeskToolCard(cards, 'focused', ['first', 'focused'], 'first')).toBe(cards[0]);
  });
});

describe('Desk model', () => {
  it('formats Desk metadata with the intended separator', () => {
    expect(DESK_METADATA_SEPARATOR).toBe(' · ');
    expect(joinDeskMetadata(['0 cards', 'Device only'])).toBe('0 cards · Device only');
  });

  it('opens a local Set through its project owner', () => {
    const localSet: AccountLibraryItem = {
      id: 'set:set-alpha', kind: 'set', name: 'Set Alpha',
      locations: [{ source: 'device', status: 'available', label: 'This device' }],
      details: ['0 cards', 'Device only'], sizeBytes: null, revision: null,
      updatedAt: null, expiresAt: null, webViewLink: null,
      references: { localSetId: 'set-alpha' },
      organization: { workflow: 'card-set', type: null, tags: [], source: 'none', publicationState: 'working' },
    };
    expect(getWorkActions(localSet, false, true)[0]).toMatchObject({
      id: 'desk.open-set', label: 'Open Set', ownerFeature: 'project',
    });
  });

  it('keeps campaign and immutable publication ownership contextual instead of routing them as local Sets', () => {
    const remote = (id: string, references: AccountLibraryItem['references']): AccountLibraryItem => ({
      id,
      kind: references.campaignId ? 'campaign' : 'published-resource',
      name: 'Owned remote work', locations: [{ source: references.campaignId ? 'campaign' : 'pipeline', status: 'available', label: 'CardForge' }],
      details: [], sizeBytes: null, revision: '2', updatedAt: null, expiresAt: null, webViewLink: null, references,
      organization: { workflow: references.campaignId ? 'campaign' : 'published-resource', type: null, tags: [], source: 'none', publicationState: references.campaignId ? 'campaign' : 'published' },
    });
    expect(getWorkActions(remote('campaign:summer', { campaignId: 'summer' }), false, true)[0]).toMatchObject({
      label: 'Open campaign workspace', ownerFeature: 'marketing-content',
    });
    expect(getWorkActions(remote('pipeline:lineage', { pipelineLineageId: 'lineage', pipelineAssetType: 'assets' }), false, true)[0]).toMatchObject({
      label: 'Open published work', ownerFeature: 'pipeline',
    });
  });

  it('normalizes unsafe persisted Set geometry without discarding valid organization', () => {
    expect(normalizeCardSet({
      id: 'set:organized', name: 'Organized',
      organization: {
        arrangement: 'manual', groupBy: 'field', groupField: 'faction',
        sort: 'field-value', sortField: 'rank', tags: [{ id: 'tag:red', label: 'Red' }],
        positions: { 'card:one': { x: 12, y: 24 }, bad: { x: 'no', y: 2 } },
      },
    })?.organization).toEqual({
      arrangement: 'manual', groupBy: 'field', groupField: 'faction',
      sort: 'field-value', sortField: 'rank', tags: [{ id: 'tag:red', label: 'Red' }],
      positions: { 'card:one': { x: 12, y: 24 } },
    });
  });

  it('keeps the accessibility/default projection while admitting new and removing stale work', () => {
    expect(normalizeDeskOrder(['set:a', 'set:b', 'set:c'], ['set:c', 'missing', 'set:a'])).toEqual(['set:c', 'set:a', 'set:b']);
  });

  it('keeps temporarily absent source identities in the persisted Desk order', () => {
    expect(preserveDeskOrder(['set:a', 'set:b'], ['drive:later', 'set:a'])).toEqual(['drive:later', 'set:a', 'set:b']);
    expect(normalizeDeskOrder(['set:a', 'set:b'], preserveDeskOrder(['set:a', 'set:b'], ['drive:later', 'set:a']))).toEqual(['set:a', 'set:b']);
  });

  it('derives source facets only from sources present on the current Desk', () => {
    const item = (id: string, source: AccountLibraryItem['locations'][number]['source'], label: string): AccountLibraryItem => ({
      id,
      kind: 'set',
      name: id,
      locations: [{ source, status: 'available', label }],
      details: [],
      sizeBytes: null,
      revision: null,
      updatedAt: null,
      expiresAt: null,
      webViewLink: null,
      references: {},
      organization: { workflow: 'card-set', type: null, tags: [], source: 'none', publicationState: 'working' },
    });
    const device = item('device-set', 'device', 'This device');
    const drive = item('drive-set', 'google-drive', 'Google Drive');
    expect(getDeskSourceFacets([device, drive])).toEqual([
      { id: 'device', label: 'This device', count: 1 },
      { id: 'google-drive', label: 'Google Drive', count: 1 },
    ]);
    expect(getDeskSourceFacets([{
      ...device,
      locations: [
        ...device.locations,
        { source: 'device', status: 'attached', label: 'This device' },
      ],
    }])).toEqual([{ id: 'device', label: 'This device', count: 1 }]);
    expect(matchesSourceFilter(device, 'device')).toBe(true);
    expect(matchesSourceFilter(device, 'google-drive')).toBe(false);
    expect(matchesSourceFilter(drive, 'connected')).toBe(true);
  });

  it('keeps keyboard selection separate from deliberate Set opening', () => {
    expect(getDeskWorkKeyboardIntent(' ', false)).toBe('select');
    expect(getDeskWorkKeyboardIntent(' ', true)).toBe('select-additive');
    expect(getDeskWorkKeyboardIntent('Enter', false)).toBe('open');
    expect(getDeskWorkKeyboardIntent('ArrowRight', false)).toBe('none');
  });

  it('supports any/all tag filters without treating user labels as permissions', () => {
    const item: AccountLibraryItem = {
      id: 'set:postcards', kind: 'set', name: 'Postcards', locations: [{ source: 'device', status: 'available', label: 'This device' }],
      details: [], sizeBytes: null, revision: null, updatedAt: null, expiresAt: null, webViewLink: null, references: { localSetId: 'postcards' },
      organization: { workflow: 'card-set', type: 'Postcards', tags: ['launch', 'print'], source: 'portable', publicationState: 'working' },
    };
    expect(matchesDeskTagFilters(item, ['launch', 'archive'], 'any')).toBe(true);
    expect(matchesDeskTagFilters(item, ['launch', 'print'], 'all')).toBe(true);
    expect(matchesDeskTagFilters(item, ['launch', 'archive'], 'all')).toBe(false);
    expect(matchesDeskViews(item, ['my-work'])).toBe(true);
    expect(matchesDeskViews(item, ['campaigns'])).toBe(false);
  });

  it('keeps resumable temporary Studio work in the quiet My work view', () => {
    const draft: AccountLibraryItem = {
      id: 'working-draft:concept', kind: 'working-draft', name: 'Private concept',
      locations: [{ source: 'assistant-draft', status: 'temporary', label: 'Private working draft' }],
      details: [], sizeBytes: null, revision: '2', updatedAt: null, expiresAt: '2026-09-08T00:00:00.000Z', webViewLink: null,
      references: { workingDraftId: 'concept' },
      organization: { workflow: 'assistant-document', type: null, tags: [], source: 'none', publicationState: 'temporary' },
    };

    expect(matchesDeskViews(draft, ['my-work'])).toBe(true);
  });

  it('defaults saved Desk preferences to quiet My work and preserves custom multi-select values', () => {
    expect(normalizeDeskViewPreferences(null)).toMatchObject({ views: ['my-work'], types: [], tags: [], sources: [] });
    expect(normalizeDeskViewPreferences({
      views: ['my-work', 'my-published'], types: ['Postcards'], tags: ['launch', 'print'],
      sources: ['device', 'google-drive'], tagMatch: 'all', saved: [{ id: 'launch', name: 'Launch work', views: ['my-work'], types: ['Postcards'], tags: ['launch'], sources: ['device'], tagMatch: 'any' }],
    })).toMatchObject({ views: ['my-work', 'my-published'], types: ['Postcards'], tags: ['launch', 'print'], sources: ['device', 'google-drive'], tagMatch: 'all', saved: [{ name: 'Launch work' }] });
  });

  it('migrates legacy pixels into versioned world geometry and projects across viewport sizes', () => {
    const geometry = normalizeDeskWorldGeometry({
      'set:one': { x: 120, y: 160 },
      bad: { x: 'no', y: 2 },
    });
    expect(geometry).toEqual({
      version: 2,
      positions: { 'set:one': { x: 120, y: 160, z: 0 } },
    });
    expect(projectDeskWorldPosition(geometry.positions['set:one']!, { width: 600, height: 360 })).toEqual({ x: 60, y: 80, z: 0 });
  });

  it('treats Fit as the minimum Desk camera scale on every viewport', () => {
    const mobileFit = getDeskCameraGeometry({ width: 390, height: 420 }, 0);
    expect(mobileFit).toMatchObject({
      zoom: 0.325,
      fitZoom: 0.325,
      relativeZoom: 1,
      offsetX: 0,
    });
    expect(mobileFit.surfaceWidth).toBeCloseTo(390);

    const mobileCustom = getDeskCameraGeometry({ width: 390, height: 420 }, 0.68);
    expect(mobileCustom.relativeZoom).toBeGreaterThan(2);
    expect(mobileCustom.surfaceWidth).toBeCloseTo(816);

    expect(getDeskCameraGeometry({ width: 1_920, height: 1_080 }, 1)).toMatchObject({
      zoom: 1.5,
      fitZoom: 1.5,
      relativeZoom: 1,
      offsetX: 60,
      offsetY: 0,
    });
  });

  it('gives unplaced Sets stable bounded-world anchors instead of device-sized slots', () => {
    expect(getDefaultDeskWorldPosition(0)).toEqual({ x: 484, y: 168, z: 0 });
    expect(getDefaultDeskWorldPosition(8)).toEqual({ x: 502, y: 184, z: 8 });
  });

  it('moves a Desk selection together across the full bounded world, preserving offsets', () => {
    const items = [
      { id: 'set:one', x: 10, y: 100, z: 1, width: 200, height: 240 },
      { id: 'set:two', x: 250, y: 120, z: 2, width: 200, height: 240 },
    ];
    expect(moveDeskWorldSelection({ items, selectedIds: ['set:one', 'set:two'], delta: { x: -100, y: -100 } })).toEqual({
      'set:one': { x: 0, y: 0, z: 1 },
      'set:two': { x: 240, y: 20, z: 2 },
    });
  });

  it('collects the Desk object data contract used by real spatial controls', () => {
    const tile = {
      dataset: { deskSetObjectId: 'set:one' },
      getBoundingClientRect: () => ({ left: 110, top: 140, width: 200, height: 240 }),
    };
    expect(collectDeskWorldItems({
      tiles: [tile],
      bounds: { left: 10, top: 20 },
      projection: getDeskWorldProjection({ width: 1200, height: 720 }),
      positions: {},
    })).toEqual([{ id: 'set:one', x: 100, y: 120, z: 0, width: 200, height: 240 }]);
  });

  it('selects only visible Desk objects intersecting a marquee', () => {
    const hits = getDeskMarqueeSelection([
      { id: 'set:one', x: 10, y: 100, z: 1, width: 100, height: 100 },
      { id: 'set:two', x: 300, y: 100, z: 2, width: 100, height: 100 },
      { id: 'set:hidden', x: 30, y: 120, z: 3, width: 50, height: 50, hidden: true },
    ], { left: 0, top: 80, right: 150, bottom: 240 });
    expect(hits).toEqual(['set:one']);
  });
});
