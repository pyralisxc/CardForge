"use client";

import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Save, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { appearanceToStyle } from '@/lib/appearance';
import type { CardAssetOption } from '@/lib/cardAssets';
import type { AppearanceBorderKind, AppearanceGradientType, AppearanceStylePreset, AppearanceTextureKind, FreeformAppearance, FreeformCardElement } from '@/types';
import { ColorField } from '@/components/card-forge/makerConstants';

interface AppearanceStudioPanelProps {
  element: FreeformCardElement;
  selectedAppearance?: FreeformAppearance;
  compatibleAppearanceStyles: AppearanceStylePreset[];
  compatibleTextureAssets: CardAssetOption[];
  compatibleDividerAssets: CardAssetOption[];
  elementStylePresets: Array<{ label: string; updates: Partial<FreeformCardElement> }>;
  canUseImageSource: boolean;
  canUseDividerControls: boolean;
  canUseBackgroundTexture: boolean;
  controlClassName: string;
  buttonClassName: string;
  assetSearch: string;
  onAssetSearchChange: (value: string) => void;
  onHandleAssetUpload: (event: ChangeEvent<HTMLInputElement>, kind: 'texture' | 'divider') => void;
  onSaveStyle: () => void;
  onApplyAppearancePreset: (style: AppearanceStylePreset) => void;
  onUpdateElement: (updates: Partial<FreeformCardElement>) => void;
  onUpdateAppearance: (updater: (appearance: FreeformAppearance) => FreeformAppearance, trackHistory?: boolean) => void;
}

