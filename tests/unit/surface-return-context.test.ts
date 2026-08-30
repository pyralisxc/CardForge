import { describe, expect, it } from 'vitest';

import {
  readSurfaceReturnContext,
  storeSurfaceReturnContext,
  type SurfaceReturnContext,
} from '@/features/app-shell/client/navigation';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('surface return context', () => {
  it('round-trips exact Desk working context without placing it in the URL', () => {
    const storage = new MemoryStorage();
    const context: SurfaceReturnContext = {
      kind: 'desk',
      focusedWorkId: 'set:playing-cards',
      inspectorWorkId: null,
      query: 'cards',
      sourceFilter: 'device',
      sort: 'desk',
      selectedCardIds: ['ace-spades', 'king-spades'],
      cardQuery: 'spades',
      tagFilter: 'tag:black',
      scrollTop: 280,
    };

    const key = storeSurfaceReturnContext(context, storage, 'desk-key', 1_000);

    expect(key).toBe('desk-key');
    expect(readSurfaceReturnContext(key, storage, 1_001)).toEqual(context);
  });

  it('keeps Library selection, filters, density, and list position together', () => {
    const storage = new MemoryStorage();
    const context: SurfaceReturnContext = {
      kind: 'library',
      scope: 'pipeline',
      objectId: 'pipeline:arcane-frame',
      query: 'arcane',
      source: 'all',
      itemKind: 'template',
      sort: 'name',
      density: 'list',
      sharedType: 'Template',
      scrollTop: 640,
    };

    const key = storeSurfaceReturnContext(context, storage, 'library-key', 2_000);

    expect(readSurfaceReturnContext(key, storage, 2_001)).toEqual(context);
  });

  it('rejects malformed and expired return state', () => {
    const storage = new MemoryStorage();
    storage.setItem('cardforge:surface-return-context:v1', '{"bad":true}');
    expect(readSurfaceReturnContext('missing', storage, 10_000)).toBeNull();

    const key = storeSurfaceReturnContext({
      kind: 'desk', focusedWorkId: null, inspectorWorkId: null, query: '', sourceFilter: 'all', sort: 'desk',
      selectedCardIds: [], cardQuery: '', tagFilter: 'all', scrollTop: 0,
    }, storage, 'expired', 1);
    expect(readSurfaceReturnContext(key, storage, 1000 * 60 * 60 * 7)).toBeNull();
  });
});
