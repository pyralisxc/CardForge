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
    expect(appearance).toMatchObject({ dividerAsset: asset.url, assetKind: 'divider', assetRenderMode: 'original', shapeRole: 'divider', textureOpacity: 85, tileMode: 'stretch', material: { baseColor: 'transparent', textColor: '#123456' }, border: { kind: 'none', width: 0 } });
    expect(appearanceToStyle(appearance).backgroundImage).toBe(`url(${asset.url})`);
    expect(element).toEqual(before);
    expect(updateElement).not.toHaveBeenCalled();
  });

  it('renders a reviewed SVG divider as a recolorable mask when tint mode is selected', () => {
    const style = appearanceToStyle({
      dividerAsset: 'https://cdn.example.test/divider.svg?revision=2',
      assetKind: 'divider',
      assetRenderMode: 'tint',
      assetTintColor: '#d5ad54',
      tileMode: 'stretch',
    });

    expect(style.backgroundImage).toBeUndefined();
    expect(style.backgroundSize).toBeUndefined();
    expect(style.backgroundRepeat).toBeUndefined();
    expect(style.backgroundPosition).toBeUndefined();
    expect(style.backgroundColor).toBe('#d5ad54');
    expect(style.maskImage).toBe('url(https://cdn.example.test/divider.svg?revision=2)');
    expect(style.maskSize).toBe('100% 100%');
  });
});

describe('appearance background fit', () => {
  const source = 'https://cdn.example.test/finite-surface.svg';

  it.each([
    ['contain', 'contain', 'no-repeat', 'center'],
    ['stretch', '100% 100%', 'no-repeat', undefined],
    ['repeat', '96px 96px', 'repeat', undefined],
  ] as const)('honors %s for both material URL textures and top-level assets', (tileMode, size, repeat, position) => {
    const appearances: FreeformAppearance[] = [
      { material: { texture: { kind: 'uploaded', assetSource: source, tileMode, textureScale: 96 } } },
      { material: { texture: { kind: 'uploaded', imageSource: source, tileMode, textureScale: 96 } } },
      { assetSource: source, tileMode, textureScale: 96 },
    ];
    for (const appearance of appearances) {
      const style = appearanceToStyle(appearance);
      expect(style.backgroundImage).toBe(`url(${source})`);
      expect(style.backgroundSize).toBe(size);
      expect(style.backgroundRepeat).toBe(repeat);
      expect(style.backgroundPosition).toBe(position);
    }
  });

  it('preserves legacy fit when no tile mode is authored', () => {
    expect(appearanceToStyle({ material: { texture: { kind: 'uploaded', assetSource: source } } })).toMatchObject({
      backgroundSize: '160px 160px', backgroundRepeat: 'repeat',
    });
    expect(appearanceToStyle({ material: { texture: { kind: 'uploaded', imageSource: source, textureScale: 72 } } })).toMatchObject({
      backgroundSize: '72px 72px', backgroundRepeat: 'repeat',
    });
    expect(appearanceToStyle({ assetSource: source })).toMatchObject({
      backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat',
    });
  });

  it('keeps each asset, texture, gradient and raw CSS layer aligned with its own fit', () => {
    const style = appearanceToStyle({
      assetSource: 'https://cdn.example.test/frame.svg', tileMode: 'contain',
      material: {
        texture: { kind: 'uploaded', assetSource: source, tileMode: 'repeat', textureScale: 72 },
        gradient: { type: 'linear', stops: [{ id: 'start', color: '#000000', position: 0 }, { id: 'end', color: '#ffffff', position: 100 }] },
      },
      rawCss: { backgroundImage: 'linear-gradient(90deg, red, blue), url("https://cdn.example.test/raw,(2).png"), url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E")' },
    });
    expect(style.backgroundImage).toBe(`url(https://cdn.example.test/frame.svg), url(${source}), linear-gradient(135deg, #000000 0%, #ffffff 100%), linear-gradient(90deg, red, blue), url("https://cdn.example.test/raw,(2).png"), url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E")`);
    expect(style.backgroundSize).toBe('contain, 72px 72px, auto, auto, auto, auto');
    expect(style.backgroundRepeat).toBe('no-repeat, repeat, repeat, repeat, repeat, repeat');
    expect(style.backgroundPosition).toBe('center, 0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%');
  });

  it('accounts for multi-gradient procedural textures without fitting the following raw layer', () => {
    const style = appearanceToStyle({
      material: { texture: { kind: 'parchment', textureScale: 48 } },
      rawCss: { backgroundImage: 'linear-gradient(red, blue)' },
    });
    expect(style.backgroundSize).toBe('48px 48px, 48px 48px, auto');
  });

  it('does not include a tinted asset in the background layer fit list', () => {
    const style = appearanceToStyle({
      assetSource: 'https://cdn.example.test/frame.svg', assetRenderMode: 'tint', tileMode: 'stretch',
      material: { texture: { kind: 'uploaded', assetSource: source, tileMode: 'contain' } },
      rawCss: { backgroundImage: 'linear-gradient(red, blue)' },
    });
    expect(style.backgroundImage).toBe(`url(${source}), linear-gradient(red, blue)`);
    expect(style.backgroundSize).toBe('contain, auto');
    expect(style.backgroundRepeat).toBe('no-repeat, repeat');
    expect(style.backgroundPosition).toBe('center, 0% 0%');
    expect(style.maskSize).toBe('100% 100%');
  });
});
