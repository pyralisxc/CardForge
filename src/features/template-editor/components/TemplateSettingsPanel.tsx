"use client";

import type { ChangeEvent } from 'react';
import { Image as ImageIcon, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CARD_BORDER_STYLES, DIMENSION_UNITS, FRAME_STYLES } from '@/features/template-editor/lib/editorOptions';
import {
  resolveTemplateCardFormat,
  type CardFormatId,
  type CardMeasurementUnit,
} from '@/domain/card-formats';
import type { CardAssetOption, FreeformCanvas, TCGCardTemplate } from '@/domain/templates';
import { ProjectBinaryAssetBackground } from '@/features/project/client/binary-assets';
import { cn } from '@/shared/classNames';
import type { ElementPresetRecipe } from '@/features/template-editor/lib/elementPresetRecipes';
import { ColorField } from '@/features/template-editor/components/ColorField';
import { PipelineRecipeMeta, getPipelineRecipeTitle } from '@/features/template-editor/components/PipelineRecipeMeta';
import { CardFormatSelect } from '@/features/template-editor/components/CardFormatSelect';
import type { CanvasResizeStrategy } from '@/features/template-editor/lib/makerDimensions';

interface TemplateSettingsPanelProps {
  currentTemplate: TCGCardTemplate;
  customWidthValue: string;
  customHeightValue: string;
  customUnit: CardMeasurementUnit;
  resizeStrategy: CanvasResizeStrategy;
  gridSize: number;
  frameKitRecipes: ElementPresetRecipe[];
  frameAssets: CardAssetOption[];
  borderAssets: CardAssetOption[];
  backgroundImageInputRef: { current: HTMLInputElement | null };
  borderImageInputRef: { current: HTMLInputElement | null };
  controlClassName: string;
  buttonClassName: string;
  onCustomWidthValueChange: (value: string) => void;
  onCustomHeightValueChange: (value: string) => void;
  onCustomUnitChange: (value: CardMeasurementUnit) => void;
  onResizeStrategyChange: (value: CanvasResizeStrategy) => void;
  onApplyCardFormat: (formatId: CardFormatId) => void;
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
  resizeStrategy,
  gridSize,
  frameKitRecipes,
  frameAssets,
  borderAssets,
  backgroundImageInputRef,
  borderImageInputRef,
  controlClassName,
  buttonClassName,
  onCustomWidthValueChange,
  onCustomHeightValueChange,
  onCustomUnitChange,
  onResizeStrategyChange,
  onApplyCardFormat,
  onApplyCustomDimensions,
  onResetGridToTemplateDefault,
  onApplyFrameStyle,
  onApplyElementPresetRecipe,
  onFileUpload,
  onUpdateCanvas,
  onUpdateTemplate,
}: TemplateSettingsPanelProps) {
  const resolvedFormat = resolveTemplateCardFormat(currentTemplate);

  return (
    <>
      <div>
        <Label htmlFor="maker-name" className="text-xs text-[#b7bdc9]">Template name</Label>
        <Input id="maker-name" className={controlClassName} value={currentTemplate.name || ''} onChange={event => onUpdateTemplate({ name: event.target.value }, false)} />
      </div>
      <div>
        <Label htmlFor="maker-template-usage" className="text-xs text-[#b7bdc9]">Design side</Label>
        <Select
          value={currentTemplate.templateUsage === 'back-preset' ? 'back-preset' : 'standard'}
          onValueChange={(value) => {
            const templateUsage = value === 'back-preset' ? 'back-preset' : 'standard';
            onUpdateTemplate({
              templateUsage,
              templateCategory: templateUsage === 'back-preset' ? 'Card back' : 'Card front',
            }, false);
          }}
        >
          <SelectTrigger id="maker-template-usage" className={controlClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Card front</SelectItem>
            <SelectItem value="back-preset">Card back</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-[#b7bdc9]">Card format</Label>
        <CardFormatSelect
          value={resolvedFormat.formatId}
          unit={customUnit}
          className={controlClassName}
          onValueChange={onApplyCardFormat}
        />
      </div>
      <div>
        <Label htmlFor="maker-resize-strategy" className="text-xs text-[#b7bdc9]">When size changes</Label>
        <Select
          value={resizeStrategy}
          onValueChange={(value) => onResizeStrategyChange(value as CanvasResizeStrategy)}
        >
          <SelectTrigger id="maker-resize-strategy" className={controlClassName}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fit">Fit and center content (recommended)</SelectItem>
            <SelectItem value="fill">Fill canvas and crop overflow</SelectItem>
            <SelectItem value="canvas-only">Resize canvas only</SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-1 text-[10px] leading-4 text-[#818999]">
          Content keeps its proportions. Fit adds breathing room; fill may crop at the edges.
        </p>
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
          <Select value={customUnit} onValueChange={(value) => onCustomUnitChange(value as CardMeasurementUnit)}>
            <SelectTrigger id="maker-unit" className={controlClassName}><SelectValue /></SelectTrigger>
            <SelectContent>{DIMENSION_UNITS.map(unit => <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onApplyCustomDimensions} className={cn(buttonClassName, 'w-full text-xs')}>Apply custom size</Button>
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
        <Label htmlFor="maker-frame" className="text-xs text-[#b7bdc9]">Card treatment</Label>
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
          <Label htmlFor="maker-border-width" className="text-xs">Structural border width</Label>
          <Input id="maker-border-width" value={currentTemplate.cardBorderWidth || ''} onChange={event => onUpdateTemplate({ cardBorderWidth: event.target.value }, false)} />
        </div>
        <div>
          <Label htmlFor="maker-border-radius" className="text-xs">Corner Radius</Label>
          <Input id="maker-border-radius" value={currentTemplate.cardBorderRadius || ''} onChange={event => onUpdateTemplate({ cardBorderRadius: event.target.value }, false)} />
        </div>
      </div>
      <div>
        <Label htmlFor="maker-border-style">Structural border style</Label>
        <Select value={currentTemplate.cardBorderStyle || '_default_'} onValueChange={value => onUpdateTemplate({ cardBorderStyle: value === '_default_' ? undefined : value as TCGCardTemplate['cardBorderStyle'] })}>
          <SelectTrigger id="maker-border-style"><SelectValue /></SelectTrigger>
          <SelectContent>{CARD_BORDER_STYLES.map(style => <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 rounded-[6px] border border-[#302819] bg-[#0b0f15] p-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase tracking-[0.14em] text-[#d5ad54]">Card treatments</Label>
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
                  aria-label={`Apply ${recipe.label} card treatment`}
                  className={cn(
                    buttonClassName,
                    'h-16 justify-start gap-2 overflow-hidden px-2 text-left text-[10px]',
                    currentTemplate.cardBackgroundImageUrl === recipe.preview?.imageUrl && 'border-[#d5ad54] text-[var(--cf-accent-text)]'
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
      <div className="space-y-1.5 rounded-[6px] border border-[#302819] bg-[#0b0f15] p-2">
        <div>
          <Label className="text-[10px] uppercase tracking-[0.14em] text-[#d5ad54]">
            {currentTemplate.templateUsage === 'back-preset' ? 'Back foundations' : 'Front foundations'}
          </Label>
          <p className="mt-1 text-[10px] leading-4 text-[#818999]">
            Full-card artwork rendered beneath editable content. Use this for the visual foundation, not for a transparent decorative border.
          </p>
        </div>
        {frameAssets.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {frameAssets.map((asset) => (
              <Button
                key={asset.id}
                type="button"
                variant="outline"
                className={cn(
                  buttonClassName,
                  'h-auto min-h-24 flex-col items-stretch gap-1.5 overflow-hidden p-1.5 text-left',
                  currentTemplate.cardBackgroundImageUrl === asset.url && 'border-[#d5ad54] text-[var(--cf-accent-text)]',
                )}
                onClick={() => onUpdateTemplate({ cardBackgroundImageUrl: asset.url })}
              >
                <ProjectBinaryAssetBackground
                  source={asset.url}
                  className="h-20 w-full rounded-[3px] border border-[#3a2e17] bg-[#17120d] bg-contain bg-center bg-no-repeat"
                />
                <span className="block w-full truncate text-[10px] text-[#f1dfb4]">{asset.name}</span>
              </Button>
            ))}
          </div>
        ) : (
          <p className="rounded-[4px] border border-dashed border-[#3a2e17] p-2 text-[10px] leading-4 text-[#818999]">
            No published {currentTemplate.templateUsage === 'back-preset' ? 'back' : 'front'} foundations are routed here yet. You can still upload a card background below.
          </p>
        )}
      </div>
      <div className="space-y-1.5 rounded-[6px] border border-[#302819] bg-[#0b0f15] p-2">
        <div>
          <Label className="text-[10px] uppercase tracking-[0.14em] text-[#d5ad54]">
            {currentTemplate.templateUsage === 'back-preset' ? 'Back border overlays' : 'Front border overlays'}
          </Label>
          <p className="mt-1 text-[10px] leading-4 text-[#818999]">
            Transparent professional border artwork rendered above the complete card. Pipeline contributors can publish PNG, WebP, or SVG overlays directly to this section.
          </p>
        </div>
        {borderAssets.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {borderAssets.map((asset) => (
              <Button
                key={asset.id}
                type="button"
                variant="outline"
                className={cn(
                  buttonClassName,
                  'h-auto min-h-24 flex-col items-stretch gap-1.5 overflow-hidden p-1.5 text-left',
                  currentTemplate.cardBorderImageSource === asset.url && 'border-[#d5ad54] text-[var(--cf-accent-text)]',
                )}
                onClick={() => onUpdateTemplate({ cardBorderImageSource: asset.url, frameStyle: 'custom' })}
              >
                <ProjectBinaryAssetBackground
                  source={asset.url}
                  className="h-20 w-full rounded-[3px] border border-[#3a2e17] bg-[#17120d] bg-contain bg-center bg-no-repeat"
                />
                <span className="block w-full truncate text-[10px] text-[#f1dfb4]">{asset.name}</span>
              </Button>
            ))}
          </div>
        ) : (
          <p className="rounded-[4px] border border-dashed border-[#3a2e17] p-2 text-[10px] leading-4 text-[#818999]">
            No published {currentTemplate.templateUsage === 'back-preset' ? 'back' : 'front'} border overlays are routed here yet.
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="maker-bg-image">Custom card foundation</Label>
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
        <Label htmlFor="maker-border-image">Custom border overlay / gradient</Label>
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
            onChange={event => onFileUpload(event, dataUri => onUpdateTemplate({ cardBorderImageSource: dataUri, frameStyle: 'custom' }))}
          />
        </div>
      </div>
    </>
  );
}
