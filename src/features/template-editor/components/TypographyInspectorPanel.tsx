"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ColorField, clamp } from '@/components/card-forge/makerConstants';
import type { ElementPresetRecipe } from '@/lib/elementPresetRecipes';
import { parseTextBinding } from '@/lib/textBindings';
import { shouldAutoFitTextElement } from '@/lib/textElementContracts';
import { textFontSizePx } from '@/lib/textTools';
import type { FreeformCardElement, TCGCardTemplate } from '@/types';

type FieldContract = NonNullable<TCGCardTemplate['fieldContracts']>[number];

interface TypographyInspectorPanelProps {
  element: FreeformCardElement;
  currentTemplate: TCGCardTemplate;
  availableFonts: Array<{ value: string; name: string }>;
  paddingOptions: Array<{ value: string; label: string }>;
  framePresets: ElementPresetRecipe[];
  controlClassName: string;
  onApplyPreset: (preset: ElementPresetRecipe) => void;
  onUpdateElement: (updates: Partial<FreeformCardElement>, trackHistory?: boolean) => void;
  onUpsertFieldContract: (key: string, updates: Partial<FieldContract>) => void;
}

export function TypographyInspectorPanel({
  element,
  currentTemplate,
  availableFonts,
  paddingOptions,
  framePresets,
  controlClassName,
  onApplyPreset,
  onUpdateElement,
  onUpsertFieldContract,
}: TypographyInspectorPanelProps) {
  return (
    <>
      <div className="space-y-2">
        <div>
          <Label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Reviewed Text Frames</Label>
          <div className="grid grid-cols-2 gap-1">
            {framePresets.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="outline"
                size="sm"
                title={`${preset.contributorName} - ${preset.status} - ${preset.tier}`}
                className="h-auto min-h-9 justify-start gap-1.5 rounded-[4px] border-[#2d3340] bg-[#111720] px-2 py-1.5 text-left text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
                onClick={() => onApplyPreset(preset)}
              >
                <span
                  className="h-5 w-4 shrink-0 rounded-[3px] border border-[#3a2e17]"
                  style={{ background: preset.preview?.background || preset.updates?.backgroundColor || '#222', borderColor: preset.preview?.borderColor || preset.updates?.borderColor || '#3a2e17' }}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[#f1dfb4]">{preset.label}</span>
                  <span className="block truncate text-[8px] uppercase tracking-[0.12em] text-[#8f95a3]">{preset.status} - {preset.tier}</span>
                </span>
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="element-text-color" className="text-xs">Text Color</Label>
            <ColorField id="element-text-color" value={element.textColor || '#fbbf24'} onChange={(value) => onUpdateElement({ textColor: value }, false)} />
          </div>
          <div>
            <Label htmlFor="element-bg-color" className="text-xs">Panel Fill</Label>
            <ColorField id="element-bg-color" value={element.backgroundColor || '#ffffff'} onChange={(value) => onUpdateElement({ backgroundColor: value }, false)} />
          </div>
          <div>
            <Label htmlFor="element-border-color" className="text-xs">Border</Label>
            <ColorField id="element-border-color" value={element.borderColor || '#c89f42'} onChange={(value) => onUpdateElement({ borderColor: value }, false)} />
          </div>
        </div>
      </div>

      <details className="rounded-[6px] border border-[#252b35] bg-[#0b0f15] p-2">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f95a3]">Text Details</summary>
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="element-font">Font</Label>
              <Select value={element.fontFamily || 'font-sans'} onValueChange={(value) => onUpdateElement({ fontFamily: value })}>
                <SelectTrigger id="element-font"><SelectValue /></SelectTrigger>
                <SelectContent>{availableFonts.map((font) => <SelectItem key={font.value} value={font.value}>{font.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="element-padding">Padding</Label>
              <Select value={element.padding || 'p-1'} onValueChange={(value) => onUpdateElement({ padding: value })}>
                <SelectTrigger id="element-padding"><SelectValue /></SelectTrigger>
                <SelectContent>{paddingOptions.map((padding) => <SelectItem key={padding.value} value={padding.value}>{padding.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="element-writing-mode" className="cursor-help">Direction</Label>
                </TooltipTrigger>
                <TooltipContent>Vertical modes stack each letter upright, like East Asian text</TooltipContent>
              </Tooltip>
              <Select value={element.writingMode || 'horizontal-tb'} onValueChange={(value) => onUpdateElement({ writingMode: value as FreeformCardElement['writingMode'] })}>
                <SelectTrigger id="element-writing-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal-tb">Horizontal</SelectItem>
                  <SelectItem value="vertical-rl">Vertical Up/Down (R to L)</SelectItem>
                  <SelectItem value="vertical-lr">Vertical Up/Down (L to R)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="element-text-transform">Transform</Label>
              <Select value={element.textTransform || 'none'} onValueChange={(value) => onUpdateElement({ textTransform: value as FreeformCardElement['textTransform'] })}>
                <SelectTrigger id="element-text-transform"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="uppercase">UPPERCASE</SelectItem>
                  <SelectItem value="lowercase">lowercase</SelectItem>
                  <SelectItem value="capitalize">Capitalize</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="element-line-height" className="cursor-help">Line Height</Label>
                </TooltipTrigger>
                <TooltipContent>Spacing between lines. 1.0 = tight, 1.5 = normal, 2.0 = loose</TooltipContent>
              </Tooltip>
              <Input
                id="element-line-height"
                className={controlClassName}
                type="number"
                step="0.05"
                min="0.8"
                max="4"
                placeholder="1.4"
                value={element.lineHeight || ''}
                onChange={(event) => onUpdateElement({ lineHeight: event.target.value || undefined }, false)}
              />
            </div>
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="element-letter-spacing" className="cursor-help">Letter Spacing</Label>
                </TooltipTrigger>
                <TooltipContent>e.g. 0.05em (loose) or -0.02em (tight)</TooltipContent>
              </Tooltip>
              <Input
                id="element-letter-spacing"
                className={controlClassName}
                placeholder="0em"
                value={element.letterSpacing || ''}
                onChange={(event) => onUpdateElement({ letterSpacing: event.target.value || undefined }, false)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="element-text-autofit">Shrink to Fit</Label>
              <div className="flex h-10 items-center justify-between rounded-[6px] border border-[#252b35] bg-[#090d13] px-3">
                <span className="text-[11px] text-[#d8d1c4]">Reduce text size if it overflows</span>
                <Switch
                  id="element-text-autofit"
                  checked={shouldAutoFitTextElement(currentTemplate, element)}
                  onCheckedChange={(checked) => {
                    const boundField = parseTextBinding(element.content).field;
                    if (boundField) {
                      onUpsertFieldContract(boundField, {
                        elementId: element.id,
                        textAutoFit: checked,
                      });
                    }
                    onUpdateElement({ textAutoFit: checked }, false);
                  }}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="element-min-font-size">Min Size (px)</Label>
              <Input
                id="element-min-font-size"
                type="number"
                min="6"
                max={textFontSizePx(element)}
                value={element.textMinFontSizePx || 8}
                onChange={(event) => {
                  const nextMin = clamp(Number(event.target.value) || 8, 6, textFontSizePx(element));
                  const boundField = parseTextBinding(element.content).field;
                  if (boundField) {
                    onUpsertFieldContract(boundField, {
                      elementId: element.id,
                      minFontSizePx: nextMin,
                    });
                  }
                  onUpdateElement({ textMinFontSizePx: nextMin }, false);
                }}
              />
            </div>
          </div>
        </div>
      </details>
    </>
  );
}
