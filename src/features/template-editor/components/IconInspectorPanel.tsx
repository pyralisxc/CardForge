"use client";

import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ColorField } from '@/features/template-editor/components/ColorField';
import type { CardAssetOption } from '@/features/pipeline/client/assets';
import type { PersonalLibraryItem, PersonalLibraryRole } from '@/features/personal-library/client';
import type { ElementPresetRecipe } from '@/features/template-editor/lib/elementPresetRecipes';
import type { FreeformCardElement } from '@/domain/templates';
import { PipelineRecipeMeta, getPipelineRecipeTitle } from '@/features/template-editor/components/PipelineRecipeMeta';
import { TemplateAssetLibraryPicker } from '@/features/template-editor/components/TemplateAssetLibraryPicker';

interface IconInspectorPanelProps {
  element: FreeformCardElement;
  iconOptions: string[];
  iconAssets: CardAssetOption[];
  canUploadCustomAssets: boolean;
  symbolStylePresets: ElementPresetRecipe[];
  controlClassName: string;
  buttonClassName: string;
  onApplyPreset: (preset: ElementPresetRecipe) => void;
  onUpdateElement: (updates: Partial<FreeformCardElement>, trackHistory?: boolean) => void;
  onHandleFileUpload: (event: ChangeEvent<HTMLInputElement>, apply: (dataUri: string) => void) => void;
  onHandleAssetUpload: (event: ChangeEvent<HTMLInputElement>, kind: 'icon') => void;
  personalItems: readonly PersonalLibraryItem[];
  onAddFromProvider: (role: PersonalLibraryRole) => Promise<void>;
  onMaterializePersonal: (item: PersonalLibraryItem) => Promise<CardAssetOption>;
}

export function IconInspectorPanel({
  element,
  iconOptions,
  iconAssets,
  canUploadCustomAssets,
  symbolStylePresets,
  controlClassName,
  buttonClassName,
  onApplyPreset,
  onUpdateElement,
  onHandleFileUpload,
  onHandleAssetUpload,
  personalItems,
  onAddFromProvider,
  onMaterializePersonal,
}: IconInspectorPanelProps) {
  const iconUploadInputRef = useRef<HTMLInputElement | null>(null);
  const iconAssetUploadInputRef = useRef<HTMLInputElement | null>(null);
  const hasUploadedIconSource = Boolean(element.iconImageSource);

  return (
    <div className="space-y-2">
      <p className="text-xs text-[#8f95a3]">Current icon: {element.iconImageSource ? 'Custom source' : element.iconName || 'Sparkles'}</p>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <Input
          className={controlClassName}
          placeholder="Uploaded icon URL or {{symbolUrl}}"
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
          <Label className="block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Icon Source Assets</Label>
          <TemplateAssetLibraryPicker
            assets={iconAssets}
            kind="icon"
            label="an icon"
            personalItems={personalItems}
            personalRoles={['icon']}
            providerRole="icon"
            target={{ kind: 'template-element', ids: [element.id] }}
            onAddFromProvider={onAddFromProvider}
            onApply={(asset) => onUpdateElement({ iconImageSource: asset.url, iconName: undefined })}
            builtInOptions={iconOptions.map((icon) => ({ name: icon, value: icon }))}
            onApplyBuiltIn={(iconName) => onUpdateElement({ iconName, iconImageSource: undefined })}
            onMaterializePersonal={onMaterializePersonal}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-7 rounded-[4px] border-[#2d3340] bg-[var(--cf-editor-control)] px-2 text-[10px] text-[#d8d1c4]" onClick={() => iconAssetUploadInputRef.current?.click()}>
                <Upload className="mr-1 h-3.5 w-3.5" /> {canUploadCustomAssets ? 'Add local icon' : 'Sign in'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{canUploadCustomAssets ? 'Add a browser-local icon asset' : 'Sign in to add custom art'}</TooltipContent>
          </Tooltip>
          <input ref={iconAssetUploadInputRef} type="file" accept="image/*" hidden onChange={(event) => onHandleAssetUpload(event, 'icon')} />
        </div>
        {!hasUploadedIconSource && (
          <>
            <Label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Reviewed Icon Styles</Label>
            <div className="grid grid-cols-3 gap-1">
              {symbolStylePresets.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  title={getPipelineRecipeTitle(preset)}
                  aria-label={`Apply ${preset.label} icon recipe`}
                  className="h-auto min-h-10 flex-col items-start rounded-[4px] border-[#2d3340] bg-[var(--cf-editor-control)] px-1.5 py-1 text-left text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
                  onClick={() => onApplyPreset(preset)}
                >
                  <span className="flex w-full items-center gap-1.5">
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border"
                      style={{ background: preset.preview?.background || preset.updates?.backgroundColor || 'var(--cf-editor-control)', borderColor: preset.preview?.borderColor || preset.updates?.borderColor || '#2d3340' }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 truncate text-[#f1dfb4]">{preset.label}</span>
                  </span>
                  <PipelineRecipeMeta recipe={preset} />
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
      {!hasUploadedIconSource && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="element-icon-stroke" className="text-xs">Glyph Stroke</Label>
            <ColorField id="element-icon-stroke" value={element.strokeColor || element.textColor || '#fbbf24'} onChange={(value) => onUpdateElement({ strokeColor: value, textColor: value }, false)} />
          </div>
          <div>
            <Label htmlFor="element-icon-fill" className="text-xs">Glyph Fill</Label>
            <ColorField id="element-icon-fill" value={element.fillColor || '#ffffff'} onChange={(value) => onUpdateElement({ fillColor: value }, false)} />
          </div>
          <div>
            <Label htmlFor="element-icon-stroke-width" className="text-xs">Line Weight</Label>
            <Input id="element-icon-stroke-width" type="number" min="0" value={element.strokeWidth || 0} onChange={(event) => onUpdateElement({ strokeWidth: Number(event.target.value) }, false)} />
          </div>
        </div>
      )}
    </div>
  );
}
