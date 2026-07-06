"use client";

import type { ChangeEvent } from 'react';
import { Image as ImageIcon, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CARD_BORDER_STYLES, DIMENSION_UNITS, FRAME_STYLES, TCG_ASPECT_RATIO } from '@/lib/constants';
import type { FreeformCanvas, TCGCardTemplate } from '@/types';
import { cn } from '@/lib/utils';
import type { ElementPresetRecipe } from '@/lib/elementPresetRecipes';
import { ColorField } from '@/features/template-editor/components/ColorField';
import { PipelineRecipeMeta, getPipelineRecipeTitle } from '@/features/template-editor/components/PipelineRecipeMeta';

interface TemplateSettingsPanelProps {
  currentTemplate: TCGCardTemplate;
  customWidthValue: string;
  customHeightValue: string;
  customUnit: string;
  gridSize: number;
  frameKitRecipes: ElementPresetRecipe[];
  backgroundImageInputRef: { current: HTMLInputElement | null };
  borderImageInputRef: { current: HTMLInputElement | null };
  controlClassName: string;
  buttonClassName: string;
  onCustomWidthValueChange: (value: string) => void;
  onCustomHeightValueChange: (value: string) => void;
  onCustomUnitChange: (value: string) => void;
  onApplyCustomDimensions: () => void;
  onResetGridToTemplateDefault: () => void;
  onApplyFrameStyle: (frameStyle: string) => void;
  onApplyElementPresetRecipe: (recipe: ElementPresetRecipe) => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>, apply: (dataUri: string) => void) => void;
  onUpdateCanvas: (updates: Partial<FreeformCanvas>, trackHistory?: boolean) => void;
  onUpdateTemplate: (updates: Partial<TCGCardTemplate>, trackHistory?: boolean) => void;
}

