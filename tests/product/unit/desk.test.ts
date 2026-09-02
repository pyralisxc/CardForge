import { describe, expect, it } from 'vitest';

import { normalizeCardSet } from '@/domain/cards';
import { getDeskWorkKeyboardIntent, getWorkActions, normalizeDeskOrder, reorderDeskItem } from '@/features/desk/model/desk';
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

describe('Desk model', () => {
  it('opens a local Set through its project owner', () => {
    const localSet: AccountLibraryItem = {
      id: 'set:set-alpha', kind: 'set', name: 'Set Alpha',
      locations: [{ source: 'device', status: 'available', label: 'This device' }],
      details: ['0 cards', 'Device only'], sizeBytes: null, revision: null,
      updatedAt: null, expiresAt: null, webViewLink: null,
      references: { localSetId: 'set-alpha' },
    };
    expect(getWorkActions(localSet, false, true)[0]).toMatchObject({
      id: 'desk.open-set', label: 'Open Set', ownerFeature: 'project',
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

  it('keeps durable Desk order while admitting new and removing stale work', () => {
    expect(normalizeDeskOrder(['set:a', 'set:b', 'set:c'], ['set:c', 'missing', 'set:a'])).toEqual(['set:c', 'set:a', 'set:b']);
    expect(reorderDeskItem(['set:a', 'set:b', 'set:c'], 'set:c', 'set:a')).toEqual(['set:c', 'set:a', 'set:b']);
    expect(reorderDeskItem(['set:a', 'set:b', 'set:c'], 'set:b', 'earlier')).toEqual(['set:b', 'set:a', 'set:c']);
    expect(reorderDeskItem(['set:a', 'set:b', 'set:c'], 'set:b', 'later')).toEqual(['set:a', 'set:c', 'set:b']);
  });

  it('keeps keyboard selection separate from deliberate Set opening', () => {
    expect(getDeskWorkKeyboardIntent(' ', false)).toBe('select');
    expect(getDeskWorkKeyboardIntent(' ', true)).toBe('select-additive');
    expect(getDeskWorkKeyboardIntent('Enter', false)).toBe('open');
    expect(getDeskWorkKeyboardIntent('ArrowRight', false)).toBe('none');
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

  it('keeps a bounded Desk readable on mobile while Fit shows the whole world', () => {
    const mobileCamera = getDeskCameraGeometry({ width: 390, height: 420 }, 0.68);
    expect(mobileCamera).toMatchObject({
      zoom: 0.68,
      fitZoom: 0.325,
      offsetX: 0,
    });
    expect(mobileCamera.surfaceWidth).toBeCloseTo(816);
    expect(getDeskCameraGeometry({ width: 1200, height: 720 }, 1)).toMatchObject({
      zoom: 1,
      fitZoom: 1,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it('gives unplaced Sets stable bounded-world anchors instead of device-sized slots', () => {
    expect(getDefaultDeskWorldPosition(0)).toEqual({ x: 484, y: 168, z: 0 });
    expect(getDefaultDeskWorldPosition(8)).toEqual({ x: 502, y: 184, z: 8 });
  });

  it('moves a Desk selection together, preserving offsets and world bounds', () => {
    const items = [
      { id: 'set:one', x: 10, y: 100, z: 1, width: 200, height: 240 },
      { id: 'set:two', x: 250, y: 120, z: 2, width: 200, height: 240 },
    ];
    expect(moveDeskWorldSelection({ items, selectedIds: ['set:one', 'set:two'], delta: { x: -100, y: -100 } })).toEqual({
      'set:one': { x: 0, y: 86, z: 1 },
      'set:two': { x: 240, y: 106, z: 2 },
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