export function AppearanceStudioPanel({
  element,
  selectedAppearance,
  compatibleAppearanceStyles,
  compatibleTextureAssets,
  compatibleDividerAssets,
  elementStylePresets,
  canUseImageSource,
  canUseDividerControls,
  canUseBackgroundTexture,
  controlClassName,
  buttonClassName,
  assetSearch,
  onAssetSearchChange,
  onHandleAssetUpload,
  onSaveStyle,
  onApplyAppearancePreset,
  onUpdateElement,
  onUpdateAppearance,
}: AppearanceStudioPanelProps) {
  const textureAssetUploadInputRef = useRef<HTMLInputElement | null>(null);
  const dividerAssetUploadInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-3 rounded-[6px] border border-[#3a2e17] bg-[#100d08] p-2">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] uppercase tracking-[0.16em] text-[#d5ad54]">Appearance Studio</Label>
        <Button type="button" variant="outline" size="sm" className={cn(buttonClassName, 'h-7 px-2 text-[10px]')} onClick={onSaveStyle}>
          <Save className="mr-1 h-3.5 w-3.5" /> Save Style
        </Button>
      </div>
      {!canUseImageSource && !canUseDividerControls && (element.type === 'text' || element.type === 'shape') && (
        <div>
          <Label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Quick Styles</Label>
          <div className="grid grid-cols-2 gap-1">
            {elementStylePresets.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 justify-start gap-1.5 rounded-[4px] border-[#2d3340] bg-[#111720] px-2 text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
                onClick={() => onUpdateElement(preset.updates)}
              >
                <span className="h-3 w-3 shrink-0 rounded-[2px]" style={{ background: preset.updates.backgroundColor || preset.updates.fillColor || '#222' }} />
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        {compatibleAppearanceStyles.map((style) => (
          <Tooltip key={style.id}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 justify-start gap-2 rounded-[4px] border-[#2d3340] bg-[#111720] px-2 text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]/80"
                onClick={() => onApplyAppearancePreset(style)}
              >
                <span className="h-3.5 w-3.5 shrink-0 rounded-[2px] border border-[#2d3340]" style={appearanceToStyle(style.appearance)} />
                <span className="truncate">{style.name}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Apply {style.name}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-[#8f95a3]">Material</Label>
          <ColorField value={selectedAppearance?.material?.baseColor || '#111720'} onChange={(value) => onUpdateAppearance((appearance) => ({ ...appearance, material: { ...appearance.material, baseColor: value } }), false)} />
        </div>
        {!canUseDividerControls && element.type !== 'image' && (
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-[#8f95a3]">Text</Label>
            <ColorField value={selectedAppearance?.material?.textColor || element.textColor || '#f5d27b'} onChange={(value) => onUpdateAppearance((appearance) => ({ ...appearance, material: { ...appearance.material, textColor: value, strokeColor: element.type === 'icon' ? value : appearance.material?.strokeColor } }), false)} />
          </div>
        )}
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-[#8f95a3]">{canUseDividerControls ? 'Tint' : 'Border'}</Label>
          <ColorField value={selectedAppearance?.border?.color || element.borderColor || '#d5ad54'} onChange={(value) => onUpdateAppearance((appearance) => ({ ...appearance, border: { ...appearance.border, kind: appearance.border?.kind || 'solid', color: value } }), false)} />
        </div>
      </div>
      {!canUseDividerControls && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-[#8f95a3]">Gradient</Label>
            <Select value={selectedAppearance?.material?.gradient?.type || 'none'} onValueChange={(value) => onUpdateAppearance((appearance) => ({
              ...appearance,
              material: {
                ...appearance.material,
                gradient: value === 'none'
                  ? { type: 'none', stops: [] }
                  : appearance.material?.gradient?.type && appearance.material.gradient.type !== 'none'
                    ? { ...appearance.material.gradient, type: value as AppearanceGradientType }
                    : { type: value as AppearanceGradientType, angle: 135, stops: [{ id: 'a', color: '#7a52cc', position: 0, opacity: 0.85 }, { id: 'b', color: '#d5ad54', position: 100, opacity: 0.35 }] },
              },
            }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="radial">Radial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-[#8f95a3]">Angle</Label>
            <Input className={controlClassName} type="number" value={selectedAppearance?.material?.gradient?.angle ?? 135} onChange={(event) => onUpdateAppearance((appearance) => ({ ...appearance, material: { ...appearance.material, gradient: { ...(appearance.material?.gradient || { type: 'linear', stops: [] }), angle: Number(event.target.value) } } }), false)} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {canUseBackgroundTexture && (
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-[#8f95a3]">Texture</Label>
            <Select value={selectedAppearance?.material?.texture?.kind || 'none'} onValueChange={(value) => onUpdateAppearance((appearance) => ({ ...appearance, material: { ...appearance.material, texture: { ...(appearance.material?.texture || {}), kind: value as AppearanceTextureKind, intensity: appearance.material?.texture?.intensity ?? 40, scale: appearance.material?.texture?.scale ?? 12 } } }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="parchment">Parchment Grain</SelectItem>
                <SelectItem value="foil">Foil Hatch</SelectItem>
                <SelectItem value="etched">Etched Lines</SelectItem>
                <SelectItem value="grain">Noise / Grain</SelectItem>
                <SelectItem value="hatch">Hatch</SelectItem>
                <SelectItem value="uploaded">Uploaded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {!canUseDividerControls && (
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-[#8f95a3]">Border Style</Label>
            <Select value={selectedAppearance?.border?.kind || 'none'} onValueChange={(value) => onUpdateAppearance((appearance) => ({ ...appearance, border: { ...appearance.border, kind: value as AppearanceBorderKind, width: appearance.border?.width ?? 1, radius: appearance.border?.radius ?? 6 } }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="solid">Solid</SelectItem>
                <SelectItem value="double">Double</SelectItem>
                <SelectItem value="etched">Etched</SelectItem>
                <SelectItem value="relic">Relic</SelectItem>
                <SelectItem value="foil">Foil</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {canUseBackgroundTexture && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Texture Assets</Label>
            <Button type="button" variant="outline" size="sm" className={cn(buttonClassName, 'h-7 px-2 text-[10px]')} onClick={() => textureAssetUploadInputRef.current?.click()}>
              <Upload className="mr-1 h-3.5 w-3.5" /> Upload
            </Button>
            <input ref={textureAssetUploadInputRef} type="file" accept="image/*" hidden onChange={(event) => onHandleAssetUpload(event, 'texture')} />
          </div>
          <Input className={controlClassName} placeholder="Search textures..." value={assetSearch} onChange={(event) => onAssetSearchChange(event.target.value)} />
          <div className="grid grid-cols-4 gap-1.5">
            {compatibleTextureAssets.map((asset) => (
              <Tooltip key={asset.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="h-16 overflow-hidden rounded-[4px] border border-[#2d3340] bg-[#111720] hover:border-[#d5ad54]"
                    style={{ backgroundImage: `url(${asset.url})`, backgroundSize: '52px 52px', backgroundRepeat: 'repeat' }}
                    aria-label={asset.name}
                    onClick={() => onUpdateAppearance((appearance) => ({
                      ...appearance,
                      assetSource: undefined,
                      assetKind: 'texture',
                      textureScale: asset.defaultScale ?? 12,
                      textureOpacity: asset.defaultOpacity ?? 100,
                      blendMode: asset.defaultBlendMode ?? 'normal',
                      tileMode: asset.tileMode ?? 'repeat',
                      material: {
                        ...appearance.material,
                        texture: {
                          ...(appearance.material?.texture || {}),
                          kind: 'uploaded',
                          imageSource: asset.url,
                          assetSource: asset.url,
                          assetKind: 'texture',
                          textureScale: asset.defaultScale ?? 12,
                          textureOpacity: asset.defaultOpacity ?? 100,
                          blendMode: asset.defaultBlendMode ?? 'normal',
                          tileMode: asset.tileMode ?? 'repeat',
                        },
                      },
                    }))}
                  />
                </TooltipTrigger>
                <TooltipContent>{asset.name}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
      {canUseDividerControls && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Divider Assets</Label>
            <Button type="button" variant="outline" size="sm" className={cn(buttonClassName, 'h-7 px-2 text-[10px]')} onClick={() => dividerAssetUploadInputRef.current?.click()}>
              <Upload className="mr-1 h-3.5 w-3.5" /> Upload
            </Button>
            <input ref={dividerAssetUploadInputRef} type="file" accept="image/*" hidden onChange={(event) => onHandleAssetUpload(event, 'divider')} />
          </div>
          <Input className={controlClassName} placeholder="Search dividers..." value={assetSearch} onChange={(event) => onAssetSearchChange(event.target.value)} />
          <div className="grid grid-cols-4 gap-1.5" data-testid="divider-asset-grid">
            {compatibleDividerAssets.map((asset) => (
              <Tooltip key={asset.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="h-14 rounded-[4px] border border-[#2d3340] bg-[#080b10] bg-contain bg-center bg-no-repeat hover:border-[#d5ad54]"
                    style={{ backgroundImage: `url(${asset.url})` }}
                    aria-label={asset.name}
                    onClick={() => onUpdateAppearance((appearance) => ({
                      ...appearance,
                      dividerAsset: asset.url,
                      assetKind: 'divider',
                      textureOpacity: asset.defaultOpacity ?? 100,
                      blendMode: asset.defaultBlendMode ?? 'normal',
                      tileMode: asset.tileMode ?? 'stretch',
                      shapeRole: 'divider',
                      material: { ...appearance.material, baseColor: 'transparent', texture: { kind: 'none' } },
                      border: { ...appearance.border, kind: 'none', width: 0 },
                    }))}
                  />
                </TooltipTrigger>
                <TooltipContent>{asset.name}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {canUseBackgroundTexture && (
          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] text-[#8f95a3]"><span>Texture</span><span>{selectedAppearance?.material?.texture?.intensity ?? 0}%</span></div>
            <Slider value={[selectedAppearance?.material?.texture?.intensity ?? 0]} min={0} max={100} step={1} onValueChange={(value) => onUpdateAppearance((appearance) => ({ ...appearance, material: { ...appearance.material, texture: { ...(appearance.material?.texture || { kind: 'grain' }), intensity: value[0] } } }), false)} />
          </div>
        )}
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] text-[#8f95a3]"><span>Glow</span><span>{selectedAppearance?.effects?.glow ?? 0}</span></div>
          <Slider value={[selectedAppearance?.effects?.glow ?? 0]} min={0} max={60} step={1} onValueChange={(value) => onUpdateAppearance((appearance) => ({ ...appearance, effects: { ...appearance.effects, glow: value[0] } }), false)} />
        </div>
      </div>
    </div>
  );
}