export function TemplateSettingsPanel({
  currentTemplate,
  customWidthValue,
  customHeightValue,
  customUnit,
  gridSize,
  frameKitRecipes,
  backgroundImageInputRef,
  borderImageInputRef,
  controlClassName,
  buttonClassName,
  onCustomWidthValueChange,
  onCustomHeightValueChange,
  onCustomUnitChange,
  onApplyCustomDimensions,
  onResetGridToTemplateDefault,
  onApplyFrameStyle,
  onApplyElementPresetRecipe,
  onFileUpload,
  onUpdateCanvas,
  onUpdateTemplate,
}: TemplateSettingsPanelProps) {
  return (
    <>
      <div>
        <Label htmlFor="maker-name" className="text-xs text-[#b7bdc9]">Template Name</Label>
        <Input id="maker-name" className={controlClassName} value={currentTemplate.name || ''} onChange={event => onUpdateTemplate({ name: event.target.value }, false)} />
      </div>
      <div>
        <Label htmlFor="maker-ratio" className="text-xs text-[#b7bdc9]">Aspect Ratio</Label>
        <Input id="maker-ratio" className={controlClassName} value={currentTemplate.aspectRatio || TCG_ASPECT_RATIO} onChange={event => onUpdateTemplate({ aspectRatio: event.target.value }, false)} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label htmlFor="maker-width" className="text-xs text-[#b7bdc9]">Width</Label>
          <Input id="maker-width" className={controlClassName} type="number" value={customWidthValue} onChange={event => onCustomWidthValueChange(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="maker-height" className="text-xs text-[#b7bdc9]">Height</Label>
          <Input id="maker-height" className={controlClassName} type="number" value={customHeightValue} onChange={event => onCustomHeightValueChange(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="maker-unit" className="text-xs text-[#b7bdc9]">Unit</Label>
          <Select value={customUnit} onValueChange={onCustomUnitChange}>
            <SelectTrigger id="maker-unit" className={controlClassName}><SelectValue /></SelectTrigger>
            <SelectContent>{DIMENSION_UNITS.map(unit => <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onApplyCustomDimensions} className={cn(buttonClassName, 'w-full text-xs')}>Apply Dimensions</Button>
      <div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="maker-grid-size" className="text-xs text-[#b7bdc9]">Grid Size (px)</Label>
          <Button type="button" variant="outline" size="sm" onClick={onResetGridToTemplateDefault} className={cn(buttonClassName, 'h-7 px-2 text-[10px]')}>
            Reset Grid
          </Button>
        </div>
        <Input
          id="maker-grid-size"
          className={controlClassName}
          type="number"
          min={1}
          max={200}
          value={gridSize}
          onChange={(event) => {
            const value = Math.round(Number(event.target.value));
            if (value >= 1 && value <= 200) onUpdateCanvas({ gridSize: value });
          }}
        />
      </div>
      <div>
        <Label htmlFor="maker-frame" className="text-xs text-[#b7bdc9]">Frame Style</Label>
        <Select value={currentTemplate.frameStyle || 'custom'} onValueChange={onApplyFrameStyle}>
          <SelectTrigger id="maker-frame" className={controlClassName}><SelectValue /></SelectTrigger>
          <SelectContent>{FRAME_STYLES.map(style => <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="maker-bg" className="text-xs">Base Background</Label>
          <ColorField id="maker-bg" value={currentTemplate.baseBackgroundColor || '#ffffff'} onChange={value => onUpdateTemplate({ baseBackgroundColor: value }, false)} />
        </div>
        <div>
          <Label htmlFor="maker-text" className="text-xs">Base Text</Label>
          <ColorField id="maker-text" value={currentTemplate.baseTextColor || '#000000'} onChange={value => onUpdateTemplate({ baseTextColor: value }, false)} />
        </div>
        <div>
          <Label htmlFor="maker-border-color" className="text-xs">Border Color</Label>
          <ColorField id="maker-border-color" value={currentTemplate.cardBorderColor || '#c89f42'} onChange={value => onUpdateTemplate({ cardBorderColor: value }, false)} />
        </div>
        <div>
          <Label htmlFor="maker-element-border" className="text-xs">Default Element Border</Label>
          <ColorField id="maker-element-border" value={currentTemplate.defaultElementBorderColor || '#c89f42'} onChange={value => onUpdateTemplate({ defaultElementBorderColor: value }, false)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="maker-border-width" className="text-xs">Border Width</Label>
          <Input id="maker-border-width" value={currentTemplate.cardBorderWidth || ''} onChange={event => onUpdateTemplate({ cardBorderWidth: event.target.value }, false)} />
        </div>
        <div>
          <Label htmlFor="maker-border-radius" className="text-xs">Corner Radius</Label>
          <Input id="maker-border-radius" value={currentTemplate.cardBorderRadius || ''} onChange={event => onUpdateTemplate({ cardBorderRadius: event.target.value }, false)} />
        </div>
      </div>
      <div>
        <Label htmlFor="maker-border-style">Border Style</Label>
        <Select value={currentTemplate.cardBorderStyle || '_default_'} onValueChange={value => onUpdateTemplate({ cardBorderStyle: value === '_default_' ? undefined : value as TCGCardTemplate['cardBorderStyle'] })}>
          <SelectTrigger id="maker-border-style"><SelectValue /></SelectTrigger>
          <SelectContent>{CARD_BORDER_STYLES.map(style => <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 rounded-[6px] border border-[#302819] bg-[#0b0f15] p-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase tracking-[0.14em] text-[#d5ad54]">Frame Kits</Label>
          <Sparkles className="h-3.5 w-3.5 text-[#7a52cc]" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {frameKitRecipes.map((recipe) => (
            <Tooltip key={recipe.id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  title={getPipelineRecipeTitle(recipe)}
                  aria-label={`Apply ${recipe.label} frame kit recipe`}
                  className={cn(
                    buttonClassName,
                    'h-16 justify-start gap-2 overflow-hidden px-2 text-left text-[10px]',
                    currentTemplate.cardBackgroundImageUrl === recipe.preview?.imageUrl && 'border-[#d5ad54] text-[#f5d27b]'
                  )}
                  onClick={() => onApplyElementPresetRecipe(recipe)}
                >
                  <span
                    className="h-12 w-9 shrink-0 rounded-[3px] border border-[#3a2e17] bg-cover bg-center"
                    style={{ backgroundImage: recipe.preview?.imageUrl ? `url(${recipe.preview.imageUrl})` : undefined, backgroundColor: recipe.preview?.background }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[#f1dfb4]">{recipe.label}</span>
                    <PipelineRecipeMeta recipe={recipe} />
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{getPipelineRecipeTitle(recipe)}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="maker-bg-image">Card Background Image</Label>
        <div className="flex gap-2">
          <Input id="maker-bg-image" value={currentTemplate.cardBackgroundImageUrl || ''} onChange={event => onUpdateTemplate({ cardBackgroundImageUrl: event.target.value }, false)} />
          <Button type="button" variant="outline" size="icon" onClick={() => backgroundImageInputRef.current?.click()}><ImageIcon className="h-4 w-4" /></Button>
          <input
            ref={(input) => {
              backgroundImageInputRef.current = input;
            }}
            type="file"
            accept="image/*"
            hidden
            onChange={event => onFileUpload(event, dataUri => onUpdateTemplate({ cardBackgroundImageUrl: dataUri }))}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="maker-border-image">Border Image/Gradient</Label>
        <div className="flex gap-2">
          <Input id="maker-border-image" value={currentTemplate.cardBorderImageSource || ''} onChange={event => onUpdateTemplate({ cardBorderImageSource: event.target.value }, false)} />
          <Button type="button" variant="outline" size="icon" onClick={() => borderImageInputRef.current?.click()}><ImageIcon className="h-4 w-4" /></Button>
          <input
            ref={(input) => {
              borderImageInputRef.current = input;
            }}
            type="file"
            accept="image/*"
            hidden
            onChange={event => onFileUpload(event, dataUri => onUpdateTemplate({ cardBorderImageSource: dataUri }))}
          />
        </div>
      </div>
    </>
  );
}
