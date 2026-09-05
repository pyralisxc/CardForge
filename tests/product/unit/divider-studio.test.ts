import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DividerStudioPanel } from '@/features/template-editor/components/DividerStudioPanel';
import type { TemplateAssetLibraryPicker } from '@/features/template-editor/components/TemplateAssetLibraryPicker';
import { appearanceToStyle } from '@/features/card-rendering/model/appearance';
import type { CardAssetOption } from '@/features/pipeline/client/assets';
import type { FreeformAppearance, FreeformCardElement } from '@/domain/templates';

const picker = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock('@/features/template-editor/components/TemplateAssetLibraryPicker', () => ({
  TemplateAssetLibraryPicker: (props: unknown) => { picker.render(props); return 'Browse Library'; },
}));

describe('Divider Studio source selection', () => {
  it('applies a Library divider to the selected appearance and renders its source without replacing geometry', () => {
    const asset = { id: 'sunforged', name: 'Sunforged Divider', kind: 'divider', url: 'https://example.test/sunforged.svg', allowedTargets: ['divider'], studioDestinations: ['element.divider'], tileMode: 'stretch', defaultOpacity: 85 } as CardAssetOption;
    const element: FreeformCardElement = { id: 'selected-divider', type: 'shape', name: 'Divider', x: 15, y: 20, width: 240, height: 36, zIndex: 2, shapeRole: 'divider' };
    const before = { ...element };
    let appearance: FreeformAppearance = { shapeRole: 'divider', material: { baseColor: '#fff', textColor: '#123456' }, border: { kind: 'solid', width: 2 } };
    const updateElement = vi.fn();
    const markup = renderToStaticMarkup(createElement(DividerStudioPanel, {
      element, selectedAppearance: appearance, dividerAssets: [asset], dividerPresets: [], personalItems: [],
      canUploadCustomAssets: true, onAddFromProvider: vi.fn(), onMaterializePersonal: vi.fn(), onHandleAssetUpload: vi.fn(),
      onApplyPreset: vi.fn(), onUpdateElement: updateElement,
      onUpdateAppearance: (updater) => { appearance = updater(appearance); },
    }));
    expect(markup).toContain('Divider Source');
    expect(markup).toContain('Reviewed Divider Recipes');
    const props = picker.render.mock.calls.at(-1)![0] as ComponentProps<typeof TemplateAssetLibraryPicker>;
    expect(props).toMatchObject({ kind: 'divider', assets: [asset], personalRoles: ['divider'], providerRole: 'divider', target: { kind: 'template-element', ids: ['selected-divider'] } });
    props.onApply(asset);
    expect(appearance).toMatchObject({ dividerAsset: asset.url, assetKind: 'divider', shapeRole: 'divider', textureOpacity: 85, tileMode: 'stretch', material: { baseColor: 'transparent', textColor: '#123456' }, border: { kind: 'none', width: 0 } });
    expect(appearanceToStyle(appearance).backgroundImage).toBe(`url(${asset.url})`);
    expect(element).toEqual(before);
    expect(updateElement).not.toHaveBeenCalled();
  });
});
