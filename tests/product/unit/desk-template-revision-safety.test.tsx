import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { extractTemplateFieldDefinitions, reconstructMinimalTemplateObject } from '@/domain/templates';
import type { FocusedWorkSurfaceProps } from '@/features/desk/components/FocusedWorkSurface';

const state = vi.hoisted(() => ({ adopt: undefined as undefined | ((from: string, to: string) => void), toast: vi.fn() }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock('@/features/desk/components/SetTemplates', () => ({ SetTemplates: (props: { onAdoptRevision: (from: string, to: string) => void }) => { state.adopt = props.onAdoptRevision; return null; } }));
vi.mock('@/features/desk/components/FocusedSetArtifactSurface', () => ({ FocusedSetArtifactSurface: () => null }));
import { FocusedWorkSurface } from '@/features/desk/components/FocusedWorkSurface';

const template = (id: string, keys: string[]) => reconstructMinimalTemplateObject({ id, name: id, aspectRatio: '63:88', templateSource: 'user', fieldContracts: keys.map((key) => ({ key, type: 'text' as const })), freeformCanvas: { width: 630, height: 880, elements: keys.map((key, index) => ({ id: key, name: key, type: 'text' as const, content: `{{${key}}}`, x: 0, y: index * 30, width: 100, height: 30, zIndex: index })) } });

describe('Desk Template revision adoption', () => {
  it.each(['front', 'back'] as const)('defers adoption when an authored %s static segment loses its binding', (face) => {
    const base = template('before', ['name']);
    const previous = { ...base, ...(face === 'back' ? { templateUsage: 'back-preset' as const } : {}), freeformCanvas: { ...base.freeformCanvas!, elements: base.freeformCanvas!.elements.map((element) => ({ ...element, content: 'Story: {{name}}' })) } };
    const next = { ...template('after', ['name']), ...(face === 'back' ? { templateUsage: 'back-preset' as const } : {}) };
    const staticKey = extractTemplateFieldDefinitions(previous).find((field) => field.isStaticBaseText)?.key;
    expect(staticKey).toBeDefined();
    const commit = vi.fn();
    const unreference = vi.fn();
    const authored = { [staticKey!]: 'My own story', name: 'Dragon' };
    const props = {
      currentSet: { id: 'set-a', name: 'My Set', templateIds: ['before'] },
      item: { name: 'My Set' }, localSetId: 'set-a', templates: [previous, next],
      focusedCards: [face === 'front'
        ? { uniqueId: 'card-a', template: previous, data: authored }
        : { uniqueId: 'card-a', template: template('front', ['name']), backingTemplate: previous, data: {}, backingData: authored }],
      availableFields: [], visibleCards: [], sortedCards: [], latestGeneratedIds: [], selectedCards: [], otherSets: [], reflectiveGroupings: [],
      organization: { tags: [], groupBy: 'none', arrangement: 'manual', sort: 'manual' },
      session: { focusPath: {}, lens: { filterIds: [] } },
      onCommitTemplateChange: commit, onUnreferenceTemplate: unreference,
    } as unknown as FocusedWorkSurfaceProps;
    state.adopt = undefined;
    state.toast.mockReset();
    renderToStaticMarkup(createElement(FocusedWorkSurface, props));
    expect(state.adopt).toBeDefined();
    state.adopt!('before', 'after');
    expect(commit).not.toHaveBeenCalled();
    expect(unreference).not.toHaveBeenCalled();
  });

  it.each(['front', 'back'] as const)('preserves %s data when the update removes a field', (face) => {
    const previous = { ...template('before', ['name', 'lore']), ...(face === 'back' ? { templateUsage: 'back-preset' as const } : {}) };
    const next = { ...template('after', ['name']), ...(face === 'back' ? { templateUsage: 'back-preset' as const } : {}) };
    const commit = vi.fn();
    const unreference = vi.fn();
    const props = {
      currentSet: { id: 'set-a', name: 'My Set', templateIds: ['before'] },
      item: { name: 'My Set' }, localSetId: 'set-a', templates: [previous, next],
      focusedCards: [face === 'front'
        ? { uniqueId: 'card-a', template: previous, data: { name: 'Dragon', lore: 'Do not lose this' } }
        : { uniqueId: 'card-a', template: template('front', ['name']), backingTemplate: previous, data: { name: 'Dragon' }, backingData: { lore: 'Do not lose this' } }],
      availableFields: [], visibleCards: [], sortedCards: [], latestGeneratedIds: [], selectedCards: [], otherSets: [], reflectiveGroupings: [],
      organization: { tags: [], groupBy: 'none', arrangement: 'manual', sort: 'manual' },
      session: { focusPath: {}, lens: { filterIds: [] } },
      onCommitTemplateChange: commit, onUnreferenceTemplate: unreference,
    } as unknown as FocusedWorkSurfaceProps;
    state.adopt = undefined;
    state.toast.mockReset();
    renderToStaticMarkup(createElement(FocusedWorkSurface, props));
    expect(state.adopt).toBeDefined();
    state.adopt!('before', 'after');
    expect(commit).not.toHaveBeenCalled();
    expect(unreference).not.toHaveBeenCalled();
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('preserved') }));
  });

  it('continues to adopt a revision that retains the existing fields', () => {
    const previous = template('before', ['name', 'lore']);
    const next = template('after', ['name', 'lore', 'notes']);
    const commit = vi.fn();
    const unreference = vi.fn();
    const props = {
      currentSet: { id: 'set-a', name: 'My Set', templateIds: ['before'] },
      item: { name: 'My Set' }, localSetId: 'set-a', templates: [previous, next],
      focusedCards: [{ uniqueId: 'card-a', template: previous, data: { name: 'Dragon', lore: 'Keep this' } }],
      availableFields: [], visibleCards: [], sortedCards: [], latestGeneratedIds: [], selectedCards: [], otherSets: [], reflectiveGroupings: [],
      organization: { tags: [], groupBy: 'none', arrangement: 'manual', sort: 'manual' },
      session: { focusPath: {}, lens: { filterIds: [] } },
      onCommitTemplateChange: commit, onUnreferenceTemplate: unreference,
    } as unknown as FocusedWorkSurfaceProps;
    state.adopt = undefined;
    state.toast.mockReset();
    renderToStaticMarkup(createElement(FocusedWorkSurface, props));
    expect(state.adopt).toBeDefined();
    state.adopt!('before', 'after');
    expect(commit).toHaveBeenCalledWith(expect.objectContaining({
      sourceTemplateId: 'before', template: next, artifactIds: ['card-a'], removedFieldKeys: [], setId: 'set-a',
    }));
    expect(unreference).toHaveBeenCalledWith('set-a', 'before');
  });
});
