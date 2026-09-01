import { describe, expect, it } from 'vitest';

import { normalizeCardSet } from '@/domain/cards';
import { getWorkActions, normalizeDeskOrder, reorderDeskItem } from '@/features/home/model/homeDesk';
import type { AccountLibraryItem } from '@/features/storage-management/model/accountLibrary';

describe('Home Desk model', () => {
  it('opens a local Set through its project owner', () => {
    const localSet: AccountLibraryItem = {
      id: 'set:set-alpha', kind: 'set', name: 'Set Alpha',
      locations: [{ source: 'device', status: 'available', label: 'This device' }],
      details: ['0 cards', 'Device only'], sizeBytes: null, revision: null,
      updatedAt: null, expiresAt: null, webViewLink: null,
      references: { localSetId: 'set-alpha' },
    };
    expect(getWorkActions(localSet, false, true)[0]).toMatchObject({
      id: 'home.open-work', label: 'Open Set', ownerFeature: 'project',
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
});
