"use client";

import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Search, Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ColorField } from '@/components/card-forge/makerConstants';
import type { CardAssetOption } from '@/lib/cardAssets';
import type { ElementPresetRecipe } from '@/lib/elementPresetRecipes';
import type { FreeformCardElement } from '@/types';

interface IconInspectorPanelProps {
  element: FreeformCardElement;
  iconOptions: string[];
  iconAssets: CardAssetOption[];
  assetSearch: string;
  canUploadCustomAssets: boolean;
  symbolStylePresets: ElementPresetRecipe[];
  controlClassName: string;
  buttonClassName: string;
  onApplyPreset: (preset: ElementPresetRecipe) => void;
  onUpdateElement: (updates: Partial<FreeformCardElement>, trackHistory?: boolean) => void;
  onHandleFileUpload: (event: ChangeEvent<HTMLInputElement>, apply: (dataUri: string) => void) => void;
  onHandleAssetUpload: (event: ChangeEvent<HTMLInputElement>, kind: 'icon') => void;
  onAssetSearchChange: (value: string) => void;
}

export function IconInspectorPanel({
  element,
  iconOptions,
  iconAssets,
  assetSearch,
  canUploadCustomAssets,
  symbolStylePresets,
  controlClassName,
  buttonClassName,
  onApplyPreset,
  onUpdateElement,
  onHandleFileUpload,
  onHandleAssetUpload,
  onAssetSearchChange,
}: IconInspectorPanelProps) {
  const iconUploadInputRef = useRef<HTMLInputElement | null>(null);
  const iconAssetUploadInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-2">
      <Label htmlFor="icon-name">Icon Source</Label>
      <Select value={element.iconName || 'Sparkles'} onValueChange={(value) => onUpdateElement({ iconName: value, iconImageSource: undefined })}>
        <SelectTrigger id="icon-name"><SelectValue /></SelectTrigger>
        <SelectContent>{iconOptions.map((icon) => <SelectItem key={icon} value={icon}>{icon}</SelectItem>)}</SelectContent>
      </Select>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <Input
          className={controlClassName}
          placeholder="Custom icon URL or {{symbolUrl}}"
          value={element.iconImageSource || ''}
          onChange={(event) => onUpdateElement({ iconImageSource: event.target.value }, false)}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="outline" size="icon" className={buttonClassName} onClick={() => iconUploadInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Upload custom icon</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="outline" size="icon" className={buttonClassName} onClick={() => onUpdateElement({ iconImageSource: undefined })}>
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear custom icon</TooltipContent>
        </Tooltip>
        <input ref={iconUploadInputRef} type="file" accept="image/*" hidden onChange={(event) => onHandleFileUpload(event, (dataUri) => onUpdateElement({ iconImageSource: dataUri }))} />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <Label className="block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Icon Assets</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-7 rounded-[4px] border-[#2d3340] bg-[#111720] px-2 text-[10px] text-[#d8d1c4]" onClick={() => iconAssetUploadInputRef.current?.click()}>
                <Upload className="mr-1 h-3.5 w-3.5" /> {canUploadCustomAssets ? 'Upload' : 'Sign in'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{canUploadCustomAssets ? 'Add a browser-local icon asset' : 'Sign in to add custom art'}</TooltipContent>
          </Tooltip>
          <input ref={iconAssetUploadInputRef} type="file" accept="image/*" hidden onChange={(event) => onHandleAssetUpload(event, 'icon')} />
        </div>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#757d8c]" />
          <Input className={controlClassName} placeholder="Search icon assets..." value={assetSearch} onChange={(event) => onAssetSearchChange(event.target.value)} />
        </div>
        {iconAssets.length > 0 ? (
          <div className="mb-3 grid max-h-40 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
            {iconAssets.map((asset) => (
              <Tooltip key={asset.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="group min-h-[72px] rounded-[5px] border border-[#2d3340] bg-[#0b0f15] p-1.5 text-left transition hover:border-[#d5ad54]/80 hover:bg-[#111720]"
                    onClick={() => onUpdateElement({ iconImageSource: asset.url, iconName: undefined })}
                  >
                    <span className="block h-9 rounded-[4px] border border-[#1f2530] bg-[#07090d] bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${asset.url})` }} aria-hidden="true" />
                    <span className="mt-1 block truncate text-[9px] font-semibold text-[#d8d1c4] group-hover:text-[#f5d27b]">{asset.name}</span>
                    <span className="block truncate text-[8px] uppercase tracking-[0.12em] text-[#757d8c]">{asset.librarySource ?? 'official'}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{asset.name}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        ) : null}

        <Label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Pipeline Icon Recipes</Label>
        <div className="grid grid-cols-3 gap-1">
          {symbolStylePresets.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="outline"
              size="sm"
              title={`${preset.contributorName} - ${preset.status} - ${preset.tier}`}
              className="h-auto min-h-10 flex-col items-start rounded-[4px] border-[#2d3340] bg-[#111720] px-1.5 py-1 text-left text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
              onClick={() => onApplyPreset(preset)}
            >
              <span className="flex w-full items-center gap-1.5">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full border"
                  style={{ background: preset.preview?.background || preset.updates?.backgroundColor || '#111720', borderColor: preset.preview?.borderColor || preset.updates?.borderColor || '#2d3340' }}
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate text-[#f1dfb4]">{preset.label}</span>
              </span>
              <span className="mt-0.5 block w-full truncate text-[8px] uppercase tracking-[0.12em] text-[#8f95a3]">{preset.status} - {preset.tier}</span>
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="element-icon-stroke" className="text-xs">Stroke</Label>
          <ColorField id="element-icon-stroke" value={element.strokeColor || element.textColor || '#fbbf24'} onChange={(value) => onUpdateElement({ strokeColor: value, textColor: value }, false)} />
        </div>
        <div>
          <Label htmlFor="element-icon-fill" className="text-xs">Fill</Label>
          <ColorField id="element-icon-fill" value={element.fillColor || '#ffffff'} onChange={(value) => onUpdateElement({ fillColor: value }, false)} />
        </div>
        <div>
          <Label htmlFor="element-icon-bg" className="text-xs">Backplate</Label>
          <ColorField id="element-icon-bg" value={element.backgroundColor || '#000000'} onChange={(value) => onUpdateElement({ backgroundColor: value }, false)} />
        </div>
        <div>
          <Label htmlFor="element-icon-stroke-width" className="text-xs">Line Weight</Label>
          <Input id="element-icon-stroke-width" type="number" min="0" value={element.strokeWidth || 0} onChange={(event) => onUpdateElement({ strokeWidth: Number(event.target.value) }, false)} />
        </div>
      </div>
    </div>
  );
}
