import { describe, expect, it } from 'vitest';
import { normalizeCardSet } from '@/domain/cards';
import {
  authorizedDeskViews, createDefaultWorkView, createWorkOrganization, matchesWorkView,
  normalizeWorkOrganization, normalizeWorkView, type WorkClassification, type WorkViewCandidate,
} from '@/domain/artifacts/workOrganization';
import { createWorkOrganizationSlice } from '@/features/project/store/workOrganizationSlice';
import type { ProjectState } from '@/features/project/store/types';

const labels: WorkClassification = {
  types: [{ id: 'custom-type:postcards', label: 'Postcards' }],
  tags: [{ id: 'tag:festival', label: 'Festival' }, { id: 'tag:art', label: 'Needs artwork' }],
};
const target: WorkViewCandidate = { id: 'set:one', name: 'Autumn', views: ['work'], sources: ['device', 'google-drive'], classification: labels };
const makeStore = () => {
  let state = {
    cardSets: [{ id: 'one', name: 'Autumn', classification: structuredClone(labels) }],
    activeCardSet: { id: 'one', name: 'Autumn', classification: structuredClone(labels) }, storedCards: [],
  } as unknown as ProjectState;
  const set = (patch: unknown) => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch as object) }; };
  const get = () => state;
  state = { ...state, ...createWorkOrganizationSlice(set, get, {} as Parameters<typeof createWorkOrganizationSlice>[2]) };
  return get;
};

describe('creator work organization', () => {
  it('preserves custom Set classifications through normalization without making a new workflow', () => {
    expect(normalizeCardSet({ id: 'one', name: 'Autumn', classification: labels })).toEqual({ id: 'one', name: 'Autumn', classification: labels });
    expect(normalizeCardSet({ id: 'old', name: 'Legacy' })).toEqual({ id: 'old', name: 'Legacy' });
    expect(normalizeCardSet({ id: 'bad', classification: { types: [{ id: {}, label: 'bad' }], tags: null } })?.classification).toEqual({ types: [], tags: [] });
  });

  it('uses OR within types/sources, AND across groups, and explicit any/all tags', () => {
    const filters = { ...createDefaultWorkView(), sources: ['local-folder', 'google-drive'], types: ['type:tcg', 'custom-type:postcards'], tags: ['tag:festival', 'missing'] };
    expect(matchesWorkView(target, filters, ['work'])).toBe(true);
    expect(matchesWorkView(target, { ...filters, tagMatch: 'all' }, ['work'])).toBe(false);
    expect(matchesWorkView(target, { ...filters, sources: ['local-folder'] }, ['work'])).toBe(false);
    expect(matchesWorkView(target, { ...filters, query: 'needs artwork' }, ['work'])).toBe(true);
    expect(matchesWorkView(target, { ...filters, views: [] }, ['work'])).toBe(false);
  });

  it('does not turn a label, custom saved view, or revoked role into protected membership', () => {
    const campaign = { ...target, views: ['campaigns' as const] };
    const publication = { ...target, views: ['published' as const] };
    const selected = { ...createDefaultWorkView(), views: ['work', 'campaigns', 'published'] as const };
    const filters = { ...selected, views: [...selected.views] };
    expect(matchesWorkView(campaign, filters, authorizedDeskViews({ campaigns: false, published: false }))).toBe(false);
    expect(matchesWorkView(publication, filters, ['work', 'campaigns'])).toBe(false);
    expect(matchesWorkView(campaign, createDefaultWorkView(), ['work', 'campaigns'])).toBe(false);
    expect(matchesWorkView({ ...target, classification: { types: [{ id: 'type:campaign', label: 'Campaign' }], tags: [] } }, createDefaultWorkView(), ['work'])).toBe(true);
  });

  it('keeps labels on published work in private annotations and never mutates its source', () => {
    const get = makeStore();
    const source = { id: 'published:lineage', classification: structuredClone(labels) };
    const before = structuredClone(source);
    const tag = get().createWorkLabel('tags', 'Update next month')!;
    get().setWorkLabel([source], 'tags', tag, true);
    expect(source).toEqual(before);
    expect(get().workOrganization.annotations[source.id]?.tags).toContainEqual(tag);
    expect(get().cardSets[0]?.classification).toEqual(labels);
    expect(get().createWorkLabel('tags', ' update   next month ')).toEqual(tag);
  });

  it('renames stable labels, removes only associations, and preserves work and chosen startup semantics', () => {
    const get = makeStore();
    const tag = get().createWorkLabel('tags', 'Festival')!;
    const view = get().saveDeskView('Postcards', { ...createDefaultWorkView(), tags: [tag.id] })!;
    get().setStartupDeskView(view);
    expect(get().renameWorkLabel('tags', tag.id, 'Spring festival')).toBe(true);
    expect(get().cardSets[0]?.classification?.tags[0]?.id).toBe(tag.id);
    expect(get().workOrganization.savedViews[0]?.filters.tags).toEqual([tag.id]);
    expect(get().removeWorkLabel('tags', tag.id)).toBe(true);
    expect(get().cardSets).toHaveLength(1);
    expect(get().cardSets[0]?.classification?.types).toEqual(labels.types);
    expect(get().workOrganization.savedViews[0]?.filters.tags).toEqual([]);
    get().removeDeskView(view);
    expect(get().workOrganization.startupViewId).toBeNull();
    expect(get().renameWorkLabel('types', 'type:cards', 'Anything')).toBe(false);
  });

  it('normalizes legacy and malformed preferences, keeping default work free of protected views', () => {
    expect(normalizeWorkOrganization(null)).toEqual(createWorkOrganization());
    expect(normalizeWorkOrganization({ labels: null, startupViewId: 'missing', savedViews: [{ id: 'one', name: '  My   cards ', filters: null }] }).startupViewId).toBeNull();
    expect(normalizeWorkView({ views: [] }).views).toEqual([]);
    expect(normalizeWorkView({ views: ['work', 'work', 'not-a-permission'] }).views).toEqual(['work']);
    expect(createDefaultWorkView().views).toEqual(['work']);
  });
});
