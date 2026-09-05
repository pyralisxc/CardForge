"use client";

import { useRef, type ChangeEvent } from 'react';
import type { CardAssetOption } from '@/features/pipeline/client/assets';
import type { PersonalLibraryItem, PersonalLibraryRole } from '@/features/personal-library/client';
import { TemplateAssetLibraryPicker } from './TemplateAssetLibraryPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { ElementPresetRecipe } from '@/features/template-editor/lib/elementPresetRecipes';
import type { FreeformAppearance, FreeformCardElement } from '@/domain/templates';
import { PipelineRecipeMeta, getPipelineRecipeTitle } from '@/features/template-editor/components/PipelineRecipeMeta';

interface DividerStudioPanelProps {
  element: FreeformCardElement;
  selectedAppearance?: FreeformAppearance;
  dividerPresets: ElementPresetRecipe[];
  dividerAssets: CardAssetOption[];
  personalItems: readonly PersonalLibraryItem[];
  onAddFromProvider: (role: PersonalLibraryRole) => Promise<void>;
  onMaterializePersonal: (item: PersonalLibraryItem) => Promise<CardAssetOption>;
  canUploadCustomAssets: boolean;
  onHandleAssetUpload: (event: ChangeEvent<HTMLInputElement>, kind: 'divider') => void;
  onApplyPreset: (preset: ElementPresetRecipe) => void;
  onUpdateElement: (updates: Partial<FreeformCardElement>, trackHistory?: boolean) => void;
  onUpdateAppearance: (updater: (appearance: FreeformAppearance) => FreeformAppearance, trackHistory?: boolean) => void;
}

export function DividerStudioPanel({
  element,
  selectedAppearance,
  dividerPresets,
  dividerAssets,
  personalItems,
  onAddFromProvider,
  onMaterializePersonal,
  canUploadCustomAssets,
  onHandleAssetUpload,
  onApplyPreset,
  onUpdateElement,
  onUpdateAppearance,
}: DividerStudioPanelProps) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const applyDivider = (asset: CardAssetOption) => onUpdateAppearance((appearance) => ({
    ...appearance,
    dividerAsset: asset.url,
    assetKind: 'divider',
    textureOpacity: asset.defaultOpacity ?? 100,
    blendMode: asset.defaultBlendMode ?? 'normal',
    tileMode: asset.tileMode ?? 'stretch',
    shapeRole: 'divider',
    material: { ...appearance.material, baseColor: 'transparent', texture: { kind: 'none' } },
    border: { ...appearance.border, kind: 'none', width: 0 },
  }));

  const hasAssetBackedDivider = Boolean(selectedAppearance?.dividerAsset || selectedAppearance?.assetSource);

  return (
    <div className="space-y-2 rounded-[6px] border border-[var(--cf-editor-border)] bg-[#0b0f15] p-2">
      <Label className="text-[10px] uppercase tracking-[0.16em] text-[#d5ad54]">Divider Studio</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Divider Source</Label>
        <TemplateAssetLibraryPicker
          assets={dividerAssets}
          kind="divider"
          label="a divider"
          personalItems={personalItems}
          personalRoles={['divider']}
          providerRole="divider"
          target={{ kind: 'template-element', ids: [element.id] }}
          onAddFromProvider={onAddFromProvider}
          onApply={applyDivider}
          onMaterializePersonal={onMaterializePersonal}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => uploadInputRef.current?.click()}>
          {canUploadCustomAssets ? 'Add local' : 'Sign in'}
        </Button>
        <input ref={uploadInputRef} type="file" accept="image/*" hidden onChange={(event) => onHandleAssetUpload(event, 'divider')} />
      </div>
      <div>
        <Label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Reviewed Divider Recipes</Label>
        <div className="grid grid-cols-2 gap-1">
          {dividerPresets.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="outline"
              size="sm"
              title={getPipelineRecipeTitle(preset)}
              aria-label={`Apply ${preset.label} divider recipe`}
              className="h-auto min-h-9 flex-col items-start rounded-[4px] border-[#2d3340] bg-[var(--cf-editor-control)] px-2 py-1.5 text-left text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
              onClick={() => onApplyPreset(preset)}
            >
              <span className="h-2 w-full rounded-full" style={{ background: preset.preview?.background || preset.updates?.backgroundImageUrl || preset.updates?.fillColor || '#d5ad54' }} aria-hidden="true" />
              <span className="mt-1 block w-full truncate text-[#f1dfb4]">{preset.label}</span>
              <PipelineRecipeMeta recipe={preset} />
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="divider-height" className="text-xs">Height</Label>
          <Input id="divider-height" type="number" min="4" value={element.height || 36} onChange={(event) => onUpdateElement({ height: Number(event.target.value) || 36 }, false)} />
        </div>
        <div>
          <Label htmlFor="divider-opacity" className="text-xs">Opacity</Label>
          <Input id="divider-opacity" type="number" min="0" max="100" value={Math.round((element.opacity ?? 1) * 100)} onChange={(event) => onUpdateElement({ opacity: Math.max(0, Math.min(1, Number(event.target.value) / 100)) }, false)} />
        </div>
      </div>
      <div className={`grid gap-2 ${hasAssetBackedDivider ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {hasAssetBackedDivider && (
          <div>
            <Label htmlFor="divider-asset-fit" className="text-xs">Asset Fit</Label>
            <Select value={selectedAppearance?.tileMode || 'stretch'} onValueChange={(value) => onUpdateAppearance((appearance) => ({ ...appearance, tileMode: value as FreeformAppearance['tileMode'] }))}>
              <SelectTrigger id="divider-asset-fit"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stretch">Stretch</SelectItem>
                <SelectItem value="contain">Contain</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-end justify-between gap-2 rounded-[5px] border border-[var(--cf-editor-border)] bg-[var(--cf-editor-control)] px-2 py-2">
          <Label htmlFor="divider-flip" className="text-xs">Flip</Label>
          <Switch id="divider-flip" checked={Boolean(element.flipX)} onCheckedChange={(checked) => onUpdateElement({ flipX: checked })} />
        </div>
      </div>
    </div>
  );
}
